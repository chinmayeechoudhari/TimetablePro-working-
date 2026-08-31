from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.core.config import get_db
from app.models.models import AcademicGroup, Division, Subject, SubjectDefinition

router = APIRouter(prefix="/academic-subjects", tags=["academic-subjects"])


class SubjectCreate(BaseModel):
    group_id: int
    subject_name: str
    subject_type: str = Field(default="theory", pattern="^(theory|lab|theory\\+lab)$")
    periods_per_week: int = Field(default=3, ge=1, le=30)
    theory_periods_per_week: int | None = Field(default=None, ge=1, le=30)
    lab_periods_per_week: int | None = Field(default=None, ge=1, le=30)


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
