"""Compile dynamic constraints against date-aware semester assignment variables.

Assignment keys are (session_date, slot_id, class_id, subject_id, teacher_id, room_id).
This adapter intentionally keeps date-specific variables distinct, unlike the weekly compiler.
"""
from __future__ import annotations

from collections import defaultdict

from app.constraints.schemas import GeneratedConstraint
from app.constraints.compiler import (
    _compare,
    _create_comparison_penalty,
    _make_count_var,
    _resolve_expected_values,
)


def _field_value(field, key, data):
    session_date, slot_id, class_id, subject_id, teacher_id, room_id = key
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
        return session_date.strftime("%A")
    if field == "period":
        return data["slot_period"][slot_id]
    if field == "room_type":
        return str(data["room_types"][room_id]).strip().lower()
    if field == "subject_type":
        return str(data["subject_types"][subject_id]).strip().lower()
    raise ValueError(f"Unsupported condition field: {field}")


def _matches(assign, condition, data):
    if condition.kind == "atomic":
        expected = _resolve_expected_values(condition.field, condition.value, data)
        return {
            key for key in assign
            if any(_compare(_field_value(condition.field, key, data), condition.operator, value)
                   for value in expected)
        }
    if condition.kind == "and":
        result = set(assign)
        for child in condition.conditions:
            result &= _matches(assign, child, data)
        return result
    if condition.kind == "or":
        result = set()
        for child in condition.conditions:
            result |= _matches(assign, child, data)
        return result
    if condition.kind == "not":
        return set(assign) - _matches(assign, condition.condition, data)
    raise ValueError(f"Unsupported condition kind: {condition.kind}")


def _compile_expression(model, assign, expression, constraint_type, data):
    kind = expression.kind
    if kind == "forbid":
        matched = [assign[key] for key in _matches(assign, expression.filter, data)]
        if constraint_type == "hard":
            for variable in matched:
                model.Add(variable == 0)
            return []
        # A soft forbid is a preference, not a hard prohibition: each
        # matching scheduled assignment contributes one unit of penalty.
        return matched
    if kind == "exists":
        variables = [assign[key] for key in _matches(assign, expression.filter, data)]
        count = _make_count_var(model, variables, "semester_dynamic_exists")
        if constraint_type == "hard":
            model.Add(count >= 1)
            return []
        penalty = model.NewIntVar(0, 1, "semester_dynamic_exists_penalty")
        model.Add(penalty >= 1 - count)
        return [penalty]
    if kind == "comparison":
        left, right = expression.left, expression.right
        if left.kind != "count" or right.kind != "constant":
            raise NotImplementedError("Semester constraints currently support COUNT compared with a constant.")
        variables = [assign[key] for key in _matches(assign, left.filter, data)]
        count = _make_count_var(model, variables, "semester_dynamic_count")
        limit = int(right.value)
        if constraint_type == "hard":
            op = expression.operator
            if op == "eq": model.Add(count == limit)
            elif op == "neq": model.Add(count != limit)
            elif op == "lt": model.Add(count < limit)
            elif op == "lte": model.Add(count <= limit)
            elif op == "gt": model.Add(count > limit)
            elif op == "gte": model.Add(count >= limit)
            else: raise ValueError(f"Unsupported comparison operator: {op}")
            return []
        return [_create_comparison_penalty(model, count, expression.operator, limit)]
    if kind == "no_adjacent":
        matched = _matches(assign, expression.filter, data)
        by_teacher_date_period = defaultdict(list)
        for key in matched:
            session_date, slot_id, _class_id, _subject_id, teacher_id, _room_id = key
            by_teacher_date_period[(teacher_id, session_date, data["slot_period"][slot_id])].append(assign[key])
        penalties = []
        for (teacher_id, session_date, period), current in by_teacher_date_period.items():
            following = by_teacher_date_period.get((teacher_id, session_date, period + 1), [])
            if not following:
                continue
            current_count = _make_count_var(model, current, f"sem_adj_a_{teacher_id}_{session_date}_{period}")
            next_count = _make_count_var(model, following, f"sem_adj_b_{teacher_id}_{session_date}_{period}")
            if constraint_type == "hard":
                model.Add(current_count + next_count <= 1)
            else:
                penalty = model.NewIntVar(0, 1, f"sem_adj_penalty_{teacher_id}_{session_date}_{period}")
                model.Add(penalty >= current_count + next_count - 1)
                penalties.append(penalty)
        return penalties
    if kind == "for_each":
        dimension = expression.dimension
        def dimension_value(key):
            session_date, _slot_id, class_id, subject_id, teacher_id, room_id = key
            return {
                "day": session_date.strftime("%A"),
                "teacher": teacher_id,
                "subject": subject_id,
                "class": class_id,
                "room": room_id,
            }[dimension]
        penalties = []
        for value in {dimension_value(key) for key in assign}:
            subset = {key: var for key, var in assign.items() if dimension_value(key) == value}
            penalties.extend(_compile_expression(model, subset, expression.expression, constraint_type, data))
        return penalties
    raise ValueError(f"Unsupported expression kind: {kind}")


def compile_semester_constraint(model, assign, constraint: GeneratedConstraint, data: dict) -> list:
    """Compile one validated GeneratedConstraint; caller applies soft weight."""
    return _compile_expression(model, assign, constraint.expression, constraint.constraint_type, data)
