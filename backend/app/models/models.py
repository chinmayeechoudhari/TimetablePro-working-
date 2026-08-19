from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    ForeignKey,
    Text,
    Index,
    func,
)
from sqlalchemy.orm import relationship
from app.core.config import Base

class Class(Base):
    __tablename__ = 'class'
    class_id   = Column(Integer, primary_key=True, index=True)
    class_name = Column(String, nullable=False)
    subjects   = relationship('Subject', back_populates='class_', cascade="all, delete-orphan")
    timetables = relationship('Timetable', back_populates='class_', cascade="all, delete-orphan")

class Subject(Base):
    __tablename__ = 'subject'
    subject_id       = Column(Integer, primary_key=True, index=True)
    subject_name     = Column(String, nullable=False)
    periods_per_week = Column(Integer, nullable=False)
    subject_type     = Column(String, default='theory')  # 'theory' or 'lab'
    class_id         = Column(Integer, ForeignKey('class.class_id'), nullable=False)
    class_           = relationship('Class', back_populates='subjects')
    teacher_subjects = relationship('TeacherSubject', back_populates='subject', cascade="all, delete-orphan")

class Teacher(Base):
    __tablename__ = 'teacher'

    teacher_id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    teacher_name = Column(
        String,
        nullable=False
    )

    max_periods_per_day = Column(
        Integer,
        default=6
    )

    teacher_subjects = relationship(
        'TeacherSubject',
        back_populates='teacher',
        cascade="all, delete-orphan"
    )

    availabilities = relationship(
        'TeacherAvailability',
        back_populates='teacher',
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index(
            'uq_teacher_name_normalized',
            func.lower(func.trim(teacher_name)),
            unique=True,
        ),
    )

class Room(Base):

    __tablename__ = 'room'

    room_id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    room_number = Column(
        String,
        nullable=False
    )

    room_type = Column(
        String,
        default='classroom'
    )

    timetables = relationship(
        'Timetable',
        back_populates='room',
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index(
            'uq_room_room_number_lower',
            func.lower(func.trim(room_number)),
            unique=True,
        ),
    )
class TimeSlot(Base):
    __tablename__ = 'timeslot'
    slot_id       = Column(Integer, primary_key=True, index=True)
    day           = Column(String, nullable=False)
    period_number = Column(Integer, nullable=False)
    timetables    = relationship('Timetable', back_populates='timeslot', cascade="all, delete-orphan")
    availabilities = relationship('TeacherAvailability', back_populates='timeslot', cascade="all, delete-orphan")

class TeacherSubject(Base):
    __tablename__ = 'teacher_subject'
    teacher_id = Column(Integer, ForeignKey('teacher.teacher_id'), primary_key=True)
    subject_id = Column(Integer, ForeignKey('subject.subject_id'), primary_key=True)
    teacher    = relationship('Teacher', back_populates='teacher_subjects')
    subject    = relationship('Subject', back_populates='teacher_subjects')

class TeacherAvailability(Base):
    __tablename__ = 'teacher_availability'
    teacher_id   = Column(Integer, ForeignKey('teacher.teacher_id'), primary_key=True)
    slot_id      = Column(Integer, ForeignKey('timeslot.slot_id'), primary_key=True)
    is_available = Column(Boolean, default=True)
    teacher      = relationship('Teacher', back_populates='availabilities')
    timeslot     = relationship('TimeSlot', back_populates='availabilities')

class Timetable(Base):
    __tablename__ = 'timetable'
    timetable_id = Column(Integer, primary_key=True, index=True)
    class_id     = Column(Integer, ForeignKey('class.class_id'), nullable=False)
    subject_id   = Column(Integer, ForeignKey('subject.subject_id'), nullable=False)
    teacher_id   = Column(Integer, ForeignKey('teacher.teacher_id'), nullable=False)
    slot_id      = Column(Integer, ForeignKey('timeslot.slot_id'), nullable=False)
    room_id      = Column(Integer, ForeignKey('room.room_id'), nullable=False)
    class_       = relationship('Class', back_populates='timetables')
    room         = relationship('Room', back_populates='timetables')
    timeslot     = relationship('TimeSlot', back_populates='timetables')

class Constraint(Base):
    __tablename__ = 'constraint'
    constraint_id   = Column(Integer, primary_key=True, index=True)
    constraint_name = Column(String, nullable=False)
    constraint_type = Column(String, nullable=False)  # 'hard' or 'soft'
    parameters_json = Column(Text)  # JSON string of rule parameters
