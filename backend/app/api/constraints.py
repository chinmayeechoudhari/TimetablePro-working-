from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.constraints.resolver import EntityResolutionError
from app.constraints.schemas import GeneratedConstraint
from app.constraints.service import ConstraintService
from app.constraints.validator import validate_constraint
from app.core.config import get_db
from app.models.models import Constraint


router = APIRouter(prefix="/constraints", tags=["constraints"])
service = ConstraintService()


class ConstraintRequest(BaseModel):
    text: str


class SaveConstraintRequest(BaseModel):
    constraint: GeneratedConstraint


def _serialize(row: Constraint) -> dict:
    try:
        payload = json.loads(row.parameters_json or "{}")
    except json.JSONDecodeError:
        payload = {}

    return {
        "constraint_id": row.constraint_id,
        "constraint_name": row.constraint_name,
        "constraint_type": row.constraint_type,
        "constraint": payload,
    }


@router.post("/preview")
def preview_constraint(
    request: ConstraintRequest,
    db: Session = Depends(get_db),
):
    """Interpret and validate a natural-language rule without saving it."""

    text = request.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Constraint text cannot be empty")

    try:
        constraint = service.generate_and_validate(db, text)
    except (EntityResolutionError, ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "status": "valid",
        "constraint": constraint.model_dump(mode="json"),
    }


@router.get("")
def list_constraints(db: Session = Depends(get_db)):
    """Return all saved constraints. Saved constraints are active by definition."""

    rows = db.query(Constraint).order_by(Constraint.constraint_id.desc()).all()
    return [_serialize(row) for row in rows]


@router.post("")
def create_constraint(
    request: SaveConstraintRequest,
    db: Session = Depends(get_db),
):
    """Save a previously reviewed constraint for future timetable generation."""

    constraint = request.constraint

    try:
        validate_constraint(db, constraint)
    except (EntityResolutionError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    payload = constraint.model_dump(mode="json")
    parameters_json = json.dumps(payload, sort_keys=True)

    duplicate = (
        db.query(Constraint)
        .filter(Constraint.parameters_json == parameters_json)
        .first()
    )
    if duplicate is not None:
        raise HTTPException(
            status_code=409,
            detail="This constraint is already active.",
        )

    row = Constraint(
        constraint_name=constraint.explanation,
        constraint_type=constraint.constraint_type,
        parameters_json=parameters_json,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    return _serialize(row)


@router.delete("/{constraint_id}")
def delete_constraint(
    constraint_id: int,
    db: Session = Depends(get_db),
):
    """Remove an active constraint from future timetable generations."""

    row = (
        db.query(Constraint)
        .filter(Constraint.constraint_id == constraint_id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Constraint not found")

    db.delete(row)
    db.commit()

    return {
        "status": "deleted",
        "constraint_id": constraint_id,
    }
