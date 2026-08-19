from sqlalchemy.orm import Session

from app.models.models import (
    Class,
    Subject,
    Teacher,
    Room,
    TimeSlot,
)


class EntityResolutionError(Exception):
    """Raised when a user-mentioned entity cannot be resolved."""
    pass


def _normalize(value: str) -> str:
    """
    Normalize user input for case-insensitive matching.

    Example:
        "  Rahul  " -> "rahul"
    """
    return value.strip().lower()


def resolve_teacher(db: Session, name: str) -> Teacher:
    normalized = _normalize(name)

    teachers = db.query(Teacher).all()

    matches = [
        teacher
        for teacher in teachers
        if _normalize(teacher.teacher_name) == normalized
    ]

    if not matches:
        raise EntityResolutionError(
            f"Teacher '{name}' was not found."
        )

    if len(matches) > 1:
        raise EntityResolutionError(
            f"Multiple teachers matched '{name}'."
        )

    return matches[0]


def resolve_subject(db: Session, name: str) -> Subject:
    normalized = _normalize(name)

    subjects = db.query(Subject).all()

    matches = [
        subject
        for subject in subjects
        if _normalize(subject.subject_name) == normalized
    ]

    if not matches:
        raise EntityResolutionError(
            f"Subject '{name}' was not found."
        )

    if len(matches) > 1:
        raise EntityResolutionError(
            f"Multiple subjects matched '{name}'."
        )

    return matches[0]


def resolve_class(db: Session, name: str) -> Class:
    normalized = _normalize(name)

    classes = db.query(Class).all()

    matches = [
        cls
        for cls in classes
        if _normalize(cls.class_name) == normalized
    ]

    if not matches:
        raise EntityResolutionError(
            f"Class '{name}' was not found."
        )

    if len(matches) > 1:
        raise EntityResolutionError(
            f"Multiple classes matched '{name}'."
        )

    return matches[0]


def resolve_room(db: Session, room_number: str) -> Room:
    normalized = _normalize(room_number)

    rooms = db.query(Room).all()

    matches = [
        room
        for room in rooms
        if _normalize(room.room_number) == normalized
    ]

    if not matches:
        raise EntityResolutionError(
            f"Room '{room_number}' was not found."
        )

    if len(matches) > 1:
        raise EntityResolutionError(
            f"Multiple rooms matched '{room_number}'."
        )

    return matches[0]


def resolve_day_slots(db: Session, day: str) -> list[TimeSlot]:
    normalized = _normalize(day)

    slots = db.query(TimeSlot).all()

    matches = [
        slot
        for slot in slots
        if _normalize(slot.day) == normalized
    ]

    if not matches:
        raise EntityResolutionError(
            f"No time slots found for day '{day}'."
        )

    return sorted(
        matches,
        key=lambda slot: slot.period_number
    )


def resolve_slot(
    db: Session,
    day: str,
    period: int,
) -> TimeSlot:
    normalized = _normalize(day)

    slots = db.query(TimeSlot).all()

    matches = [
        slot
        for slot in slots
        if (
            _normalize(slot.day) == normalized
            and slot.period_number == period
        )
    ]

    if not matches:
        raise EntityResolutionError(
            f"No slot found for {day}, period {period}."
        )

    if len(matches) > 1:
        raise EntityResolutionError(
            f"Multiple slots found for {day}, period {period}."
        )

    return matches[0]

def resolve_period(db: Session, period: int) -> list[TimeSlot]:
    """
    Resolve all time slots having the given period number.

    A period is valid if it exists on at least one day.
    """

    slots = db.query(TimeSlot).all()

    matches = [
        slot
        for slot in slots
        if slot.period_number == period
    ]

    if not matches:
        raise EntityResolutionError(
            f"Period '{period}' was not found."
        )

    return matches