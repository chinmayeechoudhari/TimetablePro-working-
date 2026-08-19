from ortools.sat.python import cp_model

from app.constraints.compiler import compile_constraint
from app.constraints.schemas import GeneratedConstraint


def build_test_assignments():
    """
    Small fake timetable assignment space.

    Tuple:
        (class_id, subject_id, teacher_id, slot_id, room_id)
    """

    model = cp_model.CpModel()

    assign = {}

    # Teacher 1 = Rahul
    # Monday = slots 1, 2, 3, 4
    #
    # We create 4 possible Monday assignments for Rahul.

    for slot_id in range(1, 5):
        var = model.NewBoolVar(
            f"rahul_monday_{slot_id}"
        )

        assign[(1, 1, 1, slot_id, 1)] = var

    return model, assign


def build_test_data():
    return {
        "slot_day": {
            1: "Monday",
            2: "Monday",
            3: "Monday",
            4: "Monday",
        },
        "slot_period": {
            1: 1,
            2: 2,
            3: 3,
            4: 4,
        },
        "room_types": {
            1: "classroom",
        },
        "subject_types": {
            1: "theory",
        },
    }


def test_hard_teacher_daily_limit():
    model, assign = build_test_assignments()
    data = build_test_data()

    constraint = GeneratedConstraint.model_validate({
        "constraint_type": "hard",
        "weight": None,
        "expression": {
            "kind": "comparison",
            "operator": "lte",

            "left": {
                "kind": "count",
                "source": "assignments",

                "filter": {
                    "kind": "and",
                    "conditions": [
                        {
                            "kind": "atomic",
                            "field": "teacher",
                            "operator": "eq",
                            "value": 1,
                        },
                        {
                            "kind": "atomic",
                            "field": "day",
                            "operator": "eq",
                            "value": "Monday",
                        },
                    ],
                },
            },

            "right": {
                "kind": "constant",
                "value": 3,
            },
        },

        "explanation":
            "Rahul must teach at most 3 periods on Monday.",

        "assumptions": [],
    })

    penalties = compile_constraint(
        model=model,
        assign=assign,
        constraint=constraint,
        data=data,
    )

    assert penalties == []

    solver = cp_model.CpSolver()

    status = solver.Solve(model)

    assert status in (
        cp_model.OPTIMAL,
        cp_model.FEASIBLE,
    )


def test_hard_constraint_rejects_four_assignments():
    model, assign = build_test_assignments()
    data = build_test_data()

    constraint = GeneratedConstraint.model_validate({
        "constraint_type": "hard",
        "weight": None,

        "expression": {
            "kind": "comparison",
            "operator": "lte",

            "left": {
                "kind": "count",
                "source": "assignments",

                "filter": {
                    "kind": "and",
                    "conditions": [
                        {
                            "kind": "atomic",
                            "field": "teacher",
                            "operator": "eq",
                            "value": 1,
                        },
                        {
                            "kind": "atomic",
                            "field": "day",
                            "operator": "eq",
                            "value": "Monday",
                        },
                    ],
                },
            },

            "right": {
                "kind": "constant",
                "value": 3,
            },
        },

        "explanation":
            "Rahul must teach at most 3 periods on Monday.",

        "assumptions": [],
    })

    compile_constraint(
        model=model,
        assign=assign,
        constraint=constraint,
        data=data,
    )

    # Force all four assignments to happen.
    for variable in assign.values():
        model.Add(variable == 1)

    solver = cp_model.CpSolver()

    status = solver.Solve(model)

    # Four assignments violates <= 3.
    assert status == cp_model.INFEASIBLE

def test_hard_forbid_constraint():
    model, assign = build_test_assignments()
    data = build_test_data()

    constraint = GeneratedConstraint.model_validate({
        "constraint_type": "hard",
        "weight": None,
        "expression": {
            "kind": "forbid",
            "filter": {
                "kind": "and",
                "conditions": [
                    {
                        "kind": "atomic",
                        "field": "teacher",
                        "operator": "eq",
                        "value": 1,
                    },
                    {
                        "kind": "atomic",
                        "field": "period",
                        "operator": "eq",
                        "value": 3,
                    },
                ],
            },
        },
        "explanation":
            "Rahul cannot teach period 3.",
        "assumptions": [],
    })

    penalties = compile_constraint(
        model=model,
        assign=assign,
        constraint=constraint,
        data=data,
    )

    assert penalties == []

    # Force period 3 assignment.
    model.Add(assign[(1, 1, 1, 3, 1)] == 1)

    solver = cp_model.CpSolver()

    status = solver.Solve(model)

    assert status == cp_model.INFEASIBLE
