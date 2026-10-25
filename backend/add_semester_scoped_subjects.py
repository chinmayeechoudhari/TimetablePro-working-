"""Add term_id to subject data while preserving existing semester setup.

Run from backend/ after updating the code:
    python add_semester_scoped_subjects.py

The migration is safe to rerun. Legacy academic-year-scoped subject definitions are
assigned to the matching semester for that academic year (preferring the active
semester, otherwise the latest term). Existing divisions, teachers, rooms and
assignment rows are preserved.
"""
from collections import defaultdict

from sqlalchemy import func, inspect, text
from sqlalchemy.orm import Session

from app.core.config import engine
from app.models.calendar import AcademicTerm  # register the academic_term table before FK model use
from app.models.models import AcademicGroup, Class, Division, Subject, SubjectDefinition, TeachingAssignment, TeacherSubject, Timetable


def _ensure_column(connection, table_name: str, column_name: str) -> None:
    inspector = inspect(connection)
    columns = {column["name"] for column in inspector.get_columns(table_name)}
    if column_name in columns:
        return
    connection.execute(text(
        f"ALTER TABLE {table_name} ADD COLUMN {column_name} INTEGER "
        "NULL REFERENCES academic_term(term_id) ON DELETE CASCADE"
    ))





def _deduplicate_term_subject_data(session: Session, has_sessions: bool) -> None:
    """Collapse duplicate subject rows left by legacy duplicate department groups."""
    from app.models.semester import ScheduledSession

    def normalized(value) -> str:
        return str(value or "").strip().casefold()

    # First merge class-level subject rows. Academic structure merging has
    # already redirected duplicate division classes to their canonical class.
    subjects = session.query(Subject).order_by(Subject.subject_id.asc()).all()
    canonical_subjects = {}
    for subject in subjects:
        key = (
            subject.term_id,
            subject.class_id,
            normalized(subject.subject_name),
            normalized(subject.subject_type),
        )
        canonical = canonical_subjects.get(key)
        if canonical is None:
            canonical_subjects[key] = subject
            continue

        # Every downstream reference must use the canonical subject ID before
        # the duplicate subject can be deleted.
        links = session.query(TeacherSubject).filter(
            TeacherSubject.subject_id == subject.subject_id
        ).all()
        for link in links:
            existing_link = session.query(TeacherSubject).filter(
                TeacherSubject.teacher_id == link.teacher_id,
                TeacherSubject.subject_id == canonical.subject_id,
            ).first()
            if existing_link:
                session.delete(link)
            else:
                link.subject_id = canonical.subject_id

        session.query(TeachingAssignment).filter(
            TeachingAssignment.subject_id == subject.subject_id
        ).update({TeachingAssignment.subject_id: canonical.subject_id}, synchronize_session=False)
        session.query(Timetable).filter(
            Timetable.subject_id == subject.subject_id
        ).update({Timetable.subject_id: canonical.subject_id}, synchronize_session=False)
        if has_sessions:
            session.query(ScheduledSession).filter(
                ScheduledSession.subject_id == subject.subject_id
            ).update({ScheduledSession.subject_id: canonical.subject_id}, synchronize_session=False)
        session.flush()
        session.delete(subject)
        session.flush()

    # Weekly timetable rows have no unique key, so remove exact duplicates
    # caused by remapping two old classes/subjects to one global class/subject.
    weekly_rows = session.query(Timetable).order_by(Timetable.timetable_id.asc()).all()
    seen_weekly_rows = set()
    for row in weekly_rows:
        key = (row.class_id, row.subject_id, row.teacher_id, row.slot_id, row.room_id)
        if key in seen_weekly_rows:
            session.delete(row)
        else:
            seen_weekly_rows.add(key)
    session.flush()

