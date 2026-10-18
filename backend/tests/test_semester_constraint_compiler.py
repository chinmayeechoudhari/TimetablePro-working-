from datetime import date

from ortools.sat.python import cp_model
from app.constraints.schemas import GeneratedConstraint
from app.constraints.semester_compiler import compile_semester_constraint


def _constraint(payload):
    return GeneratedConstraint.model_validate(payload)


def _fixture():
    model = cp_model.CpModel()
    keys = [
        (date(2026, 7, 6), 1, 10, 20, 30, 40),  # Monday period 1
        (date(2026, 7, 6), 2, 10, 20, 30, 40),  # Monday period 2
        (date(2026, 7, 13), 1, 10, 20, 30, 40), # following Monday, period 1
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
    solver = cp_model.CpSolver()
    assert solver.Solve(model) == cp_model.INFEASIBLE


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
