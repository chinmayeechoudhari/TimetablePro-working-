import pytest

from app.constraints.resolver import (
    EntityResolutionError,
    resolve_teacher,
    resolve_subject,
    resolve_class,
    resolve_room,
    resolve_day_slots,
    resolve_slot,
)

from app.models.models import (
    Teacher,
    Subject,
    Class,
    Room,
    TimeSlot,
)


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
        self.data = {
            Teacher: teachers or [],
            Subject: subjects or [],
            Class: classes or [],
            Room: rooms or [],
            TimeSlot: slots or [],
        }

    def query(self, model):
        return FakeQuery(self.data[model])


def test_resolve_teacher_case_insensitive():

    db = FakeDB(
        teachers=[
            FakeTeacher(1, "Rahul"),
        ]
    )

    teacher = resolve_teacher(db, " rahul ")

    assert teacher.teacher_id == 1
    assert teacher.teacher_name == "Rahul"


def test_unknown_teacher():

    db = FakeDB(
        teachers=[
            FakeTeacher(1, "Rahul"),
        ]
    )

    with pytest.raises(EntityResolutionError):
        resolve_teacher(db, "Amit")


def test_resolve_subject():

    db = FakeDB(
        subjects=[
            FakeSubject(3, "DBMS"),
        ]
    )

    subject = resolve_subject(db, "dbms")

    assert subject.subject_id == 3


def test_resolve_class():

    db = FakeDB(
        classes=[
            FakeClass(2, "CSE-A"),
        ]
    )

    cls = resolve_class(db, "cse-a")

    assert cls.class_id == 2


def test_resolve_room():

    db = FakeDB(
        rooms=[
            FakeRoom(5, "Lab 1"),
        ]
    )

    room = resolve_room(db, "LAB 1")

    assert room.room_id == 5


def test_resolve_day_slots_sorted():

    db = FakeDB(
        slots=[
            FakeSlot(3, "Monday", 3),
            FakeSlot(1, "Monday", 1),
            FakeSlot(2, "Monday", 2),
        ]
    )

    slots = resolve_day_slots(db, "monday")

    assert [slot.slot_id for slot in slots] == [1, 2, 3]


def test_resolve_specific_slot():

    db = FakeDB(
        slots=[
            FakeSlot(1, "Monday", 1),
            FakeSlot(2, "Monday", 2),
        ]
    )

    slot = resolve_slot(db, "Monday", 2)

    assert slot.slot_id == 2