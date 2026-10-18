from datetime import date
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi import HTTPException

from app.api.semester_optimize import _working_days, optimize_semester
from app.models.calendar import AcademicTerm
from app.models.models import AcademicGroup, Constraint


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


def test_optimize_rejects_malformed_saved_dynamic_constraint():
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
            return FakeQuery(all_rows=[
                SimpleNamespace(constraint_id=4, parameters_json="{not-json")
            ])
        raise AssertionError(f"Unexpected database query after malformed constraint: {model}")

    db.query.side_effect = query_for

    with pytest.raises(HTTPException) as exc:
        optimize_semester(term_id=7, db=db)

    assert exc.value.status_code == 409
    assert "Saved dynamic constraint 4 is invalid" in exc.value.detail
    db.commit.assert_not_called()
    db.add.assert_not_called()


def test_optimize_rejects_unsupported_saved_soft_priority():
    term = SimpleNamespace(
        term_id=7,
        start_date=date(2026, 7, 1),
        end_date=date(2026, 12, 31),
        working_days_json='["Monday","Tuesday","Wednesday","Thursday","Friday"]',
    )
    payload = {
        "constraint_type": "soft",
        "weight": 1.5,
        "expression": {"kind": "forbid", "filter": {
            "kind": "atomic", "field": "day", "operator": "eq", "value": "Monday"
        }},
        "explanation": "Avoid Monday",
    }
    import json
    db = Mock()

    def query_for(model):
        if model is AcademicTerm:
            return FakeQuery(first=term)
        if model is Constraint:
            return FakeQuery(all_rows=[
                SimpleNamespace(constraint_id=5, constraint_type="soft", parameters_json=json.dumps(payload))
            ])
        raise AssertionError(f"Unexpected database query after invalid priority: {model}")

    db.query.side_effect = query_for
    with pytest.raises(HTTPException) as exc:
        optimize_semester(term_id=7, db=db)

    assert exc.value.status_code == 409
    assert "Saved dynamic constraint 5 is invalid" in exc.value.detail
    db.commit.assert_not_called()
    db.add.assert_not_called()


def test_optimize_rejects_saved_constraint_type_mismatch():
    term = SimpleNamespace(
        term_id=7,
        start_date=date(2026, 7, 1),
        end_date=date(2026, 12, 31),
        working_days_json='["Monday","Tuesday","Wednesday","Thursday","Friday"]',
    )
    payload = {
        "constraint_type": "hard",
        "expression": {"kind": "forbid", "filter": {
            "kind": "atomic", "field": "day", "operator": "eq", "value": "Monday"
        }},
        "explanation": "No Monday classes",
    }
    import json
    db = Mock()

    def query_for(model):
        if model is AcademicTerm:
            return FakeQuery(first=term)
        if model is Constraint:
            return FakeQuery(all_rows=[
                SimpleNamespace(constraint_id=6, constraint_type="soft", parameters_json=json.dumps(payload))
            ])
        raise AssertionError(f"Unexpected database query after type mismatch: {model}")

    db.query.side_effect = query_for
    with pytest.raises(HTTPException) as exc:
        optimize_semester(term_id=7, db=db)

    assert exc.value.status_code == 409
    assert "Saved dynamic constraint 6 is invalid" in exc.value.detail
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


def _persistence_db(monkeypatch, solver_result):
    from app.models.calendar import CalendarEvent
    from app.models.models import Room, Subject, Teacher, TeacherAvailability, TeacherSubject, TimeSlot
    from app.models.semester import ScheduledSession, TimetableVersion
    import app.api.semester_optimize as api

    term = SimpleNamespace(
        term_id=7,
        start_date=date(2026, 7, 1),
        end_date=date(2026, 7, 7),
        working_days_json='["Wednesday"]',
    )
    rows = {
        AcademicTerm: FakeQuery(first=term),
        Constraint: FakeQuery(count=0),
        AcademicGroup: FakeQuery(all_rows=[]),
        TimeSlot: FakeQuery(all_rows=[SimpleNamespace(slot_id=1, day="Wednesday", period_number=1)]),
        Subject: FakeQuery(all_rows=[SimpleNamespace(subject_id=2, class_id=3, periods_per_week=1, subject_type="theory")]),
        Teacher: FakeQuery(all_rows=[SimpleNamespace(teacher_id=4, max_periods_per_day=6)]),
        Room: FakeQuery(all_rows=[SimpleNamespace(room_id=5, room_type="classroom")]),
        CalendarEvent: FakeQuery(all_rows=[]),
        TeacherAvailability: FakeQuery(all_rows=[]),
        TeacherSubject: FakeQuery(all_rows=[SimpleNamespace(teacher_id=4, subject_id=2)]),
        TimetableVersion: FakeQuery(first=None),
    }
    db = Mock()
    db.query.side_effect = lambda model: rows[model]
    added = []
    db.add.side_effect = added.append
    def flush():
        for obj in added:
            if isinstance(obj, TimetableVersion):
                obj.version_id = 70
    db.flush.side_effect = flush
    def refresh(version):
        version.sessions = [
            obj for obj in added if isinstance(obj, ScheduledSession)
        ]
        for index, session in enumerate(version.sessions, start=1):
            session.session_id = index
    db.refresh.side_effect = refresh
    monkeypatch.setattr(api, "solve_semester_schedule", lambda data, max_time_seconds: solver_result)
    return db, added


def test_optimize_saves_feasible_result_as_new_draft(monkeypatch):
    session = {
        "session_date": date(2026, 7, 1),
        "weekday": "Wednesday",
        "period_number": 1,
        "slot_id": 1,
        "class_id": 3,
        "subject_id": 2,
        "teacher_id": 4,
        "room_id": 5,
        "is_locked": False,
    }
    db, added = _persistence_db(
        monkeypatch,
        {"status": "feasible", "objective_value": 0, "sessions": [session]},
    )

    response = optimize_semester(term_id=7, created_by="tester", notes="test draft", db=db)

    versions = [obj for obj in added if isinstance(obj, __import__(
        "app.models.semester", fromlist=["TimetableVersion"]
    ).TimetableVersion)]
    saved_sessions = [obj for obj in added if isinstance(obj, __import__(
        "app.models.semester", fromlist=["ScheduledSession"]
    ).ScheduledSession)]
    assert len(versions) == 1
    assert versions[0].status == "draft"
    assert versions[0].version_number == 1
    assert versions[0].created_by == "tester"
    assert len(saved_sessions) == 1
    assert response["draft_only"] is True
    assert response["session_count"] == 1
    assert response["sessions"][0]["session_id"] == 1
    db.commit.assert_called_once()


def test_infeasible_result_does_not_persist_a_draft(monkeypatch):
    db, added = _persistence_db(
        monkeypatch,
        {"status": "infeasible", "reason": "locked session conflict", "sessions": []},
    )

    with pytest.raises(HTTPException) as exc:
        optimize_semester(term_id=7, db=db)

    assert exc.value.status_code == 409
    assert exc.value.detail["status"] == "infeasible"
    assert not added
    db.commit.assert_not_called()