def _globalize_academic_structure() -> int:
    """Merge duplicate department/year groups while preserving all references."""
    from app.models.semester import ScheduledSession

    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    has_sessions = ScheduledSession.__tablename__ in table_names
    with Session(engine) as session:
        groups = session.query(AcademicGroup).order_by(AcademicGroup.group_id.asc()).all()
        grouped = defaultdict(list)
        for group in groups:
            key = (str(group.department or "").strip().casefold(), int(group.year_of_study))
            grouped[key].append(group)

        merged_groups = 0
        for _key, rows in grouped.items():
            if len(rows) < 2:
                continue
            canonical = rows[0]
            for duplicate in rows[1:]:
                canonical_divisions = {
                    str(item.division_name or "").strip().casefold(): item
                    for item in session.query(Division).filter(
                        Division.group_id == canonical.group_id
                    ).all()
                }
                duplicate_divisions = session.query(Division).filter(
                    Division.group_id == duplicate.group_id
                ).all()

                for old_division in duplicate_divisions:
                    old_class_id = old_division.class_id
                    division_key = str(old_division.division_name or "").strip().casefold()
                    existing = canonical_divisions.get(division_key)
                    if existing is None:
                        # A division letter that existed in an older AY remains
                        # part of the single global structure.
                        old_division.group_id = canonical.group_id
                        canonical_divisions[division_key] = old_division
                        continue

                    new_class_id = existing.class_id
                    new_division_id = existing.division_id
                    old_division_id = old_division.division_id

                    if old_class_id != new_class_id:
                        session.query(Subject).filter(
                            Subject.class_id == old_class_id
                        ).update({Subject.class_id: new_class_id}, synchronize_session=False)
                        session.query(Timetable).filter(
                            Timetable.class_id == old_class_id
                        ).update({Timetable.class_id: new_class_id}, synchronize_session=False)
                        if has_sessions:
                            old_sessions = session.query(ScheduledSession).filter(
                                ScheduledSession.class_id == old_class_id
                            ).order_by(ScheduledSession.session_id.asc()).all()
                            for old_session in old_sessions:
                                occupied = session.query(ScheduledSession).filter(
                                    ScheduledSession.version_id == old_session.version_id,
                                    ScheduledSession.session_date == old_session.session_date,
                                    ScheduledSession.class_id == new_class_id,
                                    ScheduledSession.period_number == old_session.period_number,
                                    ScheduledSession.session_id != old_session.session_id,
                                ).first()
                                if occupied:
                                    # Prefer the session already attached to the canonical class.
                                    session.query(ScheduledSession).filter(
                                        ScheduledSession.original_session_id == old_session.session_id
                                    ).update(
                                        {ScheduledSession.original_session_id: occupied.session_id},
                                        synchronize_session=False,
                                    )
                                    session.delete(old_session)
                                    session.flush()
                                else:
                                    old_session.class_id = new_class_id
                                    session.flush()

                    session.query(TeachingAssignment).filter(
                        TeachingAssignment.division_id == old_division_id
                    ).update({TeachingAssignment.division_id: new_division_id}, synchronize_session=False)
                    session.delete(old_division)
                    session.flush()

                    # Remove the superseded class row only after its subjects,
                    # weekly timetable rows, semester sessions and division link
                    # have been redirected to the canonical global class.
                    still_used = (
                        session.query(Division).filter(Division.class_id == old_class_id).first()
                        or session.query(Subject).filter(Subject.class_id == old_class_id).first()
                        or session.query(Timetable).filter(Timetable.class_id == old_class_id).first()
                    )
                    if has_sessions:
                        still_used = still_used or session.query(ScheduledSession).filter(
                            ScheduledSession.class_id == old_class_id
                        ).first()
                    if not still_used:
                        old_class = session.query(Class).filter(Class.class_id == old_class_id).first()
                        if old_class:
                            session.delete(old_class)

                # Move semester subject definitions into the global group. When
                # both groups already defined the same subject for the same term,
                # merge the definition and preserve distinct teacher/division links.
                duplicate_definitions = session.query(SubjectDefinition).filter(
                    SubjectDefinition.group_id == duplicate.group_id
                ).order_by(SubjectDefinition.definition_id.asc()).all()
                for old_definition in duplicate_definitions:
                    matching_definition = session.query(SubjectDefinition).filter(
                        SubjectDefinition.group_id == canonical.group_id,
                        SubjectDefinition.term_id == old_definition.term_id,
                        func.lower(func.trim(SubjectDefinition.subject_name)) == str(old_definition.subject_name or "").strip().lower(),
                        func.lower(func.trim(SubjectDefinition.subject_type)) == str(old_definition.subject_type or "").strip().lower(),
                    ).order_by(SubjectDefinition.definition_id.asc()).first()
                    if matching_definition is None:
                        old_definition.group_id = canonical.group_id
                        session.flush()
                        continue

                    old_assignments = session.query(TeachingAssignment).filter(
                        TeachingAssignment.definition_id == old_definition.definition_id
                    ).all()
                    for old_assignment in old_assignments:
                        existing_assignment = session.query(TeachingAssignment).filter(
                            TeachingAssignment.teacher_id == old_assignment.teacher_id,
                            TeachingAssignment.definition_id == matching_definition.definition_id,
                            TeachingAssignment.division_id == old_assignment.division_id,
                        ).first()
                        if existing_assignment:
                            session.delete(old_assignment)
                        else:
                            old_assignment.definition_id = matching_definition.definition_id
                    session.flush()
                    session.delete(old_definition)
                    session.flush()

                session.delete(duplicate)
                merged_groups += 1

        _deduplicate_term_subject_data(session, has_sessions)
        session.commit()
        return merged_groups


