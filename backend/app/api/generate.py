from __future__ import annotations

import json
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import SessionLocal
from app.models.models import Constraint
from app.solver.solver import build_and_solve
from app.solver.validator import run_preflight_checks
from app.constraints.schemas import GeneratedConstraint
from app.constraints.validator import validate_constraint


router = APIRouter()

TASKS: dict[str, dict] = {}
executor = ThreadPoolExecutor(max_workers=4)


class GenerateRequest(BaseModel):
    user_constraints: list[str] = []


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _saved_constraint_issues(db: Session) -> tuple[list[str], list[str]]:
    """Validate saved rules before generation so stale rules fail preflight."""
    issues: list[str] = []
    passed: list[str] = []
    rows = db.query(Constraint).order_by(Constraint.constraint_id.asc()).all()

    if not rows:
        passed.append("No saved user constraints are active.")
        return issues, passed

    for row in rows:
        try:
            payload = json.loads(row.parameters_json or "{}")
            constraint = GeneratedConstraint.model_validate(payload)
            validate_constraint(db, constraint)
        except Exception as exc:
            issues.append(
                f"Saved constraint {row.constraint_id} is invalid: {exc}. "
                f"Remove or recreate it in Constraints."
            )
        else:
            passed.append(f"Saved constraint {row.constraint_id} is valid and ready to apply.")

    return issues, passed


def run_solver_job(task_id: str, user_constraints: Optional[list[str]] = None):
    user_constraints = user_constraints or []
    db = SessionLocal()
    try:
        TASKS[task_id] = {"status": "running"}
        result = build_and_solve(db, user_constraints=user_constraints)
        TASKS[task_id] = {"status": "done", "result": result}
    except Exception as exc:
        TASKS[task_id] = {
            "status": "done",
            "result": {"status": "error", "message": str(exc)},
        }
    finally:
        db.close()


@router.post("/generate")
async def generate_timetable(
    body: GenerateRequest | None = None,
    user_constraints: Optional[list[str]] = None,
):
    if user_constraints is not None:
        constraints = user_constraints
    elif body is not None:
        constraints = body.user_constraints
    else:
        constraints = []

    constraints = constraints or []
    task_id = str(uuid.uuid4())
    TASKS[task_id] = {"status": "running"}

    executor.submit(run_solver_job, task_id, constraints)
    return {"task_id": task_id, "status": "running"}


@router.get("/generate/{task_id}")
async def get_generate_status(task_id: str, db: Session = Depends(get_db)):
    task = TASKS.get(task_id)
    if task is None:
        return {"status": "error", "message": "Task not found"}
    return task


@router.get("/generate/status/{task_id}")
async def get_generate_status_compat(task_id: str, db: Session = Depends(get_db)):
    return await get_generate_status(task_id, db)


@router.get("/validate")
async def validate_generate(db: Session = Depends(get_db)):
    """Run the real timetable preflight checks used by the Generate page."""
    report = run_preflight_checks(db)
    saved_issues, saved_passed = _saved_constraint_issues(db)

    issues = list(report.get("issues", [])) + saved_issues
    warnings = list(report.get("warnings", []))
    passed = list(report.get("passed", [])) + saved_passed
    ready = not issues

    return {
        "ready": ready,
        "summary": (
            "Generate API is ready. All pre-generation checks are available."
            if ready
            else f"{len(issues)} issue(s) must be fixed before generating."
        ),
        "issues": issues,
        "warnings": warnings,
        "passed": passed,
    }


@router.get("/timetable")
async def get_timetable(db: Session = Depends(get_db)):
    """Return the latest timetable saved by the solver."""
    from app.models.models import Timetable

    rows = db.query(Timetable).order_by(Timetable.timetable_id.asc()).all()
    return [
        {
            "timetable_id": row.timetable_id,
            "class_id": row.class_id,
            "subject_id": row.subject_id,
            "teacher_id": row.teacher_id,
            "slot_id": row.slot_id,
            "room_id": row.room_id,
        }
        for row in rows
    ]
