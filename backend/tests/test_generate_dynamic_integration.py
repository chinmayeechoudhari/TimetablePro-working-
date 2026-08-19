from unittest.mock import Mock

import pytest

import app.api.generate as generate_module


@pytest.mark.anyio
async def test_generate_endpoint_dispatches_dynamic_constraints(
    monkeypatch,
):
    submitted = {}

    def fake_submit(function, *args, **kwargs):
        submitted["function"] = function
        submitted["args"] = args
        submitted["kwargs"] = kwargs
        return Mock()

    monkeypatch.setattr(
        generate_module.executor,
        "submit",
        fake_submit,
    )

    constraints = [
        "Rahul can teach at most 3 periods on Monday.",
        "DBMS cannot occur on Friday.",
    ]

    result = await generate_module.generate_timetable(
        user_constraints=constraints,
    )

    assert result["status"] == "running"
    assert "task_id" in result

    assert submitted["function"] is generate_module.run_solver_job

    assert submitted["args"] == (
        result["task_id"],
        constraints,
    )


def test_run_solver_job_passes_dynamic_constraints_to_solver(
    monkeypatch,
):
    db = Mock()

    monkeypatch.setattr(
        generate_module,
        "SessionLocal",
        Mock(return_value=db),
    )

    solver_result = {
        "status": "success",
        "timetable": [],
    }

    build_and_solve = Mock(
        return_value=solver_result,
    )

    monkeypatch.setattr(
        generate_module,
        "build_and_solve",
        build_and_solve,
    )

    generate_module.TASKS.clear()

    task_id = "dynamic-integration-test"

    constraints = [
        "Rahul can teach at most 3 periods on Monday.",
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
        "result": solver_result,
    }

    db.close.assert_called_once()