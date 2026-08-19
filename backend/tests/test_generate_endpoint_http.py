from unittest.mock import Mock

from fastapi.testclient import TestClient

import app.api.generate as generate_module
from app.main import app


client = TestClient(app)


def test_generate_endpoint_accepts_json_constraints(
    monkeypatch,
):
    submitted = {}

    def fake_submit(
        function,
        task_id,
        *args,
        **kwargs,
    ):
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

    response = client.post(
        "/generate",
        json={
            "user_constraints": [
                "Rahul cannot teach Monday period 3.",
                "DBMS cannot occur on Friday.",
            ]
        },
    )

    assert response.status_code == 200

    result = response.json()

    assert result["status"] == "running"
    assert "task_id" in result

    assert submitted["function"] is (
        generate_module.run_solver_job
    )

    assert submitted["task_id"] == result["task_id"]

    assert submitted["args"] == (
        [
            "Rahul cannot teach Monday period 3.",
            "DBMS cannot occur on Friday.",
        ],
    )