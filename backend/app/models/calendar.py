from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import relationship

from app.core.config import Base


class AcademicTerm(Base):
    """Configurable date range and calendar policy for one academic term."""
    __tablename__ = "academic_term"

    term_id = Column(Integer, primary_key=True, index=True)
    academic_year = Column(String(20), nullable=False)
    term_name = Column(String(80), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    holiday_region = Column(String(120), nullable=False, default="Maharashtra, India")
    timezone = Column(String(64), nullable=False, default="Asia/Kolkata")
    working_days_json = Column(Text, nullable=False, default='["Monday","Tuesday","Wednesday","Thursday","Friday"]')
    reschedule_policy = Column(String(32), nullable=False, default="suggest")
    status = Column(String(20), nullable=False, default="draft")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    events = relationship("CalendarEvent", back_populates="term", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("academic_year", "term_name", name="uq_academic_term_year_name"),
    )


class CalendarEvent(Base):
    """An institution calendar event or working-day exception within a term."""
    __tablename__ = "calendar_event"

    event_id = Column(Integer, primary_key=True, index=True)
    term_id = Column(Integer, ForeignKey("academic_term.term_id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(160), nullable=False)
    event_type = Column(String(32), nullable=False, default="holiday")
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    is_closure = Column(Boolean, nullable=False, default=True)
    is_working_day_override = Column(Boolean, nullable=True)
    source = Column(String(200), nullable=False, default="manual")
    approval_status = Column(String(24), nullable=False, default="approved")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    term = relationship("AcademicTerm", back_populates="events")
