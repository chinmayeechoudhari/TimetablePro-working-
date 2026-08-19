from __future__ import annotations

from app.constraints.schemas import GeneratedConstraint
from app.constraints.resolver import (
    EntityResolutionError,
    resolve_teacher,
    resolve_subject,
    resolve_class,
    resolve_room,
    resolve_day_slots,
    resolve_slot,
    resolve_period,
    parse_slot_value,
)
from app.models.models import Room, Subject


class ConstraintValidationError(Exception):
    """Raised when a generated constraint is invalid."""
    pass


def validate_constraint(db, constraint: GeneratedConstraint) -> bool:
    _validate_expression(db, constraint.expression)
    return True


def _validate_expression(db, expression):
    kind = expression.kind
    if kind == "comparison":
        _validate_numeric_expression(db, expression.left)
        _validate_numeric_expression(db, expression.right)
        return
    if kind in ("forbid", "exists", "no_adjacent"):
        _validate_condition(db, expression.filter)
        return
    if kind == "for_each":
        _validate_expression(db, expression.expression)
        return
    raise ConstraintValidationError(f"Unsupported expression type: {kind}")


def _validate_numeric_expression(db, expression):
    if expression.kind == "constant":
        return
    if expression.kind == "count":
        _validate_condition(db, expression.filter)
        return
    raise ConstraintValidationError(f"Unsupported numeric expression: {expression.kind}")


def _validate_condition(db, condition):
    kind = condition.kind
    if kind == "atomic":
        _validate_atomic_condition(db, condition)
        return
    if kind in ("and", "or"):
        for child in condition.conditions:
            _validate_condition(db, child)
        return
    if kind == "not":
        _validate_condition(db, condition.condition)
        return
    raise ConstraintValidationError(f"Unsupported condition type: {kind}")


def _validate_atomic_condition(db, condition) -> None:
    field = condition.field
    value = condition.value

    if field == "teacher":
        resolve_teacher(db, str(value))
    elif field == "subject":
        resolve_subject(db, str(value))
    elif field == "class":
        resolve_class(db, str(value))
    elif field == "room":
        resolve_room(db, str(value))
    elif field == "day":
        resolve_day_slots(db, str(value))
    elif field == "period":
        if isinstance(value, bool):
            raise EntityResolutionError(f"Period '{value}' must be an integer.")
        try:
            period = int(value)
        except (TypeError, ValueError) as exc:
            raise EntityResolutionError(f"Period '{value}' must be an integer.") from exc
        resolve_period(db, period)
    elif field == "slot":
        day, period = parse_slot_value(value)
        resolve_slot(db, day, period)
    elif field == "room_type":
        requested = str(value).strip().lower()
        available = {str(room.room_type).strip().lower() for room in db.query(Room).all() if room.room_type is not None}
        if requested not in available:
            raise EntityResolutionError(f"Room type '{value}' was not found.")
    elif field == "subject_type":
        requested = str(value).strip().lower()
        available = {str(subject.subject_type).strip().lower() for subject in db.query(Subject).all() if subject.subject_type is not None}
        if requested not in available:
            raise EntityResolutionError(f"Subject type '{value}' was not found.")
    else:
        raise ConstraintValidationError(f"Unsupported condition field: {field}")
