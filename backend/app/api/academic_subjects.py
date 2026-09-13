from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.core.config import get_db
from app.models.models import AcademicGroup, Division, Subject, SubjectDefinition, TeachingAssignment, Timetable

router = APIRouter(prefix="/academic-subjects", tags=["academic-subjects"])


class SubjectCreate(BaseModel):
    group_id: int
    subject_name: str
    subject_type: str = Field(default="theory", pattern="^(theory|lab|theory\\+lab)$")
    periods_per_week: int = Field(default=3, ge=1, le=30)
    theory_periods_per_week: int | None = Field(default=None, ge=1, le=30)
    lab_periods_per_week: int | None = Field(default=None, ge=1, le=30)


class SubjectUpdate(BaseModel):
    subject_name: str
    subject_type: str = Field(pattern="^(theory|lab|theory\\+lab)$")
    periods_per_week: int = Field(default=3, ge=1, le=30)
    theory_periods_per_week: int | None = Field(default=None, ge=1, le=30)
    lab_periods_per_week: int | None = Field(default=None, ge=1, le=30)


def _components_for(subject_type: str, periods_per_week: int, theory_periods_per_week, lab_periods_per_week):
    """Mirror the component-splitting logic used on create, kept in one place
    so update behaves identically for theory / lab / theory+lab."""
    if subject_type == "theory+lab":
        return {
            "theory": theory_periods_per_week or periods_per_week,
            "lab": lab_periods_per_week or periods_per_week,
        }
    return {subject_type: periods_per_week}


def _delete_subject_rows(db, class_ids, subject_name, subject_type):
    """Delete the per-division Subject rows (and any Timetable rows that
    reference them — Subject->Timetable has no cascade at the DB layer, so
    this must be explicit, mirroring api/subjects.py's delete_subject)."""
    rows = (
        db.query(Subject)
        .filter(
            Subject.class_id.in_(class_ids),
            Subject.subject_name.ilike(subject_name),
            Subject.subject_type == subject_type,
        )
        .all()
    )
    for row in rows:
        db.query(Timetable).filter(Timetable.subject_id == row.subject_id).delete(synchronize_session=False)
        db.delete(row)


def _definition_payload(r):
    return {
        "definition_id": r.definition_id,
        "group_id": r.group_id,
        "subject_name": r.subject_name,
        "subject_type": r.subject_type,
        "periods_per_week": r.periods_per_week,
    }