def test_hard_exists_constraint():
    model, assign = build_test_assignments()
    data = build_test_data()

    constraint = GeneratedConstraint.model_validate({
        "constraint_type": "hard",
        "weight": None,
        "expression": {
            "kind": "exists",
            "filter": {
                "kind": "and",
                "conditions": [
                    {
                        "kind": "atomic",
                        "field": "teacher",
                        "operator": "eq",
                        "value": 1,
                    },
                    {
                        "kind": "atomic",
                        "field": "day",
                        "operator": "eq",
                        "value": "Monday",
                    },
                ],
            },
        },
        "explanation":
            "Rahul must teach at least one period on Monday.",
        "assumptions": [],
    })

    penalties = compile_constraint(
        model=model,
        assign=assign,
        constraint=constraint,
        data=data,
    )

    assert penalties == []

    # Force every assignment off.
    for variable in assign.values():
        model.Add(variable == 0)

    solver = cp_model.CpSolver()

    status = solver.Solve(model)

    assert status == cp_model.INFEASIBLE
def test_hard_no_adjacent_constraint():
    model, assign = build_test_assignments()
    data = build_test_data()

    constraint = GeneratedConstraint.model_validate({
        "constraint_type": "hard",
        "weight": None,
        "expression": {
            "kind": "no_adjacent",
            "filter": {
                "kind": "atomic",
                "field": "teacher",
                "operator": "eq",
                "value": 1,
            },
        },
        "explanation":
            "Rahul cannot teach adjacent periods.",
        "assumptions": [],
    })

    penalties = compile_constraint(
        model=model,
        assign=assign,
        constraint=constraint,
        data=data,
    )

    assert penalties == []

    # Force consecutive periods 1 and 2.
    model.Add(assign[(1, 1, 1, 1, 1)] == 1)
    model.Add(assign[(1, 1, 1, 2, 1)] == 1)

    solver = cp_model.CpSolver()

    status = solver.Solve(model)

    assert status == cp_model.INFEASIBLE
def test_soft_lte_constraint_creates_penalty():
    model, assign = build_test_assignments()
    data = build_test_data()

    constraint = GeneratedConstraint.model_validate({
        "constraint_type": "soft",
        "weight": 10,
        "expression": {
            "kind": "comparison",
            "operator": "lte",
            "left": {
                "kind": "count",
                "source": "assignments",
                "filter": {
                    "kind": "and",
                    "conditions": [
                        {
                            "kind": "atomic",
                            "field": "teacher",
                            "operator": "eq",
                            "value": 1,
                        },
                        {
                            "kind": "atomic",
                            "field": "day",
                            "operator": "eq",
                            "value": "Monday",
                        },
                    ],
                },
            },
            "right": {
                "kind": "constant",
                "value": 3,
            },
        },
        "explanation":
            "Rahul should teach at most 3 periods on Monday.",
        "assumptions": [],
    })

    penalties = compile_constraint(
        model=model,
        assign=assign,
        constraint=constraint,
        data=data,
    )

    assert len(penalties) == 1
def test_soft_lte_penalty_is_active_when_violated():
    model, assign = build_test_assignments()
    data = build_test_data()

    constraint = GeneratedConstraint.model_validate({
        "constraint_type": "soft",
        "weight": 10,
        "expression": {
            "kind": "comparison",
            "operator": "lte",
            "left": {
                "kind": "count",
                "source": "assignments",
                "filter": {
                    "kind": "and",
                    "conditions": [
                        {
                            "kind": "atomic",
                            "field": "teacher",
                            "operator": "eq",
                            "value": 1,
                        },
                        {
                            "kind": "atomic",
                            "field": "day",
                            "operator": "eq",
                            "value": "Monday",
                        },
                    ],
                },
            },
            "right": {
                "kind": "constant",
                "value": 3,
            },
        },
        "explanation":
            "Rahul should teach at most 3 periods on Monday.",
        "assumptions": [],
    })

    penalties = compile_constraint(
        model=model,
        assign=assign,
        constraint=constraint,
        data=data,
    )

    assert len(penalties) == 1

    # Force all four assignments.
    for variable in assign.values():
        model.Add(variable == 1)

    solver = cp_model.CpSolver()
    status = solver.Solve(model)

    assert status in (
        cp_model.OPTIMAL,
        cp_model.FEASIBLE,
    )

    # The soft constraint is violated, so its penalty
    # variable should be active.
    assert solver.Value(penalties[0]) == 1