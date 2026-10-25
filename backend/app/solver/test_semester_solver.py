from datetime import date

from app.solver.semester_solver import solve_semester_schedule


def _base_data():
    return {
        "start_date": date(2026, 10, 19),  # Monday
        "end_date": date(2026, 10, 23),   # Friday
        "working_days": {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday"},
        "events": [],
        "slots": [
            {"slot_id": 1, "day": "Monday", "period_number": 1},
            {"slot_id": 2, "day": "Tuesday", "period_number": 1},
            {"slot_id": 3, "day": "Wednesday", "period_number": 1},
            {"slot_id": 4, "day": "Thursday", "period_number": 1},
            {"slot_id": 5, "day": "Friday", "period_number": 1},
        ],
        "subjects": [
            {"subject_id": 10, "class_id": 100, "periods_per_week": 2, "subject_type": "theory"},
        ],
        "teachers": [{"teacher_id": 20, "max_periods_per_day": 6}],
        "rooms": [{"room_id": 30, "room_type": "classroom"}],
        "teacher_subjects": [(20, 10)],
        "unavailable_pairs": [],
        "locked_sessions": [],
    }


def test_solves_exact_weekly_subject_target():
    result = solve_semester_schedule(_base_data())
    assert result["status"] in {"optimal", "feasible"}
    assert len(result["sessions"]) == 2
    assert all(item["class_id"] == 100 and item["subject_id"] == 10 for item in result["sessions"])


def test_approved_closure_removes_date_from_candidate_slots():
    data = _base_data()
    data["events"] = [{
        "start_date": date(2026, 10, 19),
        "end_date": date(2026, 10, 19),
        "is_closure": True,
        "is_working_day_override": None,
    }]
    result = solve_semester_schedule(data)
    assert result["status"] in {"optimal", "feasible"}
    assert len(result["sessions"]) == 2
    assert all(item["session_date"] != date(2026, 10, 19) for item in result["sessions"])


def test_partial_week_closure_can_make_up_sessions_in_later_semester_week():
    data = _base_data()
    data["end_date"] = date(2026, 10, 30)
    data["subjects"][0]["periods_per_week"] = 3
    data["events"] = [{
        "start_date": date(2026, 10, 19),
        "end_date": date(2026, 10, 21),
        "is_closure": True,
        "is_working_day_override": None,
    }]
    # Three original sessions were displaced by the three-day closure.
    data["makeup_preferences"] = [
        {"class_id": 100, "subject_id": 10, "original_date": date(2026, 10, 19)},
        {"class_id": 100, "subject_id": 10, "original_date": date(2026, 10, 20)},
        {"class_id": 100, "subject_id": 10, "original_date": date(2026, 10, 21)},
    ]

    result = solve_semester_schedule(data)

    assert result["status"] in {"optimal", "feasible"}
    assert len(result["sessions"]) == 6
    first_week = [s for s in result["sessions"] if s["session_date"] <= date(2026, 10, 25)]
    second_week = [s for s in result["sessions"] if s["session_date"] >= date(2026, 10, 26)]
    assert len(first_week) == 2
    assert len(second_week) == 4


def test_reports_unresolved_makeup_when_no_valid_capacity_remains():
    data = _base_data()
    data["end_date"] = date(2026, 10, 30)
    data["slots"] = [{"slot_id": 1, "day": "Monday", "period_number": 1}]
    data["subjects"][0]["periods_per_week"] = 1
    data["events"] = [{
        "start_date": date(2026, 10, 19),
        "end_date": date(2026, 10, 19),
        "is_closure": True,
        "is_working_day_override": None,
    }]
    data["makeup_preferences"] = [{
        "class_id": 100,
        "subject_id": 10,
        "original_date": date(2026, 10, 19),
        "preferred_date": None,
        "preferred_period": None,
        "event_id": 1,
    }]

    result = solve_semester_schedule(data)

    assert result["status"] in {"optimal", "feasible"}
    assert len(result["sessions"]) == 1
    assert result["unresolved_makeups"] == [{
        "class_id": 100,
        "subject_id": 10,
        "unresolved_count": 1,
        "reason": "No additional eligible date/period remained inside the semester after applying hard constraints.",
    }]


def test_teacher_unavailability_is_respected():
    data = _base_data()
    data["unavailable_pairs"] = [(20, 1), (20, 2)]
    result = solve_semester_schedule(data)
    assert result["status"] in {"optimal", "feasible"}
    assert len(result["sessions"]) == 2
    assert all((item["teacher_id"], item["slot_id"]) not in data["unavailable_pairs"] for item in result["sessions"])


def test_infeasible_when_week_has_too_few_available_slots():
    data = _base_data()
    data["slots"] = data["slots"][:1]
    result = solve_semester_schedule(data)
    assert result["status"] == "infeasible"
    assert result["sessions"] == []


def test_locked_session_is_kept_in_solution():
    data = _base_data()
    data["locked_sessions"] = [{
        "session_date": date(2026, 10, 19),
        "slot_id": 1,
        "period_number": 1,
        "class_id": 100,
        "subject_id": 10,
        "teacher_id": 20,
        "room_id": 30,
        "is_locked": True,
    }]
    result = solve_semester_schedule(data)
    assert result["status"] in {"optimal", "feasible"}
    locked = [item for item in result["sessions"] if item["is_locked"]]
    assert len(locked) == 1
    assert locked[0]["session_date"] == date(2026, 10, 19)


def test_locked_session_on_closed_date_reports_conflict():
    data = _base_data()
    data["events"] = [{
        "start_date": date(2026, 10, 19),
        "end_date": date(2026, 10, 19),
        "is_closure": True,
        "is_working_day_override": None,
    }]
    data["locked_sessions"] = [{
        "session_date": date(2026, 10, 19),
        "slot_id": 1,
        "period_number": 1,
        "class_id": 100,
        "subject_id": 10,
        "teacher_id": 20,
        "room_id": 30,
        "is_locked": True,
    }]
    result = solve_semester_schedule(data)
    assert result["status"] == "infeasible"
    assert result["locked_conflicts"] == ["2026-10-19"]


def test_working_day_override_allows_scheduling_on_closed_weekday():
    data = _base_data()
    data["events"] = [{
        "start_date": date(2026, 10, 19),
        "end_date": date(2026, 10, 19),
        "is_closure": True,
        "is_working_day_override": True,
    }]
    data["slots"] = data["slots"][:2]
    result = solve_semester_schedule(data)
    assert result["status"] in {"optimal", "feasible"}
    assert len(result["sessions"]) == 2


def test_lab_subject_uses_only_lab_room():
    data = _base_data()
    data["subjects"][0]["subject_type"] = "lab"
    data["rooms"] = [
        {"room_id": 30, "room_type": "classroom"},
        {"room_id": 31, "room_type": "lab"},
    ]
    result = solve_semester_schedule(data)
    assert result["status"] in {"optimal", "feasible"}
    assert len(result["sessions"]) == 2
    assert all(item["room_id"] == 31 for item in result["sessions"])


def test_duplicate_slot_records_cannot_create_same_period_collision():
    data = _base_data()
    data["slots"].append({"slot_id": 6, "day": "Monday", "period_number": 1})
    result = solve_semester_schedule(data)
    assert result["status"] in {"optimal", "feasible"}
    occupied = [
        (item["session_date"], item["period_number"], item["class_id"])
        for item in result["sessions"]
    ]
    assert len(occupied) == len(set(occupied))
