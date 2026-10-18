from sqlalchemy import (
    Boolean, Column, Date, DateTime, ForeignKey, Index, Integer, String, Text,
    UniqueConstraint, func,
)
from sqlalchemy.orm import relationship

from app.core.config import Base


class TimetableVersion(Base):
    """Immutable snapshot container for one semester timetable revision."""
    __tablename__ = "timetable_version"

    version_id = Column(Integer, primary_key=True, index=True)
    term_id = Column(Integer, ForeignKey("academic_term.term_id", ondelete="CASCADE"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    status = Column(String(20), nullable=False, default="draft")  # draft, published, archived
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    published_at = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(String(120), nullable=True)
    notes = Column(Text, nullable=True)

    sessions = relationship("ScheduledSession", back_populates="version", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("term_id", "version_number", name="uq_timetable_version_term_number"),
        Index("ix_timetable_version_term_status", "term_id", "status"),
    )


class ScheduledSession(Base):
    """One dated class occurrence in a specific timetable version."""
    __tablename__ = "scheduled_session"

    session_id = Column(Integer, primary_key=True, index=True)
    version_id = Column(Integer, ForeignKey("timetable_version.version_id", ondelete="CASCADE"), nullable=False, index=True)
    session_date = Column(Date, nullable=False, index=True)
    weekday = Column(String(12), nullable=False)
    period_number = Column(Integer, nullable=False)
    slot_id = Column(Integer, ForeignKey("timeslot.slot_id"), nullable=True)
    class_id = Column(Integer, ForeignKey("class.class_id"), nullable=False, index=True)
    subject_id = Column(Integer, ForeignKey("subject.subject_id"), nullable=False, index=True)
    teacher_id = Column(Integer, ForeignKey("teacher.teacher_id"), nullable=False, index=True)
    room_id = Column(Integer, ForeignKey("room.room_id"), nullable=False, index=True)
    session_status = Column(String(20), nullable=False, default="scheduled")
    is_locked = Column(Boolean, nullable=False, default=False)
    lock_reason = Column(String(500), nullable=True)
    locked_at = Column(DateTime(timezone=True), nullable=True)
    locked_by = Column(String(120), nullable=True)
    closure_conflict = Column(Boolean, nullable=False, default=False)
    source_event_id = Column(Integer, ForeignKey("calendar_event.event_id", ondelete="SET NULL"), nullable=True)
    original_session_id = Column(Integer, ForeignKey("scheduled_session.session_id", ondelete="SET NULL"), nullable=True)
    replacement_approved = Column(Boolean, nullable=False, default=False)
    outcome_note = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    version = relationship("TimetableVersion", back_populates="sessions")
    original_session = relationship("ScheduledSession", remote_side=[session_id], foreign_keys=[original_session_id], uselist=False)

    __table_args__ = (
        UniqueConstraint("version_id", "session_date", "class_id", "period_number", name="uq_session_version_date_class_period"),
        Index("ix_session_version_date", "version_id", "session_date"),
        Index("ix_session_version_status", "version_id", "session_status"),
    )
