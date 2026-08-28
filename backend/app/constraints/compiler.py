from __future__ import annotations

from typing import Any

from ortools.sat.python import cp_model

from app.constraints.schemas import GeneratedConstraint, Condition
from app.constraints.resolver import (
    resolve_teacher,
    resolve_subject,
    resolve_subjects,
    resolve_class,
    resolve_room,
    parse_slot_value,
    resolve_slot,
)


def compile_constraint(model: cp_model.CpModel, assign: dict, constraint: GeneratedConstraint, data: dict) -> list:
    penalties = []
    expression = constraint.expression

    if expression.kind == "comparison":
        penalties.extend(_compile_comparison(model, assign, expression, constraint.constraint_type, data))
    elif expression.kind == "forbid":
        _compile_forbid(model, assign, expression, data)
    elif expression.kind == "exists":
        penalties.extend(_compile_exists(model, assign, expression, constraint.constraint_type, data))
    elif expression.kind == "no_adjacent":
        penalties.extend(_compile_no_adjacent(model, assign, expression, constraint.constraint_type, data))
    elif expression.kind == "for_each":
        penalties.extend(_compile_for_each(model, assign, expression, constraint.constraint_type, data))
    else:
        raise ValueError(f"Unsupported expression kind: {expression.kind}")

    return penalties


def _matching_variables(assign: dict, condition: Condition, data: dict) -> list:
    if condition.kind == "atomic":
        return _matching_atomic_variables(assign, condition.field, condition.operator, condition.value, data)

    if condition.kind == "and":
        sets = [set(_matching_variables(assign, child, data)) for child in condition.conditions]
        if not sets:
            return []
        result = sets[0]
        for current in sets[1:]:
            result &= current
        return list(result)

    if condition.kind == "or":
        result = set()
        for child in condition.conditions:
            result.update(_matching_variables(assign, child, data))
        return list(result)

    if condition.kind == "not":
        all_variables = set(assign.values())
        matching = set(_matching_variables(assign, condition.condition, data))
        return list(all_variables - matching)

    raise ValueError(f"Unsupported condition kind: {condition.kind}")


def _matching_atomic_variables(assign: dict, field: str, operator: str, value: Any, data: dict) -> list:
    expected_values = _resolve_expected_values(field, value, data)
    result = []

    for (class_id, subject_id, teacher_id, slot_id, room_id), variable in assign.items():
        actual = _get_field_value(field, class_id, subject_id, teacher_id, slot_id, room_id, data)
        if any(_compare(actual, operator, expected) for expected in expected_values):
            result.append(variable)

    return result


def _resolve_expected_value(field: str, value: Any, data: dict) -> Any:
    """Translate Gemini's human-readable entity values into solver IDs."""

    db = data.get("db")

    # Existing unit tests use integer IDs directly and don't provide a DB.
    if db is None:
        if field == "period":
            try:
                return int(value)
            except (TypeError, ValueError):
                return value
        return value

    if field == "teacher":
        return resolve_teacher(db, str(value)).teacher_id
    if field == "subject":
        return resolve_subject(db, str(value)).subject_id
    if field == "class":
        return resolve_class(db, str(value)).class_id
    if field == "room":
        return resolve_room(db, str(value)).room_id
    if field == "day":
        return str(value).strip()
    if field == "period":
        return int(value)
    if field == "slot":
        day, period = parse_slot_value(value)
        return resolve_slot(db, day, period).slot_id
    if field == "room_type":
        return str(value).strip().lower()
    if field == "subject_type":
        return str(value).strip().lower()
    return value


def _resolve_expected_values(field: str, value: Any, data: dict) -> list[Any]:
    """Return all valid IDs when an entity name is repeated across scopes."""
    db = data.get("db")
    if db is not None and field == "subject":
        return [subject.subject_id for subject in resolve_subjects(db, str(value))]
    return [_resolve_expected_value(field, value, data)]


