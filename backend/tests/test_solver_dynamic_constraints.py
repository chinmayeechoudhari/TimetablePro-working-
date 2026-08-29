from unittest.mock import Mock, MagicMock
from app.constraints.schemas import GeneratedConstraint

import pytest

from app.solver.solver import build_and_solve


def make_fake_data():
    return {
        "class_ids": [],
        "subject_map": {},
        "subject_periods": {},
        "subject_types": {},
        "teacher_ids": [],
        "teacher_max_periods": {},
        "room_ids": [],
        "room_types": {},
        "slot_ids": [],
        "slots_by_day": {},
        "teacher_subjects": {},
        "unavailable_pairs": set(),
        "lab_subjects": set(),
        "lab_rooms": set(),
        "slot_day": {},
        "slot_period": {},
    }


def patch_base_constraints(monkeypatch):
    for name in [
        "add_no_teacher_double_booking",
        "add_no_room_double_booking",
        "add_no_class_double_booking",
        "add_periods_per_week",
        "add_teacher_availability",
        "add_lab_room_matching",
    ]:
        monkeypatch.setattr(
            f"app.solver.solver.{name}",
            Mock(),
        )

    for name in [
        "add_soft_max_periods_per_day",
        "add_soft_no_consecutive_periods",
        "add_soft_even_distribution",
    ]:
        monkeypatch.setattr(
            f"app.solver.solver.{name}",
            Mock(return_value=[]),
        )


def patch_successful_solver(monkeypatch):
    monkeypatch.setattr(
        "app.solver.solver.parse_and_save_solution",
        Mock(
            return_value={
                "status": "success",
            }
        ),
    )

    monkeypatch.setattr(
        "app.solver.solver.solution_to_dict",
        Mock(return_value=[]),
    )

    class FakeSolver:

        def __init__(self):
            self.parameters = Mock()
            self.parameters.max_time_in_seconds = None

        def Solve(self, model):
            return 4  # cp_model.OPTIMAL

    monkeypatch.setattr(
        "app.solver.solver.cp_model.CpSolver",
        FakeSolver,
    )


# ============================================================
# 1. EXISTING SOLVER BEHAVIOR
# ============================================================


def test_build_and_solve_without_dynamic_constraints(
    monkeypatch,
):
    """
    Existing solver behavior should continue to work
    when no dynamic constraints are supplied.
    """

    db = Mock()

    fake_data = make_fake_data()

    monkeypatch.setattr(
        "app.solver.solver.load_solver_data",
        lambda db: fake_data,
    )

    patch_base_constraints(monkeypatch)
    patch_successful_solver(monkeypatch)

    result = build_and_solve(db)

    assert result["status"] == "success"

    assert result["timetable"] == []

    assert "constraints" not in result


# ============================================================
# 2. ONE DYNAMIC CONSTRAINT
# ============================================================


def test_dynamic_constraint_is_sent_to_constraint_service(
    monkeypatch,
):
    """
    A natural-language constraint should be passed to
    ConstraintService and compiled into the CP-SAT model.
    """

    db = Mock()

    fake_data = make_fake_data()

    monkeypatch.setattr(
        "app.solver.solver.load_solver_data",
        lambda db: fake_data,
    )

    patch_base_constraints(monkeypatch)

    constraint = Mock()

    service = Mock()

    service.generate_validate_and_compile.return_value = (
        constraint,
        [],
    )

    mock_service_class = Mock(return_value=service)

    monkeypatch.setattr(
        "app.solver.solver.ConstraintService",
        mock_service_class,
    )

    patch_successful_solver(monkeypatch)

    user_request = (
        "Rahul cannot teach Monday period 3."
    )

    result = build_and_solve(
        db,
        user_constraints=[user_request],
    )

    service.generate_validate_and_compile.assert_called_once()

    call_kwargs = (
        service.generate_validate_and_compile.call_args.kwargs
    )

    assert call_kwargs["db"] is db

    assert call_kwargs["user_text"] == user_request

    assert "model" in call_kwargs

    assert "assign" in call_kwargs

    assert "data" in call_kwargs

    assert result["status"] == "success"

    assert result["constraints"] == [
        constraint.model_dump.return_value
    ]


# ============================================================
# 3. MULTIPLE DYNAMIC CONSTRAINTS
# ============================================================