@router.get("")
def list_subjects(group_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(SubjectDefinition)
    if group_id:
        query = query.filter(SubjectDefinition.group_id == group_id)
    rows = query.order_by(SubjectDefinition.subject_name, SubjectDefinition.subject_type).all()
    return [_definition_payload(r) for r in rows]


@router.post("", status_code=201)
def create_subject(payload: SubjectCreate, db: Session = Depends(get_db)):
    group = db.query(AcademicGroup).filter(AcademicGroup.group_id == payload.group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Academic group not found.")

    name = payload.subject_name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Subject name is required.")

    subject_type = payload.subject_type.lower()
    if subject_type == "theory+lab":
        components = [
            ("theory", payload.theory_periods_per_week or payload.periods_per_week),
            ("lab", payload.lab_periods_per_week or payload.periods_per_week),
        ]
    else:
        components = [(subject_type, payload.periods_per_week)]

    for component_type, _periods in components:
        duplicate = (
            db.query(SubjectDefinition)
            .filter(
                SubjectDefinition.group_id == group.group_id,
                SubjectDefinition.subject_name.ilike(name),
                SubjectDefinition.subject_type == component_type,
            )
            .first()
        )
        if duplicate:
            raise HTTPException(
                status_code=409,
                detail=f"{name} ({component_type}) already exists for this department/year.",
            )

    divisions = db.query(Division).filter(Division.group_id == group.group_id).all()
    if not divisions:
        raise HTTPException(status_code=400, detail="No divisions exist for this academic group.")

    created = []
    try:
        for component_type, component_periods in components:
            definition = SubjectDefinition(
                group_id=group.group_id,
                subject_name=name,
                subject_type=component_type,
                periods_per_week=component_periods,
            )
            db.add(definition)
            db.flush()
            created.append(definition)

            for division in divisions:
                db.add(
                    Subject(
                        subject_name=name,
                        periods_per_week=component_periods,
                        subject_type=component_type,
                        class_id=division.class_id,
                    )
                )

        db.commit()
    except Exception:
        db.rollback()
        raise

    return {
        "definition_ids": [d.definition_id for d in created],
        "group_id": group.group_id,
        "subject_name": name,
        "subject_type": subject_type,
        "components": [
            {"type": d.subject_type, "periods_per_week": d.periods_per_week}
            for d in created
        ],
        "assigned_to_divisions": [d.division_name for d in divisions],
    }


@router.put("/{group_id}/{subject_name}")
def update_subject(group_id: int, subject_name: str, payload: SubjectUpdate, db: Session = Depends(get_db)):
    """Update a subject that may span one or two SubjectDefinition rows
    (theory / lab components). Handles switching between theory-only,
    lab-only and theory+lab, renaming, and period changes, keeping the
    per-division Subject rows (used by the timetable) in sync."""
    group = db.query(AcademicGroup).filter(AcademicGroup.group_id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Academic group not found.")

    old_name = subject_name.strip()
    existing_defs = (
        db.query(SubjectDefinition)
        .filter(
            SubjectDefinition.group_id == group_id,
            SubjectDefinition.subject_name.ilike(old_name),
        )
        .all()
    )
    if not existing_defs:
        raise HTTPException(status_code=404, detail="Subject not found.")

    new_name = payload.subject_name.strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="Subject name is required.")

    new_subject_type = payload.subject_type.lower()
    new_components = _components_for(
        new_subject_type, payload.periods_per_week, payload.theory_periods_per_week, payload.lab_periods_per_week
    )

    # Guard against colliding with a *different* existing subject when renaming.
    if new_name.lower() != old_name.lower():
        for component_type in new_components:
            duplicate = (
                db.query(SubjectDefinition)
                .filter(
                    SubjectDefinition.group_id == group_id,
                    SubjectDefinition.subject_name.ilike(new_name),
                    SubjectDefinition.subject_type == component_type,
                )
                .first()
            )
            if duplicate:
                raise HTTPException(
                    status_code=409,
                    detail=f"{new_name} ({component_type}) already exists for this department/year.",
                )

    divisions = db.query(Division).filter(Division.group_id == group_id).all()
    class_ids = [d.class_id for d in divisions]

    old_by_type = {d.subject_type: d for d in existing_defs}
    removed_assignments = 0

    # 1) Drop component types that no longer apply (e.g. theory+lab -> theory).
    for old_type, definition in old_by_type.items():
        if old_type not in new_components:
            removed_assignments += (
                db.query(TeachingAssignment)
                .filter(TeachingAssignment.definition_id == definition.definition_id)
                .count()
            )
            _delete_subject_rows(db, class_ids, old_name, old_type)
            db.delete(definition)  # cascades to TeachingAssignment

    # 2) Update surviving components / create newly-added ones.
    for component_type, component_periods in new_components.items():
        definition = old_by_type.get(component_type)
        if definition:
            definition.subject_name = new_name
            definition.periods_per_week = component_periods
            rows = (
                db.query(Subject)
                .filter(
                    Subject.class_id.in_(class_ids),
                    Subject.subject_name.ilike(old_name),
                    Subject.subject_type == component_type,
                )
                .all()
            )
            for row in rows:
                row.subject_name = new_name
                row.periods_per_week = component_periods
        else:
            new_definition = SubjectDefinition(
                group_id=group_id,
                subject_name=new_name,
                subject_type=component_type,
                periods_per_week=component_periods,
            )
            db.add(new_definition)
            for division in divisions:
                db.add(
                    Subject(
                        subject_name=new_name,
                        periods_per_week=component_periods,
                        subject_type=component_type,
                        class_id=division.class_id,
                    )
                )

    db.commit()
    return {
        "message": f"{new_name} was updated.",
        "group_id": group_id,
        "subject_name": new_name,
        "subject_type": new_subject_type,
        "components": [{"type": t, "periods_per_week": p} for t, p in new_components.items()],
        "assigned_to_divisions": [d.division_name for d in divisions],
        "removed_teaching_assignments": removed_assignments,
    }


@router.delete("/{group_id}/{subject_name}")
def delete_subject(group_id: int, subject_name: str, db: Session = Depends(get_db)):
    """Delete a subject (all of its theory/lab components) from every
    division of the academic group."""
    group = db.query(AcademicGroup).filter(AcademicGroup.group_id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Academic group not found.")

    name = subject_name.strip()
    definitions = (
        db.query(SubjectDefinition)
        .filter(
            SubjectDefinition.group_id == group_id,
            SubjectDefinition.subject_name.ilike(name),
        )
        .all()
    )
    if not definitions:
        raise HTTPException(status_code=404, detail="Subject not found.")

    divisions = db.query(Division).filter(Division.group_id == group_id).all()
    class_ids = [d.class_id for d in divisions]

    assignment_count = (
        db.query(TeachingAssignment)
        .filter(TeachingAssignment.definition_id.in_([d.definition_id for d in definitions]))
        .count()
    )

    for definition in definitions:
        _delete_subject_rows(db, class_ids, name, definition.subject_type)
        db.delete(definition)  # cascades to TeachingAssignment

    db.commit()
    return {
        "message": f"{name} was removed from {group.department} · Year {group.year_of_study}.",
        "removed_teaching_assignments": assignment_count,
    }