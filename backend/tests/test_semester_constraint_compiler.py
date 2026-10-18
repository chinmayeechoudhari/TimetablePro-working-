from datetime import date

import pytest
from ortools.sat.python import cp_model

from app.constraints.schemas import GeneratedConstraint
from app.constraints.semester_compiler import compile_semester_constraint
from app.solver.semester_solver import solve_semester_schedule


def _constraint(payload):
    return GeneratedConstraint.model_validate(payload)


def _fixture():
    model = cp_model.CpModel()
    keys = [
        (date(2026, 7, 6), 1, 10, 20, 30, 40),
        (date(2026, 7, 6), 2, 10, 20, 30, 40),
        (date(2026, 7, 13), 1, 10, 20, 30, 40),
    ]
    assign = {key: model.NewBoolVar(f"a{i}") for i, key in enumerate(keys)}
    data = {
        "slot_period": {1: 1, 2: 2},
        "room_types": {40: "classroom"},
        "subject_types": {20: "theory"},
    }
    return model, assign, data


def test_forbid_day_applies_to_every_matching_date():
    model, assign, data = _fixture()
    constraint = _constraint({
        "constraint_type": "hard",
        "expression": {"kind": "forbid", "filter": {
            "kind": "atomic", "field": "day", "operator": "eq", "value": "Monday"
        }},
        "explanation": "No Monday sessions",
    })
    compile_semester_constraint(model, assign, constraint, data)
    model.Add(sum(assign.values()) == 1)
    assert cp_model.CpSolver().Solve(model) == cp_model.INFEASIBLE


def test_no_adjacent_is_scoped_to_same_calendar_date():
    model, assign, data = _fixture()
    constraint = _constraint({
        "constraint_type": "hard",
        "expression": {"kind": "no_adjacent", "filter": {
            "kind": "atomic", "field": "teacher", "operator": "eq", "value": 30
        }},
        "explanation": "No consecutive periods",
    })
    compile_semester_constraint(model, assign, constraint, data)
    model.Add(assign[(date(2026, 7, 6), 1, 10, 20, 30, 40)] == 1)
    model.Add(assign[(date(2026, 7, 6), 2, 10, 20, 30, 40)] == 1)
    assert cp_model.CpSolver().Solve(model) == cp_model.INFEASIBLE


def test_no_adjacent_does_not_confuse_same_periods_on_different_dates():
    model, assign, data = _fixture()
    constraint = _constraint({
        "constraint_type": "hard",
        "expression": {"kind": "no_adjacent", "filter": {
            "kind": "atomic", "field": "teacher", "operator": "eq", "value": 30
        }},
        "explanation": "No consecutive periods",
    })
    compile_semester_constraint(model, assign, constraint, data)
    model.Add(assign[(date(2026, 7, 6), 1, 10, 20, 30, 40)] == 1)
    model.Add(assign[(date(2026, 7, 13), 1, 10, 20, 30, 40)] == 1)
    assert cp_model.CpSolver().Solve(model) == cp_model.OPTIMAL


def _solver_data(dynamic_constraints):
    return {
        "start_date": date(2026, 7, 6),
        "end_date": date(2026, 7, 6),
        "working_days": {"Monday"},
        "events": [],
        "slots": [{"slot_id": 1, "day": "Monday", "period_number": 1}],
        "subjects": [{"subject_id": 20, "class_id": 10, "periods_per_week": 1, "subject_type": "theory"}],
        "teachers": [{"teacher_id": 30, "max_periods_per_day": 6}],
        "rooms": [{"room_id": 40, "room_type": "classroom"}],
        "teacher_subjects": [(30, 20)],
        "unavailable_pairs": [],
        "dynamic_constraints": dynamic_constraints,
        "slot_period": {1: 1},
        "room_types": {40: "classroom"},
        "subject_types": {20: "theory"},
    }


def test_solver_enforces_saved_hard_constraint():
    constraint = _constraint({
        "constraint_type": "hard",
        "expression": {"kind": "forbid", "filter": {
            "kind": "atomic", "field": "day", "operator": "eq", "value": "Monday"
        }},
        "explanation": "No Monday classes",
    })
    result = solve_semester_schedule(_solver_data([constraint]))
    assert result["status"] == "infeasible"
    assert result["sessions"] == []



def test_solver_makes_up_closed_week_load_in_another_week():
    data = _solver_data([])
    data.update({
        "start_date": date(2026, 7, 6),
        "end_date": date(2026, 7, 13),
        "events": [{
            "start_date": date(2026, 7, 6),
            "end_date": date(2026, 7, 6),
            "is_closure": True,
        }],
        "slots": [
            {"slot_id": 1, "day": "Monday", "period_number": 1},
            {"slot_id": 2, "day": "Monday", "period_number": 2},
        ],
        "slot_period": {1: 1, 2: 2},
    })
    result = solve_semester_schedule(data)
    assert result["status"] in {"optimal", "feasible"}
    assert len(result["sessions"]) == 2
    assert {session["date"] for session in result["sessions"]} == {date(2026, 7, 13)}
    assert {session["period_number"] for session in result["sessions"]} == {1, 2}



def test_solver_respects_multi_day_calendar_closure():
    data = _solver_data([])
    data.update({
        "start_date": date(2026, 7, 6),
        "end_date": date(2026, 7, 20),
        "events": [{
            "start_date": date(2026, 7, 6),
            "end_date": date(2026, 7, 13),
            "is_closure": True,
            "is_working_day_override": False,
        }],
        "slots": [{"slot_id": 1, "day": "Monday", "period_number": 1}],
    })
    result = solve_semester_schedule(data)
    assert result["status"] in {"optimal", "feasible"}
    assert result["sessions"]
    assert all(
        session["session_date"] not in {date(2026, 7, 6), date(2026, 7, 13)}
        for session in result["sessions"]
    )


def test_explicit_working_day_override_allows_date_despite_closure():
    data = _solver_data([])
    data.update({
        "events": [
            {
                "start_date": date(2026, 7, 6),
                "end_date": date(2026, 7, 6),
                "is_closure": True,
                "is_working_day_override": False,
            },
            {
                "start_date": date(2026, 7, 6),
                "end_date": date(2026, 7, 6),
                "is_closure": False,
                "is_working_day_override": True,
            },
        ],
    })
    result = solve_semester_schedule(data)
    assert result["status"] in {"optimal", "feasible"}
    assert len(result["sessions"]) == 1
    assert result["sessions"][0]["session_date"] == date(2026, 7, 6)


def test_solver_soft_constraint_produces_a_feasible_schedule():
    constraint = _constraint({
        "constraint_type": "soft",
        "weight": 3,
        "expression": {"kind": "forbid", "filter": {
            "kind": "atomic", "field": "day", "operator": "eq", "value": "Monday"
        }},
        "explanation": "Avoid Monday classes",
    })
    result = solve_semester_schedule(_solver_data([constraint]))
    assert result["status"] in {"optimal", "feasible"}
    assert len(result["sessions"]) == 1
    assert result["sessions"][0]["weekday"] == "Monday"
    assert result["objective_value"] >= 3
