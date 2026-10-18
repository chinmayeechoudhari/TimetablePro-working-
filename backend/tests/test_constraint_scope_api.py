import json
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi import HTTPException

import app.api.constraints as api
from app.constraints.schemas import GeneratedConstraint
from app.models.calendar import AcademicTerm
from app.models.models import Constraint


class FakeQuery:
    def __init__(self, rows=None, first=None):
        self.rows = list(rows or [])
        self.first_result = first

    def filter(self, *args, **kwargs):
        return self

    def order_by(self, *args, **kwargs):
        return self

    def all(self):
        return self.rows

    def first(self):
        return self.first_result


def _constraint_payload():
    return GeneratedConstraint.model_validate({
        "constraint_type": "hard",
        "expression": {
            "kind": "forbid",
            "filter": {
                "kind": "atomic",
                "field": "day",
                "operator": "eq",
                "value": "Monday",
            },
        },
        "explanation": "No Monday classes",
        "assumptions": [],
    })


def test_stored_payload_reads_legacy_global_and_scoped_envelope():
    legacy = SimpleNamespace(parameters_json=json.dumps(_constraint_payload().model_dump(mode="json")))
    scoped = SimpleNamespace(parameters_json=json.dumps({
        "scope": {"term_id": 22},
        "constraint": _constraint_payload().model_dump(mode="json"),
    }))

    legacy_payload, legacy_term_id = api._stored_payload(legacy)
    scoped_payload, scoped_term_id = api._stored_payload(scoped)

    assert legacy_term_id is None
    assert legacy_payload["explanation"] == "No Monday classes"
    assert scoped_term_id == 22
    assert scoped_payload["explanation"] == "No Monday classes"


def test_list_constraints_returns_global_only_without_term_and_global_plus_selected_term():
    global_row = SimpleNamespace(
        constraint_id=1, constraint_name="Global", constraint_type="hard",
        parameters_json=json.dumps(_constraint_payload().model_dump(mode="json")),
    )
    term_22 = SimpleNamespace(
        constraint_id=2, constraint_name="Term 22", constraint_type="hard",
        parameters_json=json.dumps({
            "scope": {"term_id": 22},
            "constraint": _constraint_payload().model_dump(mode="json"),
        }),
    )
    term_23 = SimpleNamespace(
        constraint_id=3, constraint_name="Term 23", constraint_type="hard",
        parameters_json=json.dumps({
            "scope": {"term_id": 23},
            "constraint": _constraint_payload().model_dump(mode="json"),
        }),
    )
    db = Mock()
    def query_for(model):
        if model is AcademicTerm:
            return FakeQuery(first=SimpleNamespace(term_id=22))
        if model is Constraint:
            return FakeQuery(rows=[global_row, term_22, term_23])
        raise AssertionError(f"Unexpected model queried: {model}")
    db.query.side_effect = query_for

    global_only = api.list_constraints(db=db)
    semester_22 = api.list_constraints(term_id=22, db=db)

    assert [row["constraint_id"] for row in global_only] == [1]
    assert [row["constraint_id"] for row in semester_22] == [2, 1]
    assert {row["scope"] for row in semester_22} == {"global", "semester"}
    assert next(row for row in semester_22 if row["constraint_id"] == 2)["term_id"] == 22


def test_create_constraint_persists_semester_scope_without_schema_migration(monkeypatch):
    term = SimpleNamespace(term_id=22)
    db = Mock()
    existing_rows = []
    def query_for(model):
        if model is AcademicTerm:
            return FakeQuery(first=term)
        if model is Constraint:
            return FakeQuery(rows=existing_rows)
        raise AssertionError(f"Unexpected model queried: {model}")
    db.query.side_effect = query_for
    db.add.side_effect = lambda row: existing_rows.append(row)
    def refresh(row):
        row.constraint_id = 99
    db.refresh.side_effect = refresh
    monkeypatch.setattr(api, "_validate_for_constraint_studio", lambda db, constraint: None)

    response = api.create_constraint(
        api.SaveConstraintRequest(constraint=_constraint_payload()),
        term_id=22,
        db=db,
    )

    stored = json.loads(existing_rows[0].parameters_json)
    assert stored["scope"] == {"term_id": 22}
    assert stored["constraint"]["explanation"] == "No Monday classes"
    assert response["scope"] == "semester"
    assert response["term_id"] == 22
    db.commit.assert_called_once()


def test_create_constraint_allows_same_rule_in_different_scope(monkeypatch):
    payload = _constraint_payload().model_dump(mode="json")
    existing_global = SimpleNamespace(
        constraint_id=1, constraint_name="Global", constraint_type="hard",
        parameters_json=json.dumps(payload),
    )
    db = Mock()
    db.query.side_effect = lambda model: (
        FakeQuery(first=SimpleNamespace(term_id=22)) if model is AcademicTerm
        else FakeQuery(rows=[existing_global]) if model is Constraint
        else (_ for _ in ()).throw(AssertionError(f"Unexpected model queried: {model}"))
    )
    monkeypatch.setattr(api, "_validate_for_constraint_studio", lambda db, constraint: None)
    response = api.create_constraint(
        api.SaveConstraintRequest(constraint=_constraint_payload()),
        term_id=22,
        db=db,
    )
    assert response["scope"] == "semester"
    db.commit.assert_called_once()


def test_invalid_term_scope_returns_404():
    db = Mock()
    db.query.return_value = FakeQuery(first=None)

    with pytest.raises(HTTPException) as exc:
        api.list_constraints(term_id=999, db=db)

    assert exc.value.status_code == 404

def test_create_constraint_rejects_duplicate_in_same_semester_scope(monkeypatch):
    payload = _constraint_payload().model_dump(mode="json")
    existing_scoped = SimpleNamespace(
        constraint_id=7, constraint_name="Term 22", constraint_type="hard",
        parameters_json=json.dumps({"scope": {"term_id": 22}, "constraint": payload}),
    )
    db = Mock()
    db.query.side_effect = lambda model: (
        FakeQuery(first=SimpleNamespace(term_id=22)) if model is AcademicTerm
        else FakeQuery(rows=[existing_scoped]) if model is Constraint
        else (_ for _ in ()).throw(AssertionError(f"Unexpected model queried: {model}"))
    )
    monkeypatch.setattr(api, "_validate_for_constraint_studio", lambda db, constraint: None)

    with pytest.raises(HTTPException) as exc:
        api.create_constraint(
            api.SaveConstraintRequest(constraint=_constraint_payload()),
            term_id=22,
            db=db,
        )

    assert exc.value.status_code == 409
    db.commit.assert_not_called()
