from __future__ import annotations

from sqlalchemy.orm import Session

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
)


class ConstraintValidationError(Exception):
    """Raised when a generated constraint is invalid."""
    pass


def validate_constraint(
    db: Session,
    constraint: GeneratedConstraint,
) -> bool:
    """
    Validate that all entities referenced by the generated
    constraint actually exist in the timetable database.

    The LLM generates the constraint.
    This function deterministically verifies that the
    referenced timetable entities are valid.

    Returns:
        True if the constraint is valid.

    Raises:
        EntityResolutionError:
            If any referenced entity does not exist.
    """

    _validate_expression(db, constraint.expression)

    return True


def _validate_expression(db: Session, expression):
    """
    Recursively validate every expression inside a constraint.
    """

    kind = expression.kind

    # --------------------------------------------------------
    # Comparison
    # --------------------------------------------------------

    if kind == "comparison":

        _validate_numeric_expression(db, expression.left)
        _validate_numeric_expression(db, expression.right)

        return

    # --------------------------------------------------------
    # Forbid
    # --------------------------------------------------------

    if kind == "forbid":

        _validate_condition(db, expression.filter)

        return

    # --------------------------------------------------------
    # Exists
    # --------------------------------------------------------

    if kind == "exists":

        _validate_condition(db, expression.filter)

        return

    # --------------------------------------------------------
    # No Adjacent
    # --------------------------------------------------------

    if kind == "no_adjacent":

        _validate_condition(db, expression.filter)

        return

    # --------------------------------------------------------
    # For Each
    # --------------------------------------------------------

    if kind == "for_each":

        _validate_expression(db, expression.expression)

        return

    raise ConstraintValidationError(
        f"Unsupported expression type: {kind}"
    )


def _validate_numeric_expression(db: Session, expression):

    kind = expression.kind

    if kind == "constant":
        return

    if kind == "count":

        _validate_condition(db, expression.filter)

        return

    raise ConstraintValidationError(
        f"Unsupported numeric expression: {kind}"
    )


def _validate_condition(db: Session, condition):

    kind = condition.kind

    # --------------------------------------------------------
    # Atomic condition
    # --------------------------------------------------------

    if kind == "atomic":

        _validate_atomic_condition(db, condition)

        return

    # --------------------------------------------------------
    # AND
    # --------------------------------------------------------

    if kind == "and":

        for child in condition.conditions:
            _validate_condition(db, child)

        return

    # --------------------------------------------------------
    # OR
    # --------------------------------------------------------

    if kind == "or":

        for child in condition.conditions:
            _validate_condition(db, child)

        return

    # --------------------------------------------------------
    # NOT
    # --------------------------------------------------------

    if kind == "not":

        _validate_condition(db, condition.condition)

        return

    raise ConstraintValidationError(
        f"Unsupported condition type: {kind}"
    )


def _validate_atomic_condition(
    db: Session,
    condition: AtomicCondition,
) -> None:
    """
    Validate the entity/value referenced by an atomic condition.

    Entity validation is delegated to resolver.py so that the
    database remains the source of truth.
    """

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
        if not isinstance(value, int):
            raise EntityResolutionError(
                f"Period '{value}' must be an integer."
            )

        resolve_period(db, value)

    elif field == "slot":
        # Slot validation is handled separately because a slot
        # requires both day and period information.
        raise EntityResolutionError(
            "Direct slot validation is not supported yet."
        )

    elif field in ("room_type", "subject_type"):
        # These are categorical attributes rather than entities.
        # They don't need database entity resolution at this stage.
        return