def migrate() -> None:
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    required = {"academic_term", "academic_group", "subject_definition", "subject", "division"}
    missing = sorted(required - existing_tables)
    if missing:
        raise RuntimeError(
            "Required tables are missing: " + ", ".join(missing) +
            ". Start the app once to initialize the database, then rerun this migration."
        )

    with engine.begin() as connection:
        term_count = connection.execute(text("SELECT COUNT(*) FROM academic_term")).scalar_one()
        if term_count < 1:
            raise RuntimeError(
                "Create at least one academic semester before running this migration, "
                "so legacy subjects can be assigned to the correct term."
            )
        _ensure_column(connection, "subject_definition", "term_id")
        _ensure_column(connection, "subject", "term_id")

        # The former subject setup was academic-year-scoped. Keep existing
        # subjects usable by assigning them to the matching term. When an
        # academic year has more than one term, prefer the currently active
        # term; otherwise use the latest term in that same academic year.
        connection.execute(text("""
            UPDATE subject_definition
            SET term_id = COALESCE(
                (
                    SELECT t.term_id
                    FROM academic_group g
                    JOIN academic_term t
                      ON lower(trim(replace(replace(t.academic_year, '–', '-'), '—', '-')))
                       = lower(trim(replace(replace(g.academic_year, '–', '-'), '—', '-')))
                    WHERE g.group_id = subject_definition.group_id
                    ORDER BY CASE WHEN lower(trim(t.status)) = 'active' THEN 0 ELSE 1 END,
                             t.start_date DESC, t.term_id DESC
                    LIMIT 1
                ),
                (
                    SELECT t.term_id
                    FROM academic_term t
                    ORDER BY CASE WHEN lower(trim(t.status)) = 'active' THEN 0 ELSE 1 END,
                             t.start_date DESC, t.term_id DESC
                    LIMIT 1
                )
            )
            WHERE term_id IS NULL
              AND EXISTS (SELECT 1 FROM academic_term)
        """))

        # Connect the class-level Subject rows to the term of their matching
        # definition. Assignment rows keep their existing foreign keys and
        # consequently inherit the definition's semester scope.
        connection.execute(text("""
            UPDATE subject
            SET term_id = (
                SELECT sd.term_id
                FROM division d
                JOIN subject_definition sd
                  ON sd.group_id = d.group_id
                 AND lower(trim(sd.subject_name)) = lower(trim(subject.subject_name))
                 AND lower(trim(sd.subject_type)) = lower(trim(subject.subject_type))
                JOIN academic_term t ON t.term_id = sd.term_id
                WHERE d.class_id = subject.class_id
                ORDER BY CASE WHEN lower(trim(t.status)) = 'active' THEN 0 ELSE 1 END,
                         t.start_date DESC, t.term_id DESC
                LIMIT 1
            )
            WHERE term_id IS NULL
              AND EXISTS (
                SELECT 1
                FROM division d
                JOIN subject_definition sd
                  ON sd.group_id = d.group_id
                 AND lower(trim(sd.subject_name)) = lower(trim(subject.subject_name))
                 AND lower(trim(sd.subject_type)) = lower(trim(subject.subject_type))
                 AND sd.term_id IS NOT NULL
                WHERE d.class_id = subject.class_id
              )
        """))

        # Use separate indexes without relying on create_all to alter existing
        # tables, which SQLAlchemy intentionally does not do.
        connection.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_subject_definition_term_id "
            "ON subject_definition(term_id)"
        ))
        connection.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_subject_term_id ON subject(term_id)"
        ))

    merged_groups = _globalize_academic_structure()
    print(
        "Migration complete: subject definitions and class-level subjects are "
        "now semester-scoped; duplicate department/year groups were merged into "
        f"the global structure ({merged_groups} duplicate group(s) removed). "
        "Rooms and faculty were left unchanged."
    )


if __name__ == "__main__":
    migrate()
