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



@router.post("/terms/{term_id}/holidays/import")
def import_public_holidays(term_id: int, db: Session = Depends(get_db)):
    """Load the college's AY 2026-27 Semester I calendar, then add public holidays when available."""
    from urllib.error import URLError, HTTPError
    from urllib.request import Request, urlopen

    term = get_term_or_404(db, term_id)
    # Transcribed from the college-issued Academic Activity Calendar AY 2026-27 SEM I.
    # Events outside the configured term are naturally skipped.
    college_events = [
        ("2026-08-15", "Independence Day", "holiday", True),
        ("2026-08-26", "Eid-e-Milad", "holiday", True),
        ("2026-08-31", "Foundation Day", "event", False),
        ("2026-09-07", "MSE", "exam", False),
        ("2026-09-08", "MSE", "exam", False),
        ("2026-09-09", "MSE", "exam", False),
        ("2026-09-10", "MSE", "exam", False),
        ("2026-09-11", "MSE", "exam", False),
        ("2026-09-12", "MSE", "exam", False),
        ("2026-09-18", "Gauri Pujan", "holiday", True),
        ("2026-09-25", "Anant Chaturdashi", "holiday", True),
        ("2026-10-02", "Gandhi Jayanti / Dasara (college calendar)", "holiday", True),
        ("2026-10-20", "Vijaya Dashmi / Dasara", "holiday", True),
        ("2026-11-06", "Diwali break", "vacation", True),
        ("2026-11-07", "Diwali break", "vacation", True),
        ("2026-11-08", "Diwali break", "vacation", True),
        ("2026-11-09", "Diwali break", "vacation", True),
        ("2026-11-10", "Diwali break", "vacation", True),
        ("2026-11-11", "Diwali break", "vacation", True),
        ("2026-11-12", "Diwali break", "vacation", True),
        ("2026-11-16", "Internal Assessment GD/PPT, CP", "exam", False),
        ("2026-11-17", "Internal Assessment GD/PPT, CP", "exam", False),
        ("2026-11-18", "Internal Assessment GD/PPT, CP", "exam", False),
        ("2026-11-19", "Internal Assessment GD/PPT, CP", "exam", False),
        ("2026-11-20", "Internal Assessment GD/PPT, CP", "exam", False),
        ("2026-11-21", "Internal Assessment GD/PPT, CP", "exam", False),
        ("2026-11-23", "PL", "event", False),
        ("2026-11-24", "Guru Nanak Jayanti", "holiday", True),
        ("2026-11-25", "PL", "event", False),
        ("2026-11-26", "ESE", "exam", False),
        ("2026-11-27", "ESE", "exam", False),
        ("2026-11-28", "ESE", "exam", False),
        ("2026-12-01", "ESE", "exam", False),
        ("2026-12-02", "ESE", "exam", False),
        ("2026-12-03", "ESE", "exam", False),
        ("2026-12-04", "ESE", "exam", False),
        ("2026-12-05", "ESE", "exam", False),
        ("2026-12-07", "ESE", "exam", False),
        ("2026-12-08", "ESE", "exam", False),
        ("2026-12-09", "ESE", "exam", False),
        ("2026-12-10", "ESE", "exam", False),
        ("2026-12-11", "ESE", "exam", False),
        ("2026-12-12", "ESE", "exam", False),
        ("2026-12-14", "ESE", "exam", False),
        ("2026-12-15", "ESE", "exam", False),
        ("2026-12-25", "Christmas", "holiday", True),
    ]
    imported_college = 0
    skipped = 0

    for date_text, title, event_type, is_closure in college_events:
        event_date = date.fromisoformat(date_text)
        if not term.start_date <= event_date <= term.end_date:
            continue
        exists = db.query(CalendarEvent).filter(
            CalendarEvent.term_id == term_id,
            CalendarEvent.start_date == event_date,
            CalendarEvent.title == title,
        ).first()
        if exists:
            skipped += 1
            continue
        db.add(CalendarEvent(
            term_id=term_id,
            title=title,
            event_type=event_type,
            start_date=event_date,
            end_date=event_date,
            is_closure=is_closure,
            is_working_day_override=False,
            source="College Academic Activity Calendar AY 2026-27 SEM I",
            approval_status="approved",
            notes="Loaded from the college-issued semester calendar. Verify against any later official circular.",
        ))
        imported_college += 1

    # Supplement with national/state public holidays if the external service is reachable.
    imported_public = 0
    public_feed_available = True
    for year in range(term.start_date.year, term.end_date.year + 1):
        try:
            request = Request(
                f"https://date.nager.at/api/v3/PublicHolidays/{year}/IN",
                headers={"User-Agent": "TimetablePro/1.0"},
            )
            with urlopen(request, timeout=4) as response:
                holidays = json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError, ValueError, OSError):
            public_feed_available = False
            continue

        for holiday in holidays:
            try:
                event_date = date.fromisoformat(holiday["date"])
            except (KeyError, ValueError):
                continue
            if not term.start_date <= event_date <= term.end_date:
                continue
            counties = holiday.get("counties") or []
            if "maharashtra" in (term.holiday_region or "").lower() and counties and "IN-MH" not in counties:
                continue
            title = holiday.get("localName") or holiday.get("name") or "Public holiday"
            exists = db.query(CalendarEvent).filter(
                CalendarEvent.term_id == term_id,
                CalendarEvent.start_date == event_date,
                CalendarEvent.title == title,
            ).first()
            if exists:
                skipped += 1
                continue
            db.add(CalendarEvent(
                term_id=term_id,
                title=title,
                event_type="holiday",
                start_date=event_date,
                end_date=event_date,
                is_closure=True,
                is_working_day_override=False,
                source="Nager.Date public holiday API",
                approval_status="approved",
                notes="Public holiday feed entry; verify local applicability.",
            ))
            imported_public += 1

    db.commit()
    return {
        "imported": imported_college + imported_public,
        "college_calendar_imported": imported_college,
        "public_holidays_imported": imported_public,
        "skipped": skipped,
        "public_feed_available": public_feed_available,
        "message": (
            f"Loaded {imported_college} college-calendar entries and {imported_public} public holidays."
            + ("" if public_feed_available else " The public-holiday service was unavailable, but the built-in college calendar was loaded.")
        ),
    }


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



