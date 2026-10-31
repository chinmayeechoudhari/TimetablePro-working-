from datetime import date
import pytest
from fastapi import HTTPException

from app.solver.semester_solver import solve_semester_schedule
from app.api.academic_subjects import _components_for


def _create_multi_slot_data(days=5, periods_per_day=4):
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"][:days]
    slots = []
    slot_id = 1
    for day in day_names:
        for p in range(1, periods_per_day + 1):
            slots.append({"slot_id": slot_id, "day": day, "period_number": p})
            slot_id += 1

    return {
        "start_date": date(2026, 10, 19),  # Monday
        "end_date": date(2026, 10, 23),    # Friday
        "working_days": set(day_names),
        "events": [],
        "slots": slots,
        "subjects": [
            {
                "subject_id": 10,
                "subject_name": "Operating Systems",
                "class_id": 100,
                "periods_per_week": 4,
                "total_hours": 4,
                "lecture_duration": 1,
                "subject_type": "theory",
            }
        ],
        "teachers": [{"teacher_id": 20, "max_periods_per_day": 6}],
        "rooms": [{"room_id": 30, "room_type": "classroom"}],
        "teacher_subjects": [(20, 10)],
        "unavailable_pairs": [],
        "locked_sessions": [],
    }


def test_total_hours_with_1h_duration_schedules_exact_hours_and_sessions():
    """A 4-hour subject with 1-hour duration should schedule exactly 4 sessions (4 hours)."""
    data = _create_multi_slot_data()
    data["subjects"][0]["total_hours"] = 4
    data["subjects"][0]["lecture_duration"] = 1

    result = solve_semester_schedule(data)
    assert result["status"] in {"optimal", "feasible"}
    assert len(result["sessions"]) == 4

    accounting = next(a for a in result["hour_accounting"] if a["subject_id"] == 10)
    assert accounting["total_required_hours"] == 4
    assert accounting["scheduled_hours"] == 4
    assert accounting["remaining_hours"] == 0
    assert accounting["lecture_duration"] == 1
    assert accounting["required_sessions"] == 4
    assert accounting["status"] == "complete"


def test_total_hours_with_2h_duration_schedules_consecutive_period_blocks():
    """A 4-hour subject with 2-hour duration should schedule 2 multi-period blocks (4 period records)."""
    data = _create_multi_slot_data()
    data["subjects"][0]["total_hours"] = 4
    data["subjects"][0]["lecture_duration"] = 2

    result = solve_semester_schedule(data)
    assert result["status"] in {"optimal", "feasible"}
    # 2 sessions * 2 periods each = 4 period records
    assert len(result["sessions"]) == 4

    accounting = next(a for a in result["hour_accounting"] if a["subject_id"] == 10)
    assert accounting["total_required_hours"] == 4
    assert accounting["scheduled_hours"] == 4
    assert accounting["remaining_hours"] == 0
    assert accounting["required_sessions"] == 2
    assert accounting["status"] == "complete"

    # Verify that sessions come in consecutive pairs (p, p+1) on the same date
    sessions_by_date = {}
    for s in result["sessions"]:
        sessions_by_date.setdefault(s["session_date"], []).append(s["period_number"])

    for d, periods in sessions_by_date.items():
        sorted_p = sorted(periods)
        assert len(sorted_p) % 2 == 0, f"Expected even number of periods for 2h blocks on {d}, got {periods}"
        for i in range(0, len(sorted_p), 2):
            assert sorted_p[i + 1] == sorted_p[i] + 1, f"Expected consecutive periods in block on {d}, got {sorted_p}"


