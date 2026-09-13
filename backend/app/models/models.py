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


class AcademicGroup(Base):
    """One department/year academic configuration shared by its divisions."""
    __tablename__ = 'academic_group'
    group_id = Column(Integer, primary_key=True, index=True)
    academic_year = Column(String, nullable=False)
    department = Column(String, nullable=False)
    year_of_study = Column(Integer, nullable=False)
    divisions = relationship('Division', back_populates='academic_group', cascade='all, delete-orphan')
    subject_definitions = relationship('SubjectDefinition', back_populates='academic_group', cascade='all, delete-orphan')

    __table_args__ = (
        Index(
            'uq_academic_group_scope',
            func.lower(func.trim(academic_year)),
            func.lower(func.trim(department)),
            year_of_study,
            unique=True,
        ),
    )


class Division(Base):
    """A division belongs to exactly one department/year academic group."""
    __tablename__ = 'division'
    division_id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey('academic_group.group_id'), nullable=False)
    class_id = Column(Integer, ForeignKey('class.class_id'), nullable=False, unique=True)
    division_name = Column(String, nullable=False)
    academic_group = relationship('AcademicGroup', back_populates='divisions')
    class_ = relationship('Class', back_populates='division')
    assignments = relationship('TeachingAssignment', back_populates='division', cascade='all, delete-orphan')


class SubjectDefinition(Base):
    """One subject definition shared by all divisions in an academic group."""
    __tablename__ = 'subject_definition'
    definition_id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey('academic_group.group_id'), nullable=False)
    subject_name = Column(String, nullable=False)
    subject_type = Column(String, nullable=False, default='theory')
    periods_per_week = Column(Integer, nullable=False)
    academic_group = relationship('AcademicGroup', back_populates='subject_definitions')
    assignments = relationship('TeachingAssignment', back_populates='subject_definition', cascade='all, delete-orphan')


class Class(Base):
    __tablename__ = 'class'
    class_id   = Column(Integer, primary_key=True, index=True)
    class_name = Column(String, nullable=False)
    subjects   = relationship('Subject', back_populates='class_', cascade="all, delete-orphan")
    timetables = relationship('Timetable', back_populates='class_', cascade="all, delete-orphan")
    division = relationship('Division', back_populates='class_', uselist=False)


class Subject(Base):
    __tablename__ = 'subject'
    subject_id       = Column(Integer, primary_key=True, index=True)
    subject_name     = Column(String, nullable=False)
    periods_per_week = Column(Integer, nullable=False)
    subject_type     = Column(String, default='theory')
    class_id         = Column(Integer, ForeignKey('class.class_id'), nullable=False)
    class_           = relationship('Class', back_populates='subjects')
    teacher_subjects = relationship('TeacherSubject', back_populates='subject', cascade="all, delete-orphan")


class Teacher(Base):
    __tablename__ = 'teacher'
    teacher_id = Column(Integer, primary_key=True, index=True)
    teacher_name = Column(String, nullable=False)
    max_periods_per_day = Column(Integer, default=6)
    teacher_subjects = relationship('TeacherSubject', back_populates='teacher', cascade="all, delete-orphan")
    availabilities = relationship('TeacherAvailability', back_populates='teacher', cascade="all, delete-orphan")
    assignments = relationship('TeachingAssignment', back_populates='teacher', cascade='all, delete-orphan')
    __table_args__ = (
        Index('uq_teacher_name_normalized', func.lower(func.trim(teacher_name)), unique=True),
    )


class Room(Base):
    __tablename__ = 'room'
    room_id = Column(Integer, primary_key=True, index=True)
    room_number = Column(String, nullable=False)
    room_type = Column(String, default='classroom')
    timetables = relationship('Timetable', back_populates='room', cascade="all, delete-orphan")
    __table_args__ = (
        Index('uq_room_room_number_lower', func.lower(func.trim(room_number)), unique=True),
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


class TeachingAssignment(Base):
    """Context-aware assignment: teacher + shared subject + specific division."""
    __tablename__ = 'teaching_assignment'
    assignment_id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey('teacher.teacher_id'), nullable=False)
    definition_id = Column(Integer, ForeignKey('subject_definition.definition_id'), nullable=False)
    division_id = Column(Integer, ForeignKey('division.division_id'), nullable=False)
    subject_id = Column(Integer, ForeignKey('subject.subject_id'), nullable=False)
    teacher = relationship('Teacher', back_populates='assignments')
    subject_definition = relationship('SubjectDefinition', back_populates='assignments')
    division = relationship('Division', back_populates='assignments')

    __table_args__ = (
        Index('uq_teaching_assignment_scope', teacher_id, definition_id, division_id, unique=True),
    )


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
    constraint_type = Column(String, nullable=False)
    parameters_json = Column(Text)