@router.get("/terms/{term_id}/schedule")
def get_term_schedule(term_id: int, db: Session = Depends(get_db)):
    """Expand the generated weekly pattern into dated classes for a term.

    Approved closures and non-working weekdays suppress regular classes.
    Classes that fall on closures are returned as cancelled occurrences with
    an optional replacement-date suggestion; suggestions are never applied
    automatically.
    """
    from datetime import timedelta
    from app.models.models import Timetable, TimeSlot

    term = get_term_or_404(db, term_id)
    weekly_rows = db.query(Timetable).all()
    slots = {slot.slot_id: slot for slot in db.query(TimeSlot).all()}
    events = (
        db.query(CalendarEvent)
        .filter(
            CalendarEvent.term_id == term_id,
            CalendarEvent.approval_status == "approved",
        )
        .order_by(CalendarEvent.start_date, CalendarEvent.event_id)
        .all()
    )
    working_days = set(json.loads(term.working_days_json or "[]"))

    def events_for(day):
        return [event for event in events if event.start_date <= day <= event.end_date]

    def day_state(day):
        day_events = events_for(day)
        force_working = any(event.is_working_day_override is True for event in day_events)
        is_closed = any(event.is_closure for event in day_events) and not force_working
        is_working = force_working or day.strftime("%A") in working_days
        return is_working and not is_closed, day_events, is_closed

    def conflicts(candidate_date, row, slot):
        for other in weekly_rows:
            other_slot = slots.get(other.slot_id)
            if not other_slot or other_slot.day != candidate_date.strftime("%A"):
                continue
            if other_slot.period_number != slot.period_number:
                continue
            if (
                other.class_id == row.class_id
                or other.teacher_id == row.teacher_id
                or other.room_id == row.room_id
            ):
                return True
        return False

    results = []
    day = term.start_date
    while day <= term.end_date:
        is_working, day_events, is_closed = day_state(day)
        matching_rows = [
            (row, slots.get(row.slot_id))
            for row in weekly_rows
            if slots.get(row.slot_id) and slots[row.slot_id].day == day.strftime("%A")
        ]
        if is_working:
            for row, slot in matching_rows:
                results.append({
                    "date": day.isoformat(),
                    "weekday": day.strftime("%A"),
                    "status": "scheduled",
                    "class_id": row.class_id,
                    "subject_id": row.subject_id,
                    "teacher_id": row.teacher_id,
                    "room_id": row.room_id,
                    "slot_id": row.slot_id,
                    "period_number": slot.period_number,
                    "event_titles": [event.title for event in day_events],
                    "suggested_replacement_date": None,
                })
        elif is_closed:
            for row, slot in matching_rows:
                suggestion = None
                if term.reschedule_policy == "suggest":
                    candidate = day + timedelta(days=1)
                    while candidate <= term.end_date:
                        candidate_working, _, candidate_closed = day_state(candidate)
                        if candidate_working and not candidate_closed and not conflicts(candidate, row, slot):
                            suggestion = candidate.isoformat()
                            break
                        candidate += timedelta(days=1)
                results.append({
                    "date": day.isoformat(),
                    "weekday": day.strftime("%A"),
                    "status": "cancelled_holiday",
                    "class_id": row.class_id,
                    "subject_id": row.subject_id,
                    "teacher_id": row.teacher_id,
                    "room_id": row.room_id,
                    "slot_id": row.slot_id,
                    "period_number": slot.period_number,
                    "event_titles": [event.title for event in day_events],
                    "suggested_replacement_date": suggestion,
                    "requires_admin_approval": bool(suggestion),
                })
        day += timedelta(days=1)

    return {
        "term": serialize_term(term),
        "total_sessions": sum(item["status"] == "scheduled" for item in results),
        "cancelled_sessions": sum(item["status"] == "cancelled_holiday" for item in results),
        "sessions": results,
        "note": "Replacement dates are suggestions only and are not applied without administrator approval.",
    }


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
