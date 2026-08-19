from __future__ import annotations

import re
import unicodedata
from difflib import SequenceMatcher

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


# Common title words are not part of a teacher's identity.
_TEACHER_TITLES = {
    "prof",
    "professor",
    "dr",
    "doctor",
    "mr",
    "mrs",
    "ms",
    "miss",
}


def _normalize(value: str) -> str:
    """Normalize text for forgiving, case-insensitive matching."""

    value = unicodedata.normalize("NFKC", str(value))
    value = value.strip().lower()
    value = re.sub(r"[\u2010-\u2015\-_/]+", " ", value)
    value = re.sub(r"[^\w\s]", " ", value, flags=re.UNICODE)
    return " ".join(value.split())


def _compact(value: str) -> str:
    """Return a punctuation/whitespace-insensitive representation."""

    return re.sub(r"[^a-z0-9]", "", _normalize(value))


def _teacher_normalize(value: str) -> str:
    """Normalize a teacher name while ignoring honorifics."""

    tokens = _normalize(value).split()
    tokens = [token for token in tokens if token not in _TEACHER_TITLES]
    return " ".join(tokens)


def _acronym(value: str) -> str:
    """Build an acronym from the words in a name."""

    return "".join(token[0] for token in _normalize(value).split() if token)


def _similarity(left: str, right: str) -> float:
    return SequenceMatcher(None, _compact(left), _compact(right)).ratio()


def _resolve_entity(
    values: list,
    query: str,
    *,
    label: str,
    display_attr: str,
    teacher: bool = False,
):
    """
    Resolve an entity without silently accepting a risky fuzzy match.

    Matching order:
      1. exact normalized text
      2. punctuation/space-insensitive text
      3. teacher title-insensitive text
      4. unique token containment (useful for "Sharma" -> "Prof. Sharma")
      5. unique acronym match (useful for DBMS -> Database Management Systems)
      6. unique high-confidence typo match

    Ambiguous matches are rejected rather than guessed.
    """

    query_normalized = _normalize(query)
    query_compact = _compact(query)
    query_teacher = _teacher_normalize(query) if teacher else query_normalized

    if not query_normalized:
        raise EntityResolutionError(f"{label} '{query}' was not found.")

    def name_of(item):
        return str(getattr(item, display_attr))

    # 1. Exact normalized match.
    matches = [item for item in values if _normalize(name_of(item)) == query_normalized]
    if len(matches) == 1:
        return matches[0]
    if len(matches) > 1:
        raise EntityResolutionError(
            f"Multiple {label.lower()}s matched '{query}'."
        )

    # 2. Ignore punctuation, spaces and hyphens.
    matches = [item for item in values if _compact(name_of(item)) == query_compact]
    if len(matches) == 1:
        return matches[0]
    if len(matches) > 1:
        raise EntityResolutionError(
            f"Multiple {label.lower()}s matched '{query}'."
        )

    # 3. Ignore teacher honorifics.
    if teacher:
        matches = [
            item
            for item in values
            if _teacher_normalize(name_of(item)) == query_teacher
        ]
        if len(matches) == 1:
            return matches[0]
        if len(matches) > 1:
            raise EntityResolutionError(
                f"Multiple {label.lower()}s matched '{query}'."
            )

    query_tokens = set(query_teacher.split() if teacher else query_normalized.split())

    # 4. A short name/token may identify a longer database name.
    if query_tokens:
        token_matches = []
        for item in values:
            candidate = _teacher_normalize(name_of(item)) if teacher else _normalize(name_of(item))
            candidate_tokens = set(candidate.split())
            if query_tokens.issubset(candidate_tokens):
                token_matches.append(item)

        if len(token_matches) == 1:
            return token_matches[0]
        if len(token_matches) > 1:
            names = ", ".join(name_of(item) for item in token_matches[:5])
            raise EntityResolutionError(
                f"Multiple {label.lower()}s matched '{query}': {names}."
            )

    # 5. Acronym match. Only accept a unique result.
    query_acronym = _compact(query_normalized)
    if query_acronym:
        acronym_matches = [
            item
            for item in values
            if _acronym(name_of(item)) == query_acronym
        ]
        if len(acronym_matches) == 1:
            return acronym_matches[0]
        if len(acronym_matches) > 1:
            names = ", ".join(name_of(item) for item in acronym_matches[:5])
            raise EntityResolutionError(
                f"Multiple {label.lower()}s matched '{query}': {names}."
            )

    # 6. High-confidence typo correction. The threshold is deliberately
    # conservative, and ties are rejected.
    scored = sorted(
        ((_similarity(query, name_of(item)), item) for item in values),
        key=lambda pair: pair[0],
        reverse=True,
    )
    if scored and scored[0][0] >= 0.86:
        best_score = scored[0][0]
        close = [item for score, item in scored if best_score - score < 0.015]
        if len(close) == 1:
            return close[0]

    raise EntityResolutionError(f"{label} '{query}' was not found.")


def resolve_teacher(db: Session, name: str) -> Teacher:
    return _resolve_entity(
        db.query(Teacher).all(),
        name,
        label="Teacher",
        display_attr="teacher_name",
        teacher=True,
    )


def resolve_subject(db: Session, name: str) -> Subject:
    return _resolve_entity(
        db.query(Subject).all(),
        name,
        label="Subject",
        display_attr="subject_name",
    )


def resolve_class(db: Session, name: str) -> Class:
    return _resolve_entity(
        db.query(Class).all(),
        name,
        label="Class",
        display_attr="class_name",
    )


def resolve_room(db: Session, room_number: str) -> Room:
    query = _normalize(room_number)
    query = re.sub(r"^room\s+", "", query)

    rooms = db.query(Room).all()
    normalized_rooms = []
    for room in rooms:
        normalized = _normalize(room.room_number)
        normalized = re.sub(r"^room\s+", "", normalized)
        normalized_rooms.append((room, normalized))

    exact = [room for room, value in normalized_rooms if value == query]
    if len(exact) == 1:
        return exact[0]
    if len(exact) > 1:
        raise EntityResolutionError(f"Multiple rooms matched '{room_number}'.")

    return _resolve_entity(
        rooms,
        room_number,
        label="Room",
        display_attr="room_number",
    )


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

    return sorted(matches, key=lambda slot: slot.period_number)


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
    """Resolve all time slots having the given period number."""

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


def parse_slot_value(value) -> tuple[str, int]:
    """
    Parse the common slot forms emitted by an LLM.

    Supported examples:
      - {"day": "Monday", "period": 3}
      - "Monday Period 3"
      - "Monday P3"
      - "Monday, period 3"
    """

    if isinstance(value, dict):
        day = value.get("day")
        period = value.get("period", value.get("period_number"))
        if day is None or period is None:
            raise EntityResolutionError(
                f"Slot '{value}' must contain day and period."
            )
        try:
            return str(day), int(period)
        except (TypeError, ValueError) as exc:
            raise EntityResolutionError(
                f"Slot '{value}' has an invalid period."
            ) from exc

    text = _normalize(str(value))
    match = re.fullmatch(
        r"(.+?)\s+(?:p|period)\s*(\d+)",
        text,
    )
    if not match:
        raise EntityResolutionError(
            f"Could not understand slot '{value}'. Use a form such as 'Monday Period 3'."
        )

    return match.group(1), int(match.group(2))
