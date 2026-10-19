"""Add term_id to subject data while preserving existing semester setup.

Run from backend/ after updating the code:
    python add_semester_scoped_subjects.py

The migration is safe to rerun. Legacy academic-year-scoped subject definitions are
assigned to the matching semester for that academic year (preferring the active
semester, otherwise the latest term). Existing divisions, teachers, rooms and
assignment rows are preserved.
"""
from sqlalchemy import inspect, text

from app.core.config import engine


def _ensure_column(connection, table_name: str, column_name: str) -> None:
    inspector = inspect(connection)
    columns = {column["name"] for column in inspector.get_columns(table_name)}
    if column_name in columns:
        return
    connection.execute(text(
        f"ALTER TABLE {table_name} ADD COLUMN {column_name} INTEGER "
        "NULL REFERENCES academic_term(term_id) ON DELETE CASCADE"
    ))


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

    print(
        "Migration complete: subject definitions and class-level subjects are "
        "now semester-scoped. Global departments, divisions, rooms and faculty "
        "were left unchanged."
    )


if __name__ == "__main__":
    migrate()