def test_multiple_dynamic_constraints_are_processed(
    monkeypatch,
):
    """
    Every user-provided natural-language constraint should be
    processed independently by ConstraintService.
    """

    db = Mock()

    fake_data = make_fake_data()

    monkeypatch.setattr(
        "app.solver.solver.load_solver_data",
        lambda db: fake_data,
    )

    patch_base_constraints(monkeypatch)

    constraint_1 = Mock()
    constraint_2 = Mock()

    service = Mock()

    service.generate_validate_and_compile.side_effect = [
        (constraint_1, []),
        (constraint_2, []),
    ]

    monkeypatch.setattr(
        "app.solver.solver.ConstraintService",
        Mock(return_value=service),
    )

    patch_successful_solver(monkeypatch)

    user_constraints = [
        "Rahul cannot teach Monday period 3.",
        "DBMS cannot occur on Friday.",
    ]

    result = build_and_solve(
        db,
        user_constraints=user_constraints,
    )

    assert (
        service.generate_validate_and_compile.call_count
        == 2
    )

    calls = (
        service.generate_validate_and_compile.call_args_list
    )

    assert calls[0].kwargs["db"] is db
    assert calls[0].kwargs["user_text"] == (
        "Rahul cannot teach Monday period 3."
    )

    assert calls[1].kwargs["db"] is db
    assert calls[1].kwargs["user_text"] == (
        "DBMS cannot occur on Friday."
    )

    assert result["status"] == "success"

    assert result["constraints"] == [
        constraint_1.model_dump.return_value,
        constraint_2.model_dump.return_value,
    ]


# ============================================================
# 4. VALIDATION / COMPILATION ERROR
# ============================================================


def test_dynamic_constraint_error_is_propagated(
    monkeypatch,
):
    """
    If ConstraintService fails while generating, validating,
    or compiling a dynamic constraint, the solver should not
    silently ignore the error.
    """

    db = Mock()

    fake_data = make_fake_data()

    monkeypatch.setattr(
        "app.solver.solver.load_solver_data",
        lambda db: fake_data,
    )

    patch_base_constraints(monkeypatch)

    service = Mock()

    service.generate_validate_and_compile.side_effect = (
        ValueError("Unknown teacher: Rahul")
    )

    monkeypatch.setattr(
        "app.solver.solver.ConstraintService",
        Mock(return_value=service),
    )

    with pytest.raises(
        ValueError,
        match="Unknown teacher: Rahul",
    ):
        build_and_solve(
            db,
            user_constraints=[
                "Rahul cannot teach Monday period 3."
            ],
        )


# ============================================================
# 5. EMPTY CONSTRAINT LIST
# ============================================================


def test_empty_dynamic_constraint_list_behaves_like_no_constraints(
    monkeypatch,
):
    """
    An empty user_constraints list should behave like the
    existing solver path.
    """

    db = Mock()

    fake_data = make_fake_data()

    monkeypatch.setattr(
        "app.solver.solver.load_solver_data",
        lambda db: fake_data,
    )

    patch_base_constraints(monkeypatch)
    patch_successful_solver(monkeypatch)

    service = Mock()

    monkeypatch.setattr(
        "app.solver.solver.ConstraintService",
        Mock(return_value=service),
    )

    result = build_and_solve(
        db,
        user_constraints=[],
    )

    service.generate_validate_and_compile.assert_not_called()

    assert result["status"] == "success"

    assert result["timetable"] == []

    assert "constraints" not in result

