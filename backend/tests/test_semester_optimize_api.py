from datetime import date
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi import HTTPException

from app.api.semester_optimize import _working_days, optimize_semester
from app.models.calendar import AcademicTerm
from app.models.models import Constraint


class FakeQuery:
    def __init__(self, *, first=None, count=0, all_rows=None):
        self.first_result = first
        self.count_result = count
        self.all_result = all_rows or []

    def filter(self, *args, **kwargs):
        return self

    def order_by(self, *args, **kwargs):
        return self

    def first(self):
        return self.first_result

    def count(self):
        return self.count_result

    def all(self):
        return self.all_result


def test_optimize_returns_404_when_term_does_not_exist():
    db = Mock()
    db.query.return_value = FakeQuery(first=None)

    with pytest.raises(HTTPException) as exc:
        optimize_semester(term_id=999, db=db)

    assert exc.value.status_code == 404
    assert exc.value.detail == "Academic term not found."


def test_optimize_blocks_saved_dynamic_constraints_before_solving():
    term = SimpleNamespace(
        term_id=7,
        start_date=date(2026, 7, 1),
        end_date=date(2026, 12, 31),
        working_days_json='["Monday","Tuesday","Wednesday","Thursday","Friday"]',
    )
    db = Mock()

    def query_for(model):
        if model is AcademicTerm:
            return FakeQuery(first=term)
        if model is Constraint:
            return FakeQuery(count=1)
        raise AssertionError(f"Unexpected database query before constraint guard: {model}")

    db.query.side_effect = query_for

    with pytest.raises(HTTPException) as exc:
        optimize_semester(term_id=7, db=db)

    assert exc.value.status_code == 409
    assert "date-aware constraint compilation" in exc.value.detail
    db.commit.assert_not_called()
    db.add.assert_not_called()


def test_working_days_rejects_invalid_json():
    term = SimpleNamespace(working_days_json="{not-json")

    with pytest.raises(HTTPException) as exc:
        _working_days(term)

    assert exc.value.status_code == 422


def test_working_days_rejects_unknown_day_names():
    term = SimpleNamespace(working_days_json='["Monday","Funday"]')

    with pytest.raises(HTTPException) as exc:
        _working_days(term)

    assert exc.value.status_code == 422


def test_working_days_accepts_valid_configured_days():
    term = SimpleNamespace(working_days_json='["Monday","Saturday"]')

    assert _working_days(term) == {"Monday", "Saturday"}
