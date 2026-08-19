import pytest

from app.constraints.schemas import GeneratedConstraint
from app.constraints.validator import validate_constraint
from app.constraints.resolver import EntityResolutionError


# ---------------------------------------------------------
# Fake database objects
# ---------------------------------------------------------

class FakeTeacher:
    def __init__(self, teacher_id, teacher_name):
        self.teacher_id = teacher_id
        self.teacher_name = teacher_name


class FakeSubject:
    def __init__(self, subject_id, subject_name):
        self.subject_id = subject_id
        self.subject_name = subject_name


class FakeClass:
    def __init__(self, class_id, class_name):
        self.class_id = class_id
        self.class_name = class_name


class FakeRoom:
    def __init__(self, room_id, room_number):
        self.room_id = room_id
        self.room_number = room_number


class FakeSlot:
    def __init__(self, slot_id, day, period_number):
        self.slot_id = slot_id
        self.day = day
        self.period_number = period_number


class FakeQuery:
    def __init__(self, data):
        self.data = data

    def all(self):
        return self.data


class FakeDB:
    def __init__(
        self,
        teachers=None,
        subjects=None,
        classes=None,
        rooms=None,
        slots=None,
    ):
        from app.models.models import (
            Teacher,
            Subject,
            Class,
            Room,
            TimeSlot,
        )

        self.data = {
            Teacher: teachers or [],
            Subject: subjects or [],
            Class: classes or [],
            Room: rooms or [],
            TimeSlot: slots or [],
        }

    def query(self, model):
        return FakeQuery(self.data[model])


# ---------------------------------------------------------
# Test data
# ---------------------------------------------------------

@pytest.fixture
def db():
    return FakeDB(
        teachers=[
            FakeTeacher(1, "Rahul"),
        ],
        subjects=[
            FakeSubject(2, "DBMS"),
        ],
        classes=[
            FakeClass(3, "CSE-A"),
        ],
        rooms=[
            FakeRoom(4, "Lab 1"),
        ],
        slots=[
            FakeSlot(1, "Monday", 1),
            FakeSlot(2, "Monday", 2),
            FakeSlot(3, "Monday", 3),
            FakeSlot(4, "Tuesday", 1),
        ],
    )


# ---------------------------------------------------------
# 1. Valid constraint
# ---------------------------------------------------------

def test_valid_teacher_constraint_is_accepted(db):

    constraint = GeneratedConstraint.model_validate({
        "constraint_type": "hard",
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
                            "value": "Rahul",
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
        "explanation": "Rahul can teach at most 3 periods on Monday.",
        "assumptions": [],
    })

    result = validate_constraint(db, constraint)

    assert result is True


# ---------------------------------------------------------
# 2. Unknown teacher
# ---------------------------------------------------------

def test_unknown_teacher_is_rejected(db):

    constraint = GeneratedConstraint.model_validate({
        "constraint_type": "hard",
        "expression": {
            "kind": "forbid",
            "filter": {
                "kind": "atomic",
                "field": "teacher",
                "operator": "eq",
                "value": "Amit",
            },
        },
        "explanation": "Amit cannot be assigned.",
        "assumptions": [],
    })

    with pytest.raises(EntityResolutionError):
        validate_constraint(db, constraint)


# ---------------------------------------------------------
# 3. Unknown subject
# ---------------------------------------------------------

def test_unknown_subject_is_rejected(db):

    constraint = GeneratedConstraint.model_validate({
        "constraint_type": "hard",
        "expression": {
            "kind": "forbid",
            "filter": {
                "kind": "atomic",
                "field": "subject",
                "operator": "eq",
                "value": "Operating Systems",
            },
        },
        "explanation": "Operating Systems cannot be assigned.",
        "assumptions": [],
    })

    with pytest.raises(EntityResolutionError):
        validate_constraint(db, constraint)


# ---------------------------------------------------------
# 4. Unknown class
# ---------------------------------------------------------

def test_unknown_class_is_rejected(db):

    constraint = GeneratedConstraint.model_validate({
        "constraint_type": "hard",
        "expression": {
            "kind": "forbid",
            "filter": {
                "kind": "atomic",
                "field": "class",
                "operator": "eq",
                "value": "CSE-B",
            },
        },
        "explanation": "CSE-B cannot receive this assignment.",
        "assumptions": [],
    })

    with pytest.raises(EntityResolutionError):
        validate_constraint(db, constraint)


# ---------------------------------------------------------
# 5. Unknown room
# ---------------------------------------------------------

def test_unknown_room_is_rejected(db):

    constraint = GeneratedConstraint.model_validate({
        "constraint_type": "hard",
        "expression": {
            "kind": "forbid",
            "filter": {
                "kind": "atomic",
                "field": "room",
                "operator": "eq",
                "value": "Lab 99",
            },
        },
        "explanation": "Lab 99 cannot be used.",
        "assumptions": [],
    })

    with pytest.raises(EntityResolutionError):
        validate_constraint(db, constraint)


# ---------------------------------------------------------
# 6. Invalid day
# ---------------------------------------------------------

def test_unknown_day_is_rejected(db):

    constraint = GeneratedConstraint.model_validate({
        "constraint_type": "hard",
        "expression": {
            "kind": "forbid",
            "filter": {
                "kind": "atomic",
                "field": "day",
                "operator": "eq",
                "value": "Sunday",
            },
        },
        "explanation": "No classes on Sunday.",
        "assumptions": [],
    })

    with pytest.raises(EntityResolutionError):
        validate_constraint(db, constraint)


# ---------------------------------------------------------
# 7. Invalid period
# ---------------------------------------------------------

def test_unknown_period_is_rejected(db):

    constraint = GeneratedConstraint.model_validate({
        "constraint_type": "hard",
        "expression": {
            "kind": "forbid",
            "filter": {
                "kind": "atomic",
                "field": "period",
                "operator": "eq",
                "value": 10,
            },
        },
        "explanation": "Period 10 cannot be used.",
        "assumptions": [],
    })

    with pytest.raises(EntityResolutionError):
        validate_constraint(db, constraint)