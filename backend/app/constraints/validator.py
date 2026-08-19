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


class ConstraintValidationError(Exception):
    """Raised when a generated constraint is invalid."""

    pass


def validate_constraint(db, constraint: GeneratedConstraint) -> bool:
    """Deterministically validate every database-backed entity in a constraint."""

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

    raise ConstraintValidationError(
        f"Unsupported numeric expression: {expression.kind}"
    )


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
            raise EntityResolutionError(
                f"Period '{value}' must be an integer."
            ) from exc
        resolve_period(db, period)
    elif field == "slot":
        day, period = parse_slot_value(value)
        resolve_slot(db, day, period)
    elif field in ("room_type", "subject_type"):
        # Categorical attributes are validated against the solver data at compile time.
        return
    else:
        raise ConstraintValidationError(f"Unsupported condition field: {field}")
