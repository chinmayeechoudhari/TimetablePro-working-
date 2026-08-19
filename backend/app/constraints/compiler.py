from __future__ import annotations

from typing import Any

from ortools.sat.python import cp_model

from app.constraints.schemas import (
    GeneratedConstraint,
    Expression,
    Condition,
)


# ============================================================
# PUBLIC ENTRY POINT
# ============================================================

def compile_constraint(
    model: cp_model.CpModel,
    assign: dict,
    constraint: GeneratedConstraint,
    data: dict,
) -> list:
    """
    Convert a validated GeneratedConstraint into CP-SAT constraints.

    Returns:
        A list of penalty variables.

    For hard constraints:
        constraints are added directly to the model.

    For soft constraints:
        violation variables are returned so the solver can minimize them.
    """

    penalties = []

    expression = constraint.expression

    if expression.kind == "comparison":
        penalties.extend(
            _compile_comparison(
                model=model,
                assign=assign,
                expression=expression,
                constraint_type=constraint.constraint_type,
                data=data,
            )
        )

    elif expression.kind == "forbid":
        _compile_forbid(
            model=model,
            assign=assign,
            expression=expression,
            data=data,
        )

    elif expression.kind == "exists":
        penalties.extend(
            _compile_exists(
                model=model,
                assign=assign,
                expression=expression,
                constraint_type=constraint.constraint_type,
                data=data,
            )
        )

    elif expression.kind == "no_adjacent":
        penalties.extend(
            _compile_no_adjacent(
                model=model,
                assign=assign,
                expression=expression,
                constraint_type=constraint.constraint_type,
                data=data,
            )
        )

    elif expression.kind == "for_each":
        raise NotImplementedError(
            "for_each constraints are not supported yet."
        )

    else:
        raise ValueError(
            f"Unsupported expression kind: {expression.kind}"
        )

    return penalties


# ============================================================
# CONDITION → ASSIGNMENT VARIABLES
# ============================================================

def _matching_variables(
    assign: dict,
    condition: Condition,
    data: dict,
) -> list:
    """
    Return all CP-SAT assignment variables satisfying a condition.
    """

    if condition.kind == "atomic":
        return _matching_atomic_variables(
            assign,
            condition.field,
            condition.operator,
            condition.value,
            data,
        )

    if condition.kind == "and":
        condition_sets = [
            set(
                _matching_variables(
                    assign,
                    child,
                    data,
                )
            )
            for child in condition.conditions
        ]

        if not condition_sets:
            return []

        result = condition_sets[0]

        for current in condition_sets[1:]:
            result &= current

        return list(result)

    if condition.kind == "or":
        result = set()

        for child in condition.conditions:
            result.update(
                _matching_variables(
                    assign,
                    child,
                    data,
                )
            )

        return list(result)

    if condition.kind == "not":
        all_variables = set(assign.values())

        matching = set(
            _matching_variables(
                assign,
                condition.condition,
                data,
            )
        )

        return list(all_variables - matching)

    raise ValueError(
        f"Unsupported condition kind: {condition.kind}"
    )


# ============================================================
# ATOMIC CONDITIONS
# ============================================================

def _matching_atomic_variables(
    assign: dict,
    field: str,
    operator: str,
    value: Any,
    data: dict,
) -> list:

    result = []

    for (
        class_id,
        subject_id,
        teacher_id,
        slot_id,
        room_id,
    ), variable in assign.items():

        actual_value = _get_field_value(
            field=field,
            class_id=class_id,
            subject_id=subject_id,
            teacher_id=teacher_id,
            slot_id=slot_id,
            room_id=room_id,
            data=data,
        )

        if _compare(actual_value, operator, value):
            result.append(variable)

    return result


def _get_field_value(
    field: str,
    class_id: int,
    subject_id: int,
    teacher_id: int,
    slot_id: int,
    room_id: int,
    data: dict,
):
    """
    Convert an assignment tuple into the value represented
    by an atomic condition.
    """

    if field == "teacher":
        return teacher_id

    if field == "subject":
        return subject_id

    if field == "class":
        return class_id

    if field == "room":
        return room_id

    if field == "slot":
        return slot_id

    if field == "day":
        return data["slot_day"][slot_id]

    if field == "period":
        return data["slot_period"][slot_id]

    if field == "room_type":
        return data["room_types"][room_id]

    if field == "subject_type":
        return data["subject_types"][subject_id]

    raise ValueError(
        f"Unsupported condition field: {field}"
    )


# ============================================================
# COMPARISON
# ============================================================

def _compile_comparison(
    model,
    assign,
    expression,
    constraint_type,
    data,
):
    """
    Compile:

        COUNT(filter) <= constant

    or similar comparison.
    """

    left = expression.left
    right = expression.right

    if left.kind != "count":
        raise NotImplementedError(
            "Currently only COUNT expressions are supported on the left side."
        )

    if right.kind != "constant":
        raise NotImplementedError(
            "Currently only constant values are supported on the right side."
        )

    variables = _matching_variables(
        assign,
        left.filter,
        data,
    )

    count = sum(variables) if variables else 0
    limit = right.value

    operator = expression.operator

    if constraint_type == "hard":

        if operator == "eq":
            model.Add(count == limit)

        elif operator == "neq":
            model.Add(count != limit)

        elif operator == "lt":
            model.Add(count < limit)

        elif operator == "lte":
            model.Add(count <= limit)

        elif operator == "gt":
            model.Add(count > limit)

        elif operator == "gte":
            model.Add(count >= limit)

        else:
            raise ValueError(
                f"Unsupported comparison operator: {operator}"
            )

        return []

    # --------------------------------------------------------
    # SOFT CONSTRAINTS
    # --------------------------------------------------------

    penalty = _create_comparison_penalty(
        model,
        count,
        operator,
        limit,
    )

    return [penalty]