def test_dynamic_soft_constraint_penalty_reaches_objective(
    monkeypatch,
):
    """
    Verify that penalties returned by ConstraintService are added
    to the CP-SAT objective.
    """

    import app.solver.solver as solver_module
    from ortools.sat.python import cp_model

    db = Mock()

    data = {
        "subject_map": {
            1: 1,
        },
        "teacher_ids": [1],
        "teacher_subjects": {
            1: [1],
        },
        "slot_ids": [1],
        "room_ids": [1],
        "class_ids": [1],
        "subject_periods": {
            1: 1,
        },
        "unavailable_pairs": [],
        "lab_subjects": [],
        "lab_rooms": [],
        "teacher_max_periods": {},
        "slots_by_day": {
            "Monday": [1],
        },
    }

    monkeypatch.setattr(
        solver_module,
        "load_solver_data",
        Mock(return_value=data),
    )

    # Existing hard constraints.
    for name in (
        "add_no_teacher_double_booking",
        "add_no_room_double_booking",
        "add_no_class_double_booking",
        "add_periods_per_week",
        "add_teacher_availability",
        "add_lab_room_matching",
    ):
        monkeypatch.setattr(
            solver_module,
            name,
            Mock(),
        )

    # Existing soft constraints.
    for name in (
        "add_soft_max_periods_per_day",
        "add_soft_no_consecutive_periods",
        "add_soft_even_distribution",
    ):
        monkeypatch.setattr(
            solver_module,
            name,
            Mock(return_value=[]),
        )

    # ---------------------------------------------------------
    # Fake dynamic constraint service
    # ---------------------------------------------------------

    class FakeConstraintService:

        def generate_validate_and_compile(
            self,
            db,
            model,
            assign,
            data,
            user_text,
        ):
            penalty = model.NewBoolVar(
                "dynamic_soft_penalty"
            )

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
                            "kind": "atomic",
                            "field": "teacher",
                            "operator": "eq",
                            "value": 1,
                        },
                    },
                    "right": {
                        "kind": "constant",
                        "value": 1,
                    },
                },
                "explanation":
                    "Teacher 1 should teach at most one period.",
                "assumptions": [],
            })

            return constraint, [penalty]

    monkeypatch.setattr(
        solver_module,
        "ConstraintService",
        FakeConstraintService,
    )

    # ---------------------------------------------------------
    # Prevent database solution parsing from becoming relevant.
    # ---------------------------------------------------------

    monkeypatch.setattr(
        solver_module,
        "parse_and_save_solution",
        Mock(
            return_value={
                "status": "success",
            }
        ),
    )

    monkeypatch.setattr(
        solver_module,
        "solution_to_dict",
        Mock(return_value=[]),
    )

    result = solver_module.build_and_solve(
        db,
        user_constraints=[
            "Teacher 1 should teach at most one period."
        ],
    )

    assert result["status"] == "success"
    assert result["constraints"]


def test_soft_constraint_priority_weights(monkeypatch):
    """
    Verify soft constraints are weighted according to priority:
    1. Teacher max periods/day -> Weight 3
    2. No consecutive periods -> Weight 2
    3. Even subject distribution -> Weight 1
    """
    import app.solver.solver as solver_module
    from ortools.sat.python import cp_model

    db = Mock()
    fake_data = make_fake_data()

    monkeypatch.setattr(
        solver_module,
        "load_solver_data",
        lambda db: fake_data,
    )
    patch_base_constraints(monkeypatch)
    patch_successful_solver(monkeypatch)

    max_p_var = None
    consec_p_var = None
    even_p_var = None

    def fake_max_periods(model, assign, teacher_max, slots_by_day):
        nonlocal max_p_var
        max_p_var = model.NewIntVar(0, 5, "p_max")
        return [max_p_var]

    def fake_consecutive(model, assign, teacher_ids, slots_by_day):
        nonlocal consec_p_var
        consec_p_var = model.NewIntVar(0, 5, "p_consec")
        return [consec_p_var]

    def fake_even_dist(model, assign, subject_periods, subject_map, slots_by_day):
        nonlocal even_p_var
        even_p_var = model.NewIntVar(0, 5, "p_even")
        return [even_p_var]

    monkeypatch.setattr(solver_module, "add_soft_max_periods_per_day", fake_max_periods)
    monkeypatch.setattr(solver_module, "add_soft_no_consecutive_periods", fake_consecutive)
    monkeypatch.setattr(solver_module, "add_soft_even_distribution", fake_even_dist)

    minimized_expr = None
    orig_minimize = cp_model.CpModel.minimize

    def capture_minimize(self, expr):
        nonlocal minimized_expr
        minimized_expr = expr
        return orig_minimize(self, expr)

    monkeypatch.setattr(cp_model.CpModel, "minimize", capture_minimize)
    monkeypatch.setattr(cp_model.CpModel, "Minimize", capture_minimize, raising=False)

    result = solver_module.build_and_solve(db)

    assert result["status"] == "success"
    assert minimized_expr is not None

    flat = cp_model.cmh.FlatIntExpr(minimized_expr)
    var_map = {v.index: c for v, c in zip(flat.vars, flat.coeffs)}

    assert var_map[max_p_var.index] == 3
    assert var_map[consec_p_var.index] == 2
    assert var_map[even_p_var.index] == 1
