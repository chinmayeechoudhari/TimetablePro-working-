import json
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_db
from app.models.calendar import AcademicTerm, CalendarEvent

router = APIRouter(prefix="/calendar", tags=["academic-calendar"])
WEEKDAYS = {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}


class TermCreate(BaseModel):
    academic_year: str = Field(min_length=1, max_length=20)
    term_name: str = Field(min_length=1, max_length=80)
    start_date: date
    end_date: date
    holiday_region: str = Field(default="Maharashtra, India", min_length=1, max_length=120)
    timezone: str = Field(default="Asia/Kolkata", min_length=1, max_length=64)
    working_days: list[str] = Field(default_factory=lambda: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"])
    reschedule_policy: Literal["cancel", "suggest", "automatic"] = "suggest"
    status: Literal["draft", "active", "archived"] = "draft"

    @model_validator(mode="after")
    def validate_dates_and_days(self):
        if self.end_date < self.start_date:
            raise ValueError("Term end date must be on or after the start date.")
        if not self.working_days or any(day not in WEEKDAYS for day in self.working_days):
            raise ValueError("Choose at least one valid working day.")
        if len(set(self.working_days)) != len(self.working_days):
            raise ValueError("Working days must not contain duplicates.")
        return self


class TermUpdate(BaseModel):
    academic_year: str | None = Field(default=None, min_length=1, max_length=20)
    term_name: str | None = Field(default=None, min_length=1, max_length=80)
    start_date: date | None = None
    end_date: date | None = None
    holiday_region: str | None = Field(default=None, min_length=1, max_length=120)
    timezone: str | None = Field(default=None, min_length=1, max_length=64)
    working_days: list[str] | None = None
    reschedule_policy: Literal["cancel", "suggest", "automatic"] | None = None
    status: Literal["draft", "active", "archived"] | None = None


class EventCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    event_type: Literal["holiday", "vacation", "exam", "event", "closure", "working_day"] = "holiday"
    start_date: date
    end_date: date
    is_closure: bool = True
    is_working_day_override: bool | None = None
    source: str = Field(default="manual", max_length=200)
    approval_status: Literal["pending", "approved", "rejected"] = "approved"
    notes: str | None = None

    @model_validator(mode="after")
    def validate_dates(self):
        if self.end_date < self.start_date:
            raise ValueError("Event end date must be on or after its start date.")
        if self.event_type == "working_day":
            self.is_closure = False
            self.is_working_day_override = True
        return self


def serialize_term(term: AcademicTerm):
    return {
        "term_id": term.term_id,
        "academic_year": term.academic_year,
        "term_name": term.term_name,
        "start_date": term.start_date.isoformat(),
        "end_date": term.end_date.isoformat(),
        "holiday_region": term.holiday_region,
        "timezone": term.timezone,
        "working_days": json.loads(term.working_days_json or "[]"),
        "reschedule_policy": term.reschedule_policy,
        "status": term.status,
        "created_at": term.created_at.isoformat() if term.created_at else None,
    }


def serialize_event(event: CalendarEvent):
    return {
        "event_id": event.event_id,
        "term_id": event.term_id,
        "title": event.title,
        "event_type": event.event_type,
        "start_date": event.start_date.isoformat(),
        "end_date": event.end_date.isoformat(),
        "is_closure": event.is_closure,
        "is_working_day_override": event.is_working_day_override,
        "source": event.source,
        "approval_status": event.approval_status,
        "notes": event.notes,
    }


def get_term_or_404(db: Session, term_id: int):
    term = db.query(AcademicTerm).filter(AcademicTerm.term_id == term_id).first()
    if not term:
        raise HTTPException(status_code=404, detail="Academic term not found.")
    return term


@router.get("/terms")
def list_terms(db: Session = Depends(get_db)):
    terms = db.query(AcademicTerm).order_by(AcademicTerm.start_date.desc(), AcademicTerm.term_id.desc()).all()
    return [serialize_term(term) for term in terms]


@router.post("/terms", status_code=201)
def create_term(payload: TermCreate, db: Session = Depends(get_db)):
    term = AcademicTerm(
        academic_year=payload.academic_year.strip(),
        term_name=payload.term_name.strip(),
        start_date=payload.start_date,
        end_date=payload.end_date,
        holiday_region=payload.holiday_region.strip(),
        timezone=payload.timezone.strip(),
        working_days_json=json.dumps(payload.working_days),
        reschedule_policy=payload.reschedule_policy,
        status=payload.status,
    )
    db.add(term)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A term with this academic year and name already exists.")
    db.refresh(term)
    return serialize_term(term)


@router.patch("/terms/{term_id}")
def update_term(term_id: int, payload: TermUpdate, db: Session = Depends(get_db)):
    term = get_term_or_404(db, term_id)
    data = payload.model_dump(exclude_unset=True)
    if "working_days" in data:
        days = data.pop("working_days")
        if days is not None:
            if not days or any(day not in WEEKDAYS for day in days) or len(set(days)) != len(days):
                raise HTTPException(status_code=422, detail="Working days must be unique valid weekdays, with at least one selected.")
            term.working_days_json = json.dumps(days)
    for field, value in data.items():
        if value is not None:
            setattr(term, field, value)
    if term.end_date < term.start_date:
        raise HTTPException(status_code=422, detail="Term end date must be on or after the start date.")
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A term with this academic year and name already exists.")
    db.refresh(term)
    return serialize_term(term)


@router.delete("/terms/{term_id}", status_code=204)
def delete_term(term_id: int, db: Session = Depends(get_db)):
    term = get_term_or_404(db, term_id)
    db.delete(term)
    db.commit()
    return None


@router.get("/terms/{term_id}/events")
def list_events(term_id: int, from_date: date | None = Query(default=None), to_date: date | None = Query(default=None), db: Session = Depends(get_db)):
    get_term_or_404(db, term_id)
    query = db.query(CalendarEvent).filter(CalendarEvent.term_id == term_id)
    if from_date:
        query = query.filter(CalendarEvent.end_date >= from_date)
    if to_date:
        query = query.filter(CalendarEvent.start_date <= to_date)
    events = query.order_by(CalendarEvent.start_date, CalendarEvent.event_id).all()
    return [serialize_event(event) for event in events]


@router.post("/terms/{term_id}/events", status_code=201)
def create_event(term_id: int, payload: EventCreate, db: Session = Depends(get_db)):
    term = get_term_or_404(db, term_id)
    if payload.start_date < term.start_date or payload.end_date > term.end_date:
        raise HTTPException(status_code=422, detail="Calendar events must fall within the selected term dates.")
    event = CalendarEvent(term_id=term_id, **payload.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return serialize_event(event)


@router.patch("/events/{event_id}")
def update_event(event_id: int, payload: EventCreate, db: Session = Depends(get_db)):
    event = db.query(CalendarEvent).filter(CalendarEvent.event_id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Calendar event not found.")
    term = get_term_or_404(db, event.term_id)
    if payload.start_date < term.start_date or payload.end_date > term.end_date:
        raise HTTPException(status_code=422, detail="Calendar events must fall within the selected term dates.")
    for field, value in payload.model_dump().items():
        setattr(event, field, value)
    db.commit()
    db.refresh(event)
    return serialize_event(event)


@router.delete("/events/{event_id}", status_code=204)
def delete_event(event_id: int, db: Session = Depends(get_db)):
    event = db.query(CalendarEvent).filter(CalendarEvent.event_id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Calendar event not found.")
    db.delete(event)
    db.commit()
    return None