def test_2h_lecture_never_crosses_teacher_unavailability():
    """If a teacher is unavailable for period 2, a 2h lecture starting at period 1 cannot be scheduled."""
    data = _create_multi_slot_data(days=1, periods_per_day=3)
    # Only Monday is available with periods 1, 2, 3 (slot_ids 1, 2, 3)
    data["end_date"] = date(2026, 10, 19)
    data["subjects"][0]["total_hours"] = 2
    data["subjects"][0]["lecture_duration"] = 2

    # Block slot 2 (period 2) for teacher 20
    data["unavailable_pairs"] = [(20, 2)]

    # Candidate blocks:
    # (p1, p2) uses slot 1 and slot 2 -> blocked by slot 2
    # (p2, p3) uses slot 2 and slot 3 -> blocked by slot 2
    # Therefore, no 2-hour block can fit on Monday!
    result = solve_semester_schedule(data)
    assert result["status"] in {"infeasible", "no_solution"}


def test_assessment_day_suppresses_lectures_without_triggering_holiday_makeups():
    """Assessment day (is_closure=False, suppresses_lectures=True) blocks regular lectures but does not create holiday makeups."""
    data = _create_multi_slot_data()
    # Wednesday is an assessment day
    data["events"] = [{
        "start_date": date(2026, 10, 21),
        "end_date": date(2026, 10, 21),
        "is_closure": False,
        "suppresses_lectures": True,
        "is_working_day_override": None,
    }]
    data["subjects"][0]["total_hours"] = 4
    data["subjects"][0]["lecture_duration"] = 1

    result = solve_semester_schedule(data)
    assert result["status"] in {"optimal", "feasible"}
    # Verify no session scheduled on Wednesday
    assert all(s["session_date"] != date(2026, 10, 21) for s in result["sessions"])
    # Assessment day does not produce makeups
    assert result.get("makeups_scheduled", 0) == 0


def test_closure_day_triggers_holiday_makeup_optimization():
    """Full closure (is_closure=True) displaces sessions and triggers holiday makeup scheduling."""
    data = _create_multi_slot_data(days=5, periods_per_day=2)
    data["end_date"] = date(2026, 10, 30)  # 2 weeks
    # Monday of week 1 is closed
    data["events"] = [{
        "start_date": date(2026, 10, 19),
        "end_date": date(2026, 10, 19),
        "is_closure": True,
        "suppresses_lectures": False,
        "is_working_day_override": None,
    }]
    data["subjects"][0]["total_hours"] = 6
    data["subjects"][0]["lecture_duration"] = 1

    result = solve_semester_schedule(data)
    assert result["status"] in {"optimal", "feasible"}
    assert len(result["sessions"]) == 6
    assert all(s["session_date"] != date(2026, 10, 19) for s in result["sessions"])


def test_incompatible_hours_and_duration_rejected_by_api():
    """Subject configuration with indivisible hours must be rejected."""
    # 45 total hours with 2-hour duration (45 % 2 != 0)
    with pytest.raises(HTTPException) as exc_info:
        _components_for(
            subject_type="theory",
            periods_per_week=3,
            theory_periods_per_week=None,
            lab_periods_per_week=None,
            total_hours=45,
            lecture_duration=2,
        )
    assert exc_info.value.status_code == 400
    assert "must be evenly divisible by session duration" in exc_info.value.detail


def test_idempotent_semester_optimization():
    """Running optimization repeatedly on identical inputs yields consistent hours and no duplicate sessions."""
    data = _create_multi_slot_data()
    data["subjects"][0]["total_hours"] = 3
    data["subjects"][0]["lecture_duration"] = 1

    run1 = solve_semester_schedule(data)
    run2 = solve_semester_schedule(data)

    assert run1["status"] in {"optimal", "feasible"}
    assert run2["status"] in {"optimal", "feasible"}
    assert len(run1["sessions"]) == len(run2["sessions"]) == 3
    acc1 = next(a for a in run1["hour_accounting"] if a["subject_id"] == 10)
    acc2 = next(a for a in run2["hour_accounting"] if a["subject_id"] == 10)
    assert acc1["scheduled_hours"] == acc2["scheduled_hours"] == 3
