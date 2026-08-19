from unittest.mock import Mock

import pytest

import app.api.generate as generate_module


# ============================================================
# 1. GENERATE ENDPOINT WITHOUT CONSTRAINTS
# ============================================================


@pytest.mark.anyio
async def test_generate_timetable_without_constraints(
    monkeypatch,
):
    """
    Existing /generate behavior should continue to work when
    no dynamic constraints are supplied.
    """

    submitted = {}

    def fake_submit(function, task_id, *args, **kwargs):
        submitted["function"] = function
        submitted["task_id"] = task_id
        submitted["args"] = args
        submitted["kwargs"] = kwargs

        return Mock()

    monkeypatch.setattr(
        generate_module.executor,
        "submit",
        fake_submit,
    )

    result = await generate_module.generate_timetable()

    assert "task_id" in result
    assert result["status"] == "running"

    assert submitted["function"] is generate_module.run_solver_job

    assert submitted["task_id"] == result["task_id"]

    assert submitted["args"] == ([],)


# ============================================================
# 2. GENERATE ENDPOINT ACCEPTS USER CONSTRAINTS
# ============================================================


@pytest.mark.anyio
async def test_generate_timetable_accepts_user_constraints(
    monkeypatch,
):
    """
    /generate should accept a list of natural-language
    timetable constraints.
    """

    submitted = {}

    def fake_submit(function, task_id, *args, **kwargs):
        submitted["function"] = function
        submitted["task_id"] = task_id
        submitted["args"] = args
        submitted["kwargs"] = kwargs

        return Mock()

    monkeypatch.setattr(
        generate_module.executor,
        "submit",
        fake_submit,
    )

    constraints = [
        "Rahul cannot teach Monday period 3.",
        "DBMS cannot occur on Friday.",
    ]

    result = await generate_module.generate_timetable(
        user_constraints=constraints,
    )

    assert "task_id" in result
    assert result["status"] == "running"

    assert submitted["function"] is generate_module.run_solver_job

    # The first argument after the function is captured by
    # fake_submit() as submitted["task_id"].
    assert submitted["task_id"] == result["task_id"]

    # The remaining positional argument is captured in args.
    assert submitted["args"] == (
        constraints,
    )
# ============================================================
# 3. BACKGROUND JOB PASSES CONSTRAINTS TO SOLVER
# ============================================================


def test_run_solver_job_passes_constraints_to_solver(
    monkeypatch,
):
    """
    The background solver job should forward the user's
    constraints to build_and_solve().
    """

    db = Mock()

    monkeypatch.setattr(
        generate_module,
        "SessionLocal",
        Mock(return_value=db),
    )

    expected_result = {
        "status": "success",
        "timetable": [],
    }

    build_and_solve = Mock(
        return_value=expected_result
    )

    monkeypatch.setattr(
        generate_module,
        "build_and_solve",
        build_and_solve,
    )

    generate_module.TASKS.clear()

    task_id = "test-task-123"

    constraints = [
        "Rahul cannot teach Monday period 3.",
        "DBMS cannot occur on Friday.",
    ]

    generate_module.run_solver_job(
        task_id,
        constraints,
    )

    build_and_solve.assert_called_once_with(
        db,
        user_constraints=constraints,
    )

    assert generate_module.TASKS[task_id] == {
        "status": "done",
        "result": expected_result,
    }

    db.close.assert_called_once()


# ============================================================
# 4. BACKGROUND JOB WITHOUT CONSTRAINTS
# ============================================================


def test_run_solver_job_without_constraints(
    monkeypatch,
):
    """
    The background job should preserve existing behavior when
    no dynamic constraints are supplied.
    """

    db = Mock()

    monkeypatch.setattr(
        generate_module,
        "SessionLocal",
        Mock(return_value=db),
    )

    expected_result = {
        "status": "success",
        "timetable": [],
    }

    build_and_solve = Mock(
        return_value=expected_result
    )

    monkeypatch.setattr(
        generate_module,
        "build_and_solve",
        build_and_solve,
    )

    generate_module.TASKS.clear()

    task_id = "test-task-no-constraints"

    generate_module.run_solver_job(
        task_id,
    )

    build_and_solve.assert_called_once_with(
        db,
        user_constraints=[],
    )

    assert generate_module.TASKS[task_id] == {
        "status": "done",
        "result": expected_result,
    }

    db.close.assert_called_once()


# ============================================================
# 5. SOLVER ERROR IS STORED IN TASK
# ============================================================


def test_run_solver_job_stores_solver_error(
    monkeypatch,
):
    """
    If build_and_solve() fails, the background job should store
    a structured error instead of crashing silently.
    """

    db = Mock()

    monkeypatch.setattr(
        generate_module,
        "SessionLocal",
        Mock(return_value=db),
    )

    build_and_solve = Mock(
        side_effect=ValueError(
            "Unknown teacher: Rahul"
        )
    )

    monkeypatch.setattr(
        generate_module,
        "build_and_solve",
        build_and_solve,
    )

    generate_module.TASKS.clear()

    task_id = "test-task-error"

    constraints = [
        "Rahul cannot teach Monday period 3."
    ]

    generate_module.run_solver_job(
        task_id,
        constraints,
    )

    assert generate_module.TASKS[task_id] == {
        "status": "done",
        "result": {
            "status": "error",
            "message": "Unknown teacher: Rahul",
        },
    }

    db.close.assert_called_once()


# ============================================================
# 6. TASK STATUS
# ============================================================


@pytest.mark.anyio
async def test_get_generate_status_for_completed_task():
    """
    Completed tasks should return their stored result.
    """

    task_id = "completed-task"

    result = {
        "status": "success",
        "timetable": [],
    }

    generate_module.TASKS.clear()

    generate_module.TASKS[task_id] = {
        "status": "done",
        "result": result,
    }

    response = await generate_module.get_generate_status(
        task_id,
        db=Mock(),
    )

    assert response == {
        "status": "done",
        "result": result,
    }


# ============================================================
# 7. UNKNOWN TASK
# ============================================================


@pytest.mark.anyio
async def test_get_generate_status_for_unknown_task():
    """
    An unknown task ID should return a structured error.
    """

    generate_module.TASKS.clear()

    response = await generate_module.get_generate_status(
        "does-not-exist",
        db=Mock(),
    )

    assert response["status"] == "error"
    assert response["message"] == "Task not found"