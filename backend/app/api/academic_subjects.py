from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.core.config import get_db
from app.models.calendar import AcademicTerm
from app.models.models import AcademicGroup, Division, Subject, SubjectDefinition, TeachingAssignment, Timetable

router = APIRouter(prefix="/academic-subjects", tags=["academic-subjects"])


class SubjectCreate(BaseModel):
    group_id: int
    term_id: int
    subject_name: str
    subject_type: str = Field(default="theory", pattern="^(theory|lab|theory\\+lab)$")
    periods_per_week: int = Field(default=3, ge=1, le=30)
    theory_periods_per_week: int | None = Field(default=None, ge=1, le=30)
    lab_periods_per_week: int | None = Field(default=None, ge=1, le=30)
    total_hours: int | None = Field(default=None, ge=1, le=500)
    theory_total_hours: int | None = Field(default=None, ge=1, le=500)
    lab_total_hours: int | None = Field(default=None, ge=1, le=500)
    lecture_duration: int = Field(default=1, ge=1, le=4)
    theory_lecture_duration: int | None = Field(default=None, ge=1, le=4)
    lab_lecture_duration: int | None = Field(default=None, ge=1, le=4)


class SubjectUpdate(BaseModel):
    subject_name: str
    subject_type: str = Field(pattern="^(theory|lab|theory\\+lab)$")
    periods_per_week: int = Field(default=3, ge=1, le=30)
    theory_periods_per_week: int | None = Field(default=None, ge=1, le=30)
    lab_periods_per_week: int | None = Field(default=None, ge=1, le=30)
    total_hours: int | None = Field(default=None, ge=1, le=500)
    theory_total_hours: int | None = Field(default=None, ge=1, le=500)
    lab_total_hours: int | None = Field(default=None, ge=1, le=500)
    lecture_duration: int = Field(default=1, ge=1, le=4)
    theory_lecture_duration: int | None = Field(default=None, ge=1, le=4)
    lab_lecture_duration: int | None = Field(default=None, ge=1, le=4)


def _components_for(
    subject_type: str,
    periods_per_week: int,
    theory_periods_per_week,
    lab_periods_per_week,
    total_hours: int | None = None,
    theory_total_hours: int | None = None,
    lab_total_hours: int | None = None,
    lecture_duration: int = 1,
    theory_lecture_duration: int | None = None,
    lab_lecture_duration: int | None = None,
):
    """Component-splitting logic with exact total_hours and lecture_duration validation."""
    components = {}
    if subject_type == "theory+lab":
        t_duration = theory_lecture_duration or lecture_duration or 1
        t_hours = theory_total_hours or total_hours
        t_periods = theory_periods_per_week or periods_per_week

        l_duration = lab_lecture_duration or (2 if subject_type == "theory+lab" else lecture_duration) or 2
        l_hours = lab_total_hours or total_hours
        l_periods = lab_periods_per_week or periods_per_week

        components["theory"] = {
            "periods_per_week": t_periods,
            "total_hours": t_hours,
            "lecture_duration": t_duration,
        }
        components["lab"] = {
            "periods_per_week": l_periods,
            "total_hours": l_hours,
            "lecture_duration": l_duration,
        }
    else:
        duration = lecture_duration or (2 if subject_type == "lab" else 1)
        components[subject_type] = {
            "periods_per_week": periods_per_week,
            "total_hours": total_hours,
            "lecture_duration": duration,
        }

    for c_type, info in components.items():
        dur = info["lecture_duration"]
        hrs = info["total_hours"]
        if hrs is not None:
            if hrs <= 0:
                raise HTTPException(status_code=400, detail=f"Total hours for {c_type} must be greater than zero.")
            if hrs % dur != 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Total hours ({hrs}h) for {c_type} must be evenly divisible by session duration ({dur}h).",
                )
            info["required_sessions"] = hrs // dur
        else:
            info["required_sessions"] = None

    return components


def _delete_subject_rows(db, class_ids, subject_name, subject_type, term_id: int | None = None):
    query = db.query(Subject).filter(
        Subject.class_id.in_(class_ids),
        Subject.subject_name.ilike(subject_name),
        Subject.subject_type == subject_type,
    )
    if term_id is not None:
        query = query.filter(Subject.term_id == term_id)
    rows = query.all()
    for row in rows:
        db.query(Timetable).filter(Timetable.subject_id == row.subject_id).delete(synchronize_session=False)
        db.delete(row)


def _definition_payload(r):
    dur = getattr(r, "lecture_duration", 1) or 1
    total = getattr(r, "total_hours", None)
    sessions = (total // dur) if total else None
    return {
        "definition_id": r.definition_id,
        "group_id": r.group_id,
        "term_id": r.term_id,
        "subject_name": r.subject_name,
        "subject_type": r.subject_type,
        "periods_per_week": r.periods_per_week,
        "total_hours": total,
        "lecture_duration": dur,
        "required_sessions": sessions,
    }


@router.get("")
def list_subjects(group_id: int | None = None, term_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(SubjectDefinition)
    if group_id:
        query = query.filter(SubjectDefinition.group_id == group_id)
    if term_id is not None:
        query = query.filter(SubjectDefinition.term_id == term_id)
    rows = query.order_by(SubjectDefinition.subject_name, SubjectDefinition.subject_type).all()
    return [_definition_payload(r) for r in rows]


@router.post("", status_code=201)
def create_subject(payload: SubjectCreate, db: Session = Depends(get_db)):
    group = db.query(AcademicGroup).filter(AcademicGroup.group_id == payload.group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Academic group not found.")
    term = db.query(AcademicTerm).filter(AcademicTerm.term_id == payload.term_id).first()
    if not term:
        raise HTTPException(status_code=404, detail="Academic term not found.")

    name = payload.subject_name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Subject name is required.")

    subject_type = payload.subject_type.lower()
    components = _components_for(
        subject_type,
        payload.periods_per_week,
        payload.theory_periods_per_week,
        payload.lab_periods_per_week,
        payload.total_hours,
        payload.theory_total_hours,
        payload.lab_total_hours,
        payload.lecture_duration,
        payload.theory_lecture_duration,
        payload.lab_lecture_duration,
    )

    for component_type in components:
        duplicate = (
            db.query(SubjectDefinition)
            .filter(
                SubjectDefinition.group_id == group.group_id,
                SubjectDefinition.term_id == payload.term_id,
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
        for component_type, c_info in components.items():
            definition = SubjectDefinition(
                group_id=group.group_id,
                term_id=payload.term_id,
                subject_name=name,
                subject_type=component_type,
                periods_per_week=c_info["periods_per_week"],
                total_hours=c_info["total_hours"],
                lecture_duration=c_info["lecture_duration"],
            )
            db.add(definition)
            db.flush()
            created.append(definition)

            for division in divisions:
                db.add(
                    Subject(
                        term_id=payload.term_id,
                        subject_name=name,
                        periods_per_week=c_info["periods_per_week"],
                        total_hours=c_info["total_hours"],
                        lecture_duration=c_info["lecture_duration"],
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
            {
                "type": d.subject_type,
                "periods_per_week": d.periods_per_week,
                "total_hours": d.total_hours,
                "lecture_duration": d.lecture_duration,
            }
            for d in created
        ],
        "assigned_to_divisions": [d.division_name for d in divisions],
    }


@router.put("/{group_id}/{subject_name}")
def update_subject(group_id: int, subject_name: str, payload: SubjectUpdate, term_id: int, db: Session = Depends(get_db)):
    """Update a subject that may span one or two SubjectDefinition rows."""
    group = db.query(AcademicGroup).filter(AcademicGroup.group_id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Academic group not found.")

    if not db.query(AcademicTerm).filter(AcademicTerm.term_id == term_id).first():
        raise HTTPException(status_code=404, detail="Academic term not found.")

    old_name = subject_name.strip()
    query = db.query(SubjectDefinition).filter(
        SubjectDefinition.group_id == group_id,
        SubjectDefinition.subject_name.ilike(old_name),
    )
    query = query.filter(SubjectDefinition.term_id == term_id)
    existing_defs = query.all()
    if not existing_defs:
        raise HTTPException(status_code=404, detail="Subject not found.")

    new_name = payload.subject_name.strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="Subject name is required.")

    new_subject_type = payload.subject_type.lower()
    new_components = _components_for(
        new_subject_type,
        payload.periods_per_week,
        payload.theory_periods_per_week,
        payload.lab_periods_per_week,
        payload.total_hours,
        payload.theory_total_hours,
        payload.lab_total_hours,
        payload.lecture_duration,
        payload.theory_lecture_duration,
        payload.lab_lecture_duration,
    )

    if new_name.lower() != old_name.lower():
        for component_type in new_components:
            duplicate = (
                db.query(SubjectDefinition)
                .filter(
                    SubjectDefinition.group_id == group_id,
                    SubjectDefinition.term_id == term_id,
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

    # 1) Drop component types that no longer apply
    for old_type, definition in old_by_type.items():
        if old_type not in new_components:
            removed_assignments += (
                db.query(TeachingAssignment)
                .filter(TeachingAssignment.definition_id == definition.definition_id)
                .count()
            )
            _delete_subject_rows(db, class_ids, old_name, old_type, term_id)
            db.delete(definition)

    # 2) Update surviving components / create newly-added ones
    for component_type, c_info in new_components.items():
        definition = old_by_type.get(component_type)
        if definition:
            definition.subject_name = new_name
            definition.periods_per_week = c_info["periods_per_week"]
            definition.total_hours = c_info["total_hours"]
            definition.lecture_duration = c_info["lecture_duration"]

            subject_query = db.query(Subject).filter(
                Subject.class_id.in_(class_ids),
                Subject.subject_name.ilike(old_name),
                Subject.subject_type == component_type,
            )
            subject_query = subject_query.filter(Subject.term_id == term_id)
            rows = subject_query.all()
            for row in rows:
                row.subject_name = new_name
                row.periods_per_week = c_info["periods_per_week"]
                row.total_hours = c_info["total_hours"]
                row.lecture_duration = c_info["lecture_duration"]
        else:
            new_definition = SubjectDefinition(
                group_id=group_id,
                term_id=term_id,
                subject_name=new_name,
                subject_type=component_type,
                periods_per_week=c_info["periods_per_week"],
                total_hours=c_info["total_hours"],
                lecture_duration=c_info["lecture_duration"],
            )
            db.add(new_definition)
            for division in divisions:
                db.add(
                    Subject(
                        term_id=term_id,
                        subject_name=new_name,
                        periods_per_week=c_info["periods_per_week"],
                        total_hours=c_info["total_hours"],
                        lecture_duration=c_info["lecture_duration"],
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
        "components": [
            {
                "type": t,
                "periods_per_week": info["periods_per_week"],
                "total_hours": info["total_hours"],
                "lecture_duration": info["lecture_duration"],
            }
            for t, info in new_components.items()
        ],
        "assigned_to_divisions": [d.division_name for d in divisions],
        "removed_teaching_assignments": removed_assignments,
    }


@router.delete("/{group_id}/{subject_name}")
def delete_subject(group_id: int, subject_name: str, term_id: int, db: Session = Depends(get_db)):
    group = db.query(AcademicGroup).filter(AcademicGroup.group_id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Academic group not found.")

    name = subject_name.strip()
    query = db.query(SubjectDefinition).filter(
        SubjectDefinition.group_id == group_id,
        SubjectDefinition.subject_name.ilike(name),
    )
    if term_id is not None:
        query = query.filter(SubjectDefinition.term_id == term_id)
    definitions = query.all()
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
        _delete_subject_rows(db, class_ids, name, definition.subject_type, term_id)
        db.delete(definition)

    db.commit()
    return {
        "message": f"{name} was removed from {group.department} · Year {group.year_of_study}.",
        "removed_teaching_assignments": assignment_count,
    }