def _get_field_value(field: str, class_id: int, subject_id: int, teacher_id: int, slot_id: int, room_id: int, data: dict):
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
    raise ValueError(f"Unsupported condition field: {field}")


def _make_count_var(model: cp_model.CpModel, variables: list, label: str) -> cp_model.IntVar:
    """
    Create a CP-SAT IntVar that equals the sum of the given Boolean/Int variables.
    Using LinearExpr.Sum avoids the Python-level sum() misuse on IntVar objects.
    """
    if not variables:
        # Return a fixed zero constant
        zero = model.NewIntVar(0, 0, f"{label}_zero")
        return zero
    upper = len(variables)
    count_var = model.NewIntVar(0, upper, label)
    model.Add(count_var == cp_model.LinearExpr.Sum(variables))
    return count_var


def _compile_comparison(model, assign, expression, constraint_type, data):
    left = expression.left
    right = expression.right
    if left.kind != "count":
        raise NotImplementedError("Currently only COUNT expressions are supported on the left side.")
    if right.kind != "constant":
        raise NotImplementedError("Currently only constant values are supported on the right side.")

    variables = _matching_variables(assign, left.filter, data)
    count_var = _make_count_var(model, variables, "dynamic_count")
    limit = int(right.value)
    operator = expression.operator

    if constraint_type == "hard":
        if operator == "eq": model.Add(count_var == limit)
        elif operator == "neq": model.Add(count_var != limit)
        elif operator == "lt": model.Add(count_var < limit)
        elif operator == "lte": model.Add(count_var <= limit)
        elif operator == "gt": model.Add(count_var > limit)
        elif operator == "gte": model.Add(count_var >= limit)
        else: raise ValueError(f"Unsupported comparison operator: {operator}")
        return []

    return [_create_comparison_penalty(model, count_var, operator, limit)]


def _create_comparison_penalty(model, count_var, operator, limit):
    upper_bound = max(0, int(limit) + 100)
    if operator == "lte":
        penalty = model.NewIntVar(0, upper_bound, "dynamic_penalty_lte")
        model.Add(penalty >= count_var - limit)
        model.Add(penalty >= 0)
        return penalty
    if operator == "lt":
        penalty = model.NewIntVar(0, upper_bound, "dynamic_penalty_lt")
        model.Add(penalty >= count_var - (limit - 1))
        model.Add(penalty >= 0)
        return penalty
    if operator == "gte":
        penalty = model.NewIntVar(0, upper_bound, "dynamic_penalty_gte")
        model.Add(penalty >= limit - count_var)
        model.Add(penalty >= 0)
        return penalty
    if operator == "gt":
        penalty = model.NewIntVar(0, upper_bound, "dynamic_penalty_gt")
        model.Add(penalty >= (limit + 1) - count_var)
        model.Add(penalty >= 0)
        return penalty
    if operator == "eq":
        penalty = model.NewIntVar(0, upper_bound, "dynamic_penalty_eq")
        model.Add(penalty >= count_var - limit)
        model.Add(penalty >= limit - count_var)
        return penalty
    if operator == "neq":
        raise NotImplementedError("Soft 'neq' constraints are not supported yet.")
    raise ValueError(f"Unsupported comparison operator: {operator}")


def _compile_forbid(model, assign, expression, data):
    for variable in _matching_variables(assign, expression.filter, data):
        model.Add(variable == 0)


def _compile_exists(model, assign, expression, constraint_type, data):
    variables = _matching_variables(assign, expression.filter, data)
    count_var = _make_count_var(model, variables, "dynamic_exists_count")
    if constraint_type == "hard":
        model.Add(count_var >= 1)
        return []
    penalty = model.NewIntVar(0, 1, "dynamic_exists_penalty")
    model.Add(penalty >= 1 - count_var)
    return [penalty]


