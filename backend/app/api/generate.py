from __future__ import annotations

import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import SessionLocal
from app.solver.solver import build_and_solve


router = APIRouter()


# ---------------------------------------------------------------------------
# Background task storage
# ---------------------------------------------------------------------------

TASKS: dict[str, dict] = {}

executor = ThreadPoolExecutor(max_workers=4)


# ---------------------------------------------------------------------------
# Request model
# ---------------------------------------------------------------------------

class GenerateRequest(BaseModel):
    user_constraints: list[str] = []


# ---------------------------------------------------------------------------
# Database dependency
# ---------------------------------------------------------------------------

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Background solver job
# ---------------------------------------------------------------------------

def run_solver_job(
    task_id: str,
    user_constraints: Optional[list[str]] = None,
):
    """
    Run timetable generation in the background.

    Dynamic natural-language constraints are forwarded to
    build_and_solve().
    """

    user_constraints = user_constraints or []

    db = SessionLocal()

    try:
        TASKS[task_id] = {
            "status": "running",
        }

        result = build_and_solve(
            db,
            user_constraints=user_constraints,
        )

        TASKS[task_id] = {
            "status": "done",
            "result": result,
        }

    except Exception as exc:
        TASKS[task_id] = {
            "status": "done",
            "result": {
                "status": "error",
                "message": str(exc),
            },
        }

    finally:
        db.close()


# ---------------------------------------------------------------------------
# POST /generate
# ---------------------------------------------------------------------------

@router.post("/generate")
async def generate_timetable(
    body: GenerateRequest | None = None,
    user_constraints: Optional[list[str]] = None,
):
    """
    Start timetable generation.

    HTTP JSON:

        {
            "user_constraints": [
                "Rahul cannot teach Monday period 3.",
                "DBMS cannot occur on Friday."
            ]
        }

    Direct Python call:

        await generate_timetable()

    or:

        await generate_timetable(
            user_constraints=[
                "Rahul cannot teach Monday period 3.",
                "DBMS cannot occur on Friday.",
            ]
        )
    """

    # ------------------------------------------------------------------
    # Direct Python invocation
    #
    # Tests call:
    #
    #   generate_timetable(user_constraints=constraints)
    #
    # ------------------------------------------------------------------
    if user_constraints is not None:
        constraints = user_constraints

    # ------------------------------------------------------------------
    # HTTP JSON invocation
    #
    # FastAPI parses the JSON into GenerateRequest.
    # ------------------------------------------------------------------
    elif body is not None:
        constraints = body.user_constraints

    else:
        constraints = []

    # Never pass None to the solver.
    constraints = constraints or []

    task_id = str(uuid.uuid4())

    TASKS[task_id] = {
        "status": "running",
    }

    print("[INFO] Dispatching background solver task")

    executor.submit(
        run_solver_job,
        task_id,
        constraints,
    )

    return {
        "task_id": task_id,
        "status": "running",
    }


# ---------------------------------------------------------------------------
# GET /generate/{task_id}
# ---------------------------------------------------------------------------

@router.get("/generate/{task_id}")
async def get_generate_status(
    task_id: str,
    db: Session = Depends(get_db),
):
    """
    Return the current status/result of a generation task.

    The db dependency is retained for compatibility with the existing
    API/tests, although TASKS is currently used as the task store.
    """

    task = TASKS.get(task_id)

    if task is None:
        return {
            "status": "error",
            "message": "Task not found",
        }

    return task


# ---------------------------------------------------------------------------
# GET /validate
# ---------------------------------------------------------------------------

@router.get("/validate")
async def validate_generate():
    """
    Basic validation/health endpoint.
    """

    return {
        "status": "ok",
        "message": "Generate API is available",
    }