# ============================================================
# SOFT COMPARISON PENALTY
# ============================================================

def _create_comparison_penalty(
    model,
    count,
    operator,
    limit,
):
    """
    Create an integer penalty representing violation severity.

    Penalty = 0  → constraint satisfied
    Penalty > 0 → constraint violated
    """

    if operator == "lte":

        upper_bound = max(0, int(limit) + 100)

        penalty = model.NewIntVar(
            0,
            upper_bound,
            "dynamic_penalty_lte",
        )

        model.Add(
            penalty >= count - limit
        )

        model.Add(
            penalty >= 0
        )

        return penalty

    if operator == "lt":

        upper_bound = max(0, int(limit) + 100)

        penalty = model.NewIntVar(
            0,
            upper_bound,
            "dynamic_penalty_lt",
        )

        model.Add(
            penalty >= count - (limit - 1)
        )

        return penalty

    if operator == "gte":

        upper_bound = max(0, int(limit) + 100)

        penalty = model.NewIntVar(
            0,
            upper_bound,
            "dynamic_penalty_gte",
        )

        model.Add(
            penalty >= limit - count
        )

        return penalty

    if operator == "gt":

        upper_bound = max(0, int(limit) + 100)

        penalty = model.NewIntVar(
            0,
            upper_bound,
            "dynamic_penalty_gt",
        )

        model.Add(
            penalty >= (limit + 1) - count
        )

        return penalty

    if operator == "eq":

        upper_bound = max(0, int(limit) + 100)

        penalty = model.NewIntVar(
            0,
            upper_bound,
            "dynamic_penalty_eq",
        )

        model.Add(
            penalty >= count - limit
        )

        model.Add(
            penalty >= limit - count
        )

        return penalty

    if operator == "neq":

        # For now, inequality soft constraints are intentionally
        # not automatically translated because their violation
        # semantics are different from <=, >= and ==.
        raise NotImplementedError(
            "Soft 'neq' constraints are not supported yet."
        )

    raise ValueError(
        f"Unsupported comparison operator: {operator}"
    )


# ============================================================
# FORBID
# ============================================================

def _compile_forbid(
    model,
    assign,
    expression,
    data,
):
    """
    Compile:

        forbid(filter)

    Example:

        Rahul cannot teach Monday period 3.
    """

    variables = _matching_variables(
        assign,
        expression.filter,
        data,
    )

    for variable in variables:
        model.Add(variable == 0)


# ============================================================
# EXISTS
# ============================================================

def _compile_exists(
    model,
    assign,
    expression,
    constraint_type,
    data,
):
    """
    Compile:

        COUNT(filter) >= 1
    """

    variables = _matching_variables(
        assign,
        expression.filter,
        data,
    )

    count = sum(variables) if variables else 0

    if constraint_type == "hard":

        model.Add(count >= 1)

        return []

    penalty = model.NewIntVar(
        0,
        1,
        "dynamic_exists_penalty",
    )

    model.Add(
        penalty >= 1 - count
    )

    return [penalty]


# ============================================================
# NO ADJACENT
# ============================================================

def _compile_no_adjacent(
    model,
    assign,
    expression,
    constraint_type,
    data,
):
    """
    Compile:

        No matching assignments may occur
        in consecutive periods.
    """

    penalties = []

    matching = _matching_variables(
        assign,
        expression.filter,
        data,
    )

    matching_set = set(matching)

    # Group assignment variables by teacher/day/period.
    # We use the original assignment keys to determine
    # consecutive periods.

    by_teacher_day = {}

    for (
        class_id,
        subject_id,
        teacher_id,
        slot_id,
        room_id,
    ), variable in assign.items():

        if variable not in matching_set:
            continue

        day = data["slot_day"][slot_id]
        period = data["slot_period"][slot_id]

        by_teacher_day.setdefault(
            (teacher_id, day),
            {}
        ).setdefault(
            period,
            []
        ).append(variable)

    for (
        teacher_id,
        day,
    ), periods in by_teacher_day.items():

        sorted_periods = sorted(periods.keys())

        for period in sorted_periods:

            next_period = period + 1

            if next_period not in periods:
                continue

            current_vars = periods[period]
            next_vars = periods[next_period]

            current_sum = sum(current_vars)
            next_sum = sum(next_vars)

            if constraint_type == "hard":

                model.Add(
                    current_sum + next_sum <= 1
                )

            else:

                penalty = model.NewIntVar(
                    0,
                    1,
                    f"dynamic_consecutive_penalty_{teacher_id}_{day}_{period}",
                )

                model.Add(
                    penalty >=
                    current_sum + next_sum - 1
                )

                penalties.append(penalty)

    return penalties


# ============================================================
# COMPARISON HELPER
# ============================================================

def _compare(
    actual,
    operator,
    expected,
):
    """
    Evaluate a normal Python comparison.

    Used only for identifying which assignment variables
    belong to a filter.
    """

    if operator == "eq":
        return actual == expected

    if operator == "neq":
        return actual != expected

    if operator == "lt":
        return actual < expected

    if operator == "lte":
        return actual <= expected

    if operator == "gt":
        return actual > expected

    if operator == "gte":
        return actual >= expected

    raise ValueError(
        f"Unsupported operator: {operator}"
    )