def _compile_no_adjacent(model, assign, expression, constraint_type, data):
    penalties = []
    matching_set = set(_matching_variables(assign, expression.filter, data))
    by_teacher_day = {}

    for (class_id, subject_id, teacher_id, slot_id, room_id), variable in assign.items():
        if variable not in matching_set:
            continue
        day = data["slot_day"][slot_id]
        period = data["slot_period"][slot_id]
        by_teacher_day.setdefault((teacher_id, day), {}).setdefault(period, []).append(variable)

    for (teacher_id, day), periods in by_teacher_day.items():
        for period in sorted(periods):
            if period + 1 not in periods:
                continue
            # Build CP-SAT sum vars for consecutive period pairs
            current_vars = periods[period]
            next_vars = periods[period + 1]
            current_sum = _make_count_var(model, current_vars, f"adj_curr_{teacher_id}_{day}_{period}")
            next_sum = _make_count_var(model, next_vars, f"adj_next_{teacher_id}_{day}_{period}")
            if constraint_type == "hard":
                model.Add(current_sum + next_sum <= 1)
            else:
                penalty = model.NewIntVar(0, 1, f"dynamic_consecutive_penalty_{teacher_id}_{day}_{period}")
                model.Add(penalty >= current_sum + next_sum - 1)
                penalties.append(penalty)
    return penalties


def _compile_for_each(model, assign, expression, constraint_type, data):
    """
    Implement for_each by enumerating all unique values of the dimension
    in the assignment keys and applying the inner expression per value.
    """
    penalties = []
    dimension = expression.dimension
    inner = expression.expression

    # Collect all distinct dimension values from assign keys
    dim_values: set = set()
    for (class_id, subject_id, teacher_id, slot_id, room_id) in assign.keys():
        if dimension == "day":
            dim_values.add(data["slot_day"][slot_id])
        elif dimension == "teacher":
            dim_values.add(teacher_id)
        elif dimension == "subject":
            dim_values.add(subject_id)
        elif dimension == "class":
            dim_values.add(class_id)
        elif dimension == "room":
            dim_values.add(room_id)

    from app.constraints.schemas import AtomicCondition, AndCondition

    for dim_val in dim_values:
        # Build a filtered assign dict restricted to this dimension value
        dim_filter = _make_dim_filter(dimension, dim_val, data)
        filtered_assign = {
            key: var for key, var in assign.items()
            if _key_matches_dim(key, dimension, dim_val, data)
        }
        if not filtered_assign:
            continue

        # Compile inner expression on the restricted assign
        sub_penalties = _compile_inner_for_each(model, filtered_assign, inner, constraint_type, data)
        penalties.extend(sub_penalties)

    return penalties


def _key_matches_dim(key, dimension, dim_val, data):
    class_id, subject_id, teacher_id, slot_id, room_id = key
    if dimension == "day":
        return data["slot_day"][slot_id] == dim_val
    if dimension == "teacher":
        return teacher_id == dim_val
    if dimension == "subject":
        return subject_id == dim_val
    if dimension == "class":
        return class_id == dim_val
    if dimension == "room":
        return room_id == dim_val
    return False


def _make_dim_filter(dimension, dim_val, data):
    """Unused helper kept for clarity."""
    return {"dimension": dimension, "value": dim_val}


def _compile_inner_for_each(model, assign, expression, constraint_type, data):
    """Compile an inner expression for a single for_each dimension value."""
    if expression.kind == "comparison":
        return _compile_comparison(model, assign, expression, constraint_type, data)
    if expression.kind == "forbid":
        _compile_forbid(model, assign, expression, data)
        return []
    if expression.kind == "exists":
        return _compile_exists(model, assign, expression, constraint_type, data)
    if expression.kind == "no_adjacent":
        return _compile_no_adjacent(model, assign, expression, constraint_type, data)
    raise ValueError(f"Unsupported inner expression kind in for_each: {expression.kind}")


def _compare(actual, operator, expected):
    if operator == "eq": return actual == expected
    if operator == "neq": return actual != expected
    if operator == "lt": return actual < expected
    if operator == "lte": return actual <= expected
    if operator == "gt": return actual > expected
    if operator == "gte": return actual >= expected
    raise ValueError(f"Unsupported operator: {operator}")
