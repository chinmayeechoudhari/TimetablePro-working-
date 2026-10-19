import json
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_db
from app.models.calendar import AcademicTerm, CalendarEvent
from app.models.models import Class, Room, Subject, Teacher, TeacherAvailability, TimeSlot, Timetable
from app.models.semester import ScheduledSession, TimetableVersion

router = APIRouter(prefix="/semester", tags=["semester-timetables"])
WORKING_DAYS = {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}
SESSION_STATUSES = {"scheduled", "completed", "cancelled", "missed", "rescheduled", "outstanding"}


class LockUpdate(BaseModel):
    locked: bool
    reason: str | None = Field(default=None, max_length=500)
    actor: str | None = Field(default=None, max_length=120)


class OutcomeUpdate(BaseModel):
    status: Literal["completed", "missed", "cancelled"]
    note: str | None = None


class ReplacementRequest(BaseModel):
    replacement_date: date
    period_number: int = Field(ge=1, le=24)
    slot_id: int | None = None
    approved: bool = False
    actor: str | None = Field(default=None, max_length=120)
    note: str | None = None


def _term(db: Session, term_id: int) -> AcademicTerm:
    term = db.query(AcademicTerm).filter(AcademicTerm.term_id == term_id).first()
    if term is None:
        raise HTTPException(status_code=404, detail="Academic term not found.")
    return term


def _working_days(term: AcademicTerm) -> set[str]:
    try:
        working_days = set(json.loads(term.working_days_json or "[]"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="Term working days are not valid JSON.")
    if not working_days or not working_days.issubset(WORKING_DAYS):
        raise HTTPException(status_code=422, detail="Term working days are invalid.")
    return working_days


def _version(db: Session, version_id: int) -> TimetableVersion:
    version = db.query(TimetableVersion).filter(TimetableVersion.version_id == version_id).first()
    if version is None:
        raise HTTPException(status_code=404, detail="Timetable version not found.")
    return version


def _session(db: Session, session_id: int) -> ScheduledSession:
    item = db.query(ScheduledSession).filter(ScheduledSession.session_id == session_id).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Scheduled session not found.")
    return item


def _event_state(events, day, working_days):
    active = [e for e in events if e.start_date <= day <= e.end_date]
    override = any(e.is_working_day_override is True for e in active)
    closed = any(e.is_closure for e in active) and not override
    working = override or day.strftime("%A") in working_days
    return working and not closed, closed, active

def _target_for_week(periods_per_week, start, end, events, working_days):
    """Return the full weekly subject target for every week touched by a term."""
    periods = max(0, int(periods_per_week or 0))
    if periods == 0 or end < start or not working_days:
        return 0
    return periods


def _schedule_conflicts(sessions):
    """Return teacher, room, or class double-bookings in the same dated period."""
    active_statuses = {"scheduled", "completed", "missed"}
    buckets = defaultdict(list)
    for session in sessions:
        if session.session_status not in active_statuses:
            continue
        buckets[(session.session_date, session.period_number)].append(session)

    conflicts = []
    for (session_date, period_number), rows in buckets.items():
        for resource, attr in (("class", "class_id"), ("teacher", "teacher_id"), ("room", "room_id")):
            by_id = defaultdict(list)
            for row in rows:
                by_id[getattr(row, attr)].append(row)
            for resource_id, duplicate_rows in by_id.items():
                if len(duplicate_rows) > 1:
                    conflicts.append({
                        "date": session_date.isoformat(),
                        "period_number": period_number,
                        "resource": resource,
                        "resource_id": resource_id,
                        "session_ids": [row.session_id for row in duplicate_rows],
                    })
    return conflicts


def _find_replacement(db: Session, original: ScheduledSession, term: AcademicTerm, version: TimetableVersion):
    """Find earliest valid replacement; prefer the original week, then later weeks."""
    events = db.query(CalendarEvent).filter(
        CalendarEvent.term_id == term.term_id,
        CalendarEvent.approval_status == "approved",
    ).all()
    working_days = _working_days(term)
    slots = db.query(TimeSlot).order_by(TimeSlot.period_number.asc()).all()
    unavailable = {
        (item.teacher_id, item.slot_id)
        for item in db.query(TeacherAvailability).filter(TeacherAvailability.is_available.is_(False)).all()
    }
    start_week = original.session_date - timedelta(days=original.session_date.weekday())
    candidates = []
    day = max(term.start_date, original.session_date + timedelta(days=1))
    while day <= term.end_date:
        is_working, is_closed, _ = _event_state(events, day, working_days)
        if is_working and not is_closed:
            same_week = (day - timedelta(days=day.weekday())) == start_week
            for slot in slots:
                if slot.day != day.strftime("%A"):
                    continue
                if (original.teacher_id, slot.slot_id) in unavailable:
                    continue
                # Respect the teacher's daily workload target as a hard safety guard
                # for replacement placement; the generator's normal solver handles
                # workload as a soft preference.
                teacher = db.query(Teacher).filter(Teacher.teacher_id == original.teacher_id).first()
                if teacher and teacher.max_periods_per_day:
                    teacher_day_count = db.query(ScheduledSession).filter(
                        ScheduledSession.version_id == version.version_id,
                        ScheduledSession.session_date == day,
                        ScheduledSession.teacher_id == original.teacher_id,
                        ScheduledSession.session_status.in_(["scheduled", "completed"]),
                    ).count()
                    if teacher_day_count >= teacher.max_periods_per_day:
                        continue
                candidates.append((0 if same_week else 1, day, slot.period_number, slot.slot_id))
        day += timedelta(days=1)
    candidates.sort(key=lambda x: (x[0], x[1], x[2]))
    for _, day, period, slot_id in candidates:
        existing = db.query(ScheduledSession).filter(
            ScheduledSession.version_id == version.version_id,
            ScheduledSession.session_date == day,
            ScheduledSession.period_number == period,
            ScheduledSession.session_status.in_(["scheduled", "completed"]),
        ).all()
        if any(s.class_id == original.class_id or s.teacher_id == original.teacher_id or s.room_id == original.room_id for s in existing):
            continue
        return day, period, slot_id
    return None


def _apply_replacement(db: Session, original: ScheduledSession, term: AcademicTerm, version: TimetableVersion, approved: bool = True, note: str | None = None):
    if original.is_locked:
        original.closure_conflict = True
        return None
    found = _find_replacement(db, original, term, version)
    if not found:
        original.session_status = "outstanding"
        original.outcome_note = note or "No valid replacement slot was found within the semester."
        return None
    day, period, slot_id = found
    replacement = ScheduledSession(
        version_id=version.version_id,
        session_date=day,
        weekday=day.strftime("%A"),
        period_number=period,
        slot_id=slot_id,
        class_id=original.class_id,
        subject_id=original.subject_id,
        teacher_id=original.teacher_id,
        room_id=original.room_id,
        session_status="scheduled" if approved else "outstanding",
        original_session_id=original.session_id,
        replacement_approved=approved,
        outcome_note=note,
    )
    original.session_status = "rescheduled" if approved else "outstanding"
    original.outcome_note = note or original.outcome_note
    db.add(replacement)
    return replacement


def _serialize_session(item):
    return {
        "session_id": item.session_id,
        "version_id": item.version_id,
        "date": item.session_date.isoformat(),
        "weekday": item.weekday,
        "period_number": item.period_number,
        "slot_id": item.slot_id,
        "class_id": item.class_id,
        "subject_id": item.subject_id,
        "teacher_id": item.teacher_id,
        "room_id": item.room_id,
        "status": item.session_status,
        "is_locked": item.is_locked,
        "lock_reason": item.lock_reason,
        "closure_conflict": item.closure_conflict,
        "source_event_id": item.source_event_id,
        "original_session_id": item.original_session_id,
        "replacement_approved": item.replacement_approved,
        "outcome_note": item.outcome_note,
    }


def _serialize_version(item, include_sessions=False):
    result = {
        "version_id": item.version_id,
        "term_id": item.term_id,
        "version_number": item.version_number,
        "status": item.status,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "published_at": item.published_at.isoformat() if item.published_at else None,
        "created_by": item.created_by,
        "notes": item.notes,
    }
    if include_sessions:
        result["sessions"] = [_serialize_session(s) for s in sorted(item.sessions, key=lambda x: (x.session_date, x.period_number, x.class_id))]
    return result


@router.get("/terms/{term_id}/versions")
def list_versions(term_id: int, db: Session = Depends(get_db)):
    _term(db, term_id)
    rows = db.query(TimetableVersion).filter(TimetableVersion.term_id == term_id).order_by(TimetableVersion.version_number.desc()).all()
    return [_serialize_version(row, include_sessions=True) for row in rows]


@router.post("/terms/{term_id}/versions/draft", status_code=201)
def create_draft(term_id: int, created_by: str | None = None, notes: str | None = None, db: Session = Depends(get_db)):
    """Expand the current weekly template into a versioned, date-aware draft.

    Existing published session records remain untouched. Locked sessions from
    the latest version are carried forward by date/class/subject and retain
    their full assignment; a closure collision is flagged rather than moved.
    """
    term = _term(db, term_id)
    if term.end_date < term.start_date:
        raise HTTPException(status_code=422, detail="Term end date must be on or after its start date.")

    weekly_rows = db.query(Timetable).all()
    slots = {x.slot_id: x for x in db.query(TimeSlot).all()}
    if not weekly_rows:
        raise HTTPException(status_code=409, detail="Generate a valid weekly timetable before creating a semester draft.")
    if any(row.slot_id not in slots for row in weekly_rows):
        raise HTTPException(status_code=409, detail="The weekly timetable references a missing time slot.")

    previous = db.query(TimetableVersion).filter(TimetableVersion.term_id == term_id).order_by(TimetableVersion.version_number.desc()).first()
    previous_sessions = previous.sessions if previous else []
    locked_by_key = {
        (s.session_date, s.class_id, s.period_number): s
        for s in previous_sessions if s.is_locked
    }
    events = db.query(CalendarEvent).filter(
        CalendarEvent.term_id == term_id,
        CalendarEvent.approval_status == "approved",
    ).order_by(CalendarEvent.start_date, CalendarEvent.event_id).all()
    try:
        working_days = _working_days(term)
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="Term working days are not valid JSON.")
    if not working_days or not working_days.issubset(WORKING_DAYS):
        raise HTTPException(status_code=422, detail="Term working days are invalid.")

    next_number = (previous.version_number + 1) if previous else 1
    version = TimetableVersion(term_id=term_id, version_number=next_number, status="draft", created_by=created_by, notes=notes)
    db.add(version)
    db.flush()

    preserved_lock_keys = set()
    for day_offset in range((term.end_date - term.start_date).days + 1):
        day = term.start_date + timedelta(days=day_offset)
        is_working, is_closed, day_events = _event_state(events, day, working_days)
        matching = [(row, slots[row.slot_id]) for row in weekly_rows if slots[row.slot_id].day == day.strftime("%A")]
        for row, slot in matching:
            locked = locked_by_key.get((day, row.class_id, slot.period_number))
            if locked:
                preserved_lock_keys.add((locked.session_date, locked.class_id, locked.period_number))
            if not is_working and not (locked and locked.is_locked):
                # Preserve a dated cancelled occurrence so the weekly/term load gap is auditable.
                status = "cancelled" if is_closed else "outstanding"
            else:
                status = "scheduled"
            source_event = next((e for e in day_events if e.is_closure), None) if is_closed else None
            session = ScheduledSession(
                version_id=version.version_id,
                session_date=day,
                weekday=day.strftime("%A"),
                period_number=locked.period_number if locked else slot.period_number,
                slot_id=locked.slot_id if locked else row.slot_id,
                class_id=locked.class_id if locked else row.class_id,
                subject_id=locked.subject_id if locked else row.subject_id,
                teacher_id=locked.teacher_id if locked else row.teacher_id,
                room_id=locked.room_id if locked else row.room_id,
                session_status=status,
                is_locked=bool(locked),
                lock_reason=locked.lock_reason if locked else None,
                locked_at=locked.locked_at if locked else None,
                locked_by=locked.locked_by if locked else None,
                closure_conflict=bool(locked and is_closed),
                source_event_id=source_event.event_id if source_event else None,
                original_session_id=locked.session_id if locked else None,
            )
            version.sessions.append(session)

    # Preserve locks even when the new weekly template no longer contains their period.
    for locked in previous_sessions:
        lock_key = (locked.session_date, locked.class_id, locked.period_number)
        if not locked.is_locked or lock_key in preserved_lock_keys:
            continue
        if locked.session_date < term.start_date or locked.session_date > term.end_date:
            continue
        _, is_closed, day_events = _event_state(events, locked.session_date, working_days)
        source_event = next((e for e in day_events if e.is_closure), None) if is_closed else None
        version.sessions.append(ScheduledSession(
            version_id=version.version_id,
            session_date=locked.session_date,
            weekday=locked.weekday,
            period_number=locked.period_number,
            slot_id=locked.slot_id,
            class_id=locked.class_id,
            subject_id=locked.subject_id,
            teacher_id=locked.teacher_id,
            room_id=locked.room_id,
            session_status="scheduled" if not is_closed else "cancelled",
            is_locked=True,
            lock_reason=locked.lock_reason,
            locked_at=locked.locked_at,
            locked_by=locked.locked_by,
            closure_conflict=is_closed,
            source_event_id=source_event.event_id if source_event else None,
            original_session_id=locked.session_id,
        ))

    # Approved imported closures may be auto-rescheduled when the term policy allows it.
    # Manually created closures remain suggestions for administrator review.
    if term.reschedule_policy == "automatic":
        db.flush()
        for session in list(version.sessions):
            if session.session_status != "cancelled" or not session.source_event_id:
                continue
            event = next((e for e in events if e.event_id == session.source_event_id), None)
            if event and event.source.strip().lower() not in {"manual", "admin", "administrator"}:
                _apply_replacement(db, session, term, version, approved=True, note="Automatically replaced due to approved imported closure.")

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="The draft contains duplicate class/date/period assignments. Resolve the weekly template before retrying.")
    db.refresh(version)
    return _serialize_version(version, include_sessions=True)


@router.get("/versions/{version_id}")
def get_version(version_id: int, db: Session = Depends(get_db)):
    return _serialize_version(_version(db, version_id), include_sessions=True)


@router.post("/versions/{version_id}/publish")
def publish_version(version_id: int, db: Session = Depends(get_db)):
    version = _version(db, version_id)
    if version.status == "archived":
        raise HTTPException(status_code=409, detail="Archived versions cannot be published.")
    pending_events = db.query(CalendarEvent).filter(
        CalendarEvent.term_id == version.term_id,
        CalendarEvent.approval_status == "pending",
    ).count()
    if pending_events:
        raise HTTPException(
            status_code=409,
            detail=f"Resolve {pending_events} pending calendar event review(s) before publishing.",
        )
    sessions = db.query(ScheduledSession).filter(ScheduledSession.version_id == version_id).all()
    if not sessions:
        raise HTTPException(status_code=409, detail="An empty timetable cannot be published.")
    schedule_conflicts = _schedule_conflicts(sessions)
    if schedule_conflicts:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "This version contains class, teacher, or room double-bookings. Resolve them before publishing.",
                "conflicts": schedule_conflicts,
            },
        )
    closure_conflicts = [s.session_id for s in sessions if s.closure_conflict and s.is_locked]
    if closure_conflicts:
        raise HTTPException(status_code=409, detail={"message": "Locked sessions conflict with approved closures. Unlock or resolve them before publishing.", "session_ids": closure_conflicts})
    now = datetime.utcnow()
    db.query(TimetableVersion).filter(
        TimetableVersion.term_id == version.term_id,
        TimetableVersion.status == "published",
        TimetableVersion.version_id != version.version_id,
    ).update({"status": "archived"}, synchronize_session=False)
    version.status = "published"
    version.published_at = now
    db.commit()
    db.refresh(version)
    return _serialize_version(version)


@router.patch("/sessions/{session_id}/lock")
def set_session_lock(session_id: int, payload: LockUpdate, db: Session = Depends(get_db)):
    item = _session(db, session_id)
    version = _version(db, item.version_id)
    if version.status == "archived":
        raise HTTPException(status_code=409, detail="Archived versions are read-only.")
    item.is_locked = payload.locked
    item.lock_reason = payload.reason.strip() if payload.locked and payload.reason else None
    item.locked_by = payload.actor
    item.locked_at = datetime.utcnow() if payload.locked else None
    db.commit()
    db.refresh(item)
    return _serialize_session(item)


@router.patch("/sessions/{session_id}/outcome")
def set_session_outcome(session_id: int, payload: OutcomeUpdate, db: Session = Depends(get_db)):
    item = _session(db, session_id)
    version = _version(db, item.version_id)
    if version.status == "archived":
        raise HTTPException(status_code=409, detail="Archived versions are read-only.")
    if item.is_locked and payload.status in {"cancelled", "missed"}:
        raise HTTPException(status_code=409, detail="Unlock this session before marking a locked session cancelled or missed.")
    item.session_status = payload.status
    item.outcome_note = payload.note
    if payload.status == "missed":
        term = _term(db, version.term_id)
        _apply_replacement(db, item, term, version, approved=True, note=payload.note or "Automatically rescheduled after being marked missed.")
    db.commit()
    db.refresh(item)
    return _serialize_session(item)


@router.post("/sessions/{session_id}/replacement", status_code=201)
def create_replacement(session_id: int, payload: ReplacementRequest, db: Session = Depends(get_db)):
    original = _session(db, session_id)
    version = _version(db, original.version_id)
    term = _term(db, version.term_id)
    if version.status == "archived":
        raise HTTPException(status_code=409, detail="Archived versions are read-only.")
    if original.is_locked:
        raise HTTPException(status_code=409, detail="Unlock this session before creating a replacement.")
    if payload.replacement_date < term.start_date or payload.replacement_date > term.end_date:
        raise HTTPException(status_code=422, detail="Replacement date must fall within the semester.")
    events = db.query(CalendarEvent).filter(
        CalendarEvent.term_id == term.term_id,
        CalendarEvent.approval_status == "approved",
    ).all()
    is_working, is_closed, _ = _event_state(events, payload.replacement_date, _working_days(term))
    if not is_working or is_closed:
        raise HTTPException(status_code=422, detail="Replacement date is not an eligible teaching day.")
    slot = db.query(TimeSlot).filter(TimeSlot.slot_id == payload.slot_id).first() if payload.slot_id else None
    if payload.slot_id and not slot:
        raise HTTPException(status_code=422, detail="Selected time slot does not exist.")
    if slot and (slot.day != payload.replacement_date.strftime("%A") or slot.period_number != payload.period_number):
        raise HTTPException(status_code=422, detail="Selected time slot does not match the replacement date and period.")
    if slot is None:
        slot = db.query(TimeSlot).filter(
            TimeSlot.day == payload.replacement_date.strftime("%A"),
            TimeSlot.period_number == payload.period_number,
        ).first()
        if slot is None:
            raise HTTPException(status_code=422, detail="No configured time slot matches that date and period.")
    availability = db.query(TeacherAvailability).filter(
        TeacherAvailability.teacher_id == original.teacher_id,
        TeacherAvailability.slot_id == slot.slot_id,
        TeacherAvailability.is_available.is_(False),
    ).first()
    if availability:
        raise HTTPException(status_code=409, detail="The assigned teacher is unavailable in this time slot.")
    conflicts = db.query(ScheduledSession).filter(
        ScheduledSession.version_id == version.version_id,
        ScheduledSession.session_date == payload.replacement_date,
        ScheduledSession.period_number == payload.period_number,
        ScheduledSession.session_status.in_(["scheduled", "completed"]),
        ScheduledSession.session_id != original.session_id,
    ).all()
    if any(s.class_id == original.class_id or s.teacher_id == original.teacher_id or s.room_id == original.room_id for s in conflicts):
        raise HTTPException(status_code=409, detail="Replacement conflicts with an existing class, teacher or room assignment.")
    replacement = ScheduledSession(
        version_id=version.version_id,
        session_date=payload.replacement_date,
        weekday=payload.replacement_date.strftime("%A"),
        period_number=payload.period_number,
        slot_id=slot.slot_id if slot else None,
        class_id=original.class_id,
        subject_id=original.subject_id,
        teacher_id=original.teacher_id,
        room_id=original.room_id,
        session_status="scheduled" if payload.approved else "outstanding",
        original_session_id=original.session_id,
        replacement_approved=payload.approved,
        outcome_note=payload.note,
        is_locked=False,
    )
    original.session_status = "rescheduled" if payload.approved else "outstanding"
    original.outcome_note = payload.note or original.outcome_note
    db.add(replacement)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A class already occupies that date and period.")
    db.refresh(replacement)
    return _serialize_session(replacement)


@router.post("/sessions/{session_id}/replacement/approve")
def approve_replacement(session_id: int, db: Session = Depends(get_db)):
    replacement = _session(db, session_id)
    version = _version(db, replacement.version_id)
    if version.status == "archived":
        raise HTTPException(status_code=409, detail="Archived versions are read-only.")
    if not replacement.original_session_id:
        raise HTTPException(status_code=422, detail="This session is not a replacement.")
    original = _session(db, replacement.original_session_id)
    if replacement.session_status != "outstanding":
        raise HTTPException(status_code=409, detail="Only a pending replacement can be approved.")
    term = _term(db, version.term_id)
    if replacement.session_date < term.start_date or replacement.session_date > term.end_date:
        raise HTTPException(status_code=409, detail="Replacement is outside the current semester range.")
    if original.is_locked:
        raise HTTPException(status_code=409, detail="The original session is locked; unlock it before approving a replacement.")
    events = db.query(CalendarEvent).filter(
        CalendarEvent.term_id == term.term_id,
        CalendarEvent.approval_status == "approved",
    ).all()
    eligible, closed, _ = _event_state(events, replacement.session_date, _working_days(term))
    if not eligible or closed:
        raise HTTPException(status_code=409, detail="The replacement date is no longer an eligible teaching day.")
    if replacement.slot_id:
        slot = db.query(TimeSlot).filter(TimeSlot.slot_id == replacement.slot_id).first()
        if not slot or slot.day != replacement.weekday or slot.period_number != replacement.period_number:
            raise HTTPException(status_code=409, detail="The replacement time slot is no longer valid.")
        unavailable = db.query(TeacherAvailability).filter(
            TeacherAvailability.teacher_id == replacement.teacher_id,
            TeacherAvailability.slot_id == replacement.slot_id,
            TeacherAvailability.is_available.is_(False),
        ).first()
        if unavailable:
            raise HTTPException(status_code=409, detail="The assigned teacher is unavailable in the replacement slot.")
    conflicts = db.query(ScheduledSession).filter(
        ScheduledSession.version_id == version.version_id,
        ScheduledSession.session_date == replacement.session_date,
        ScheduledSession.period_number == replacement.period_number,
        ScheduledSession.session_status.in_(["scheduled", "completed"]),
        ScheduledSession.session_id != replacement.session_id,
    ).all()
    if any(s.class_id == replacement.class_id or s.teacher_id == replacement.teacher_id or s.room_id == replacement.room_id for s in conflicts):
        raise HTTPException(status_code=409, detail="The replacement now conflicts with another class, teacher or room.")
    replacement.replacement_approved = True
    replacement.session_status = "scheduled"
    original.session_status = "rescheduled"
    db.commit()
    db.refresh(replacement)
    return {"original": _serialize_session(original), "replacement": _serialize_session(replacement)}


@router.get("/terms/{term_id}/dashboard")
def term_dashboard(term_id: int, version_id: int | None = None, db: Session = Depends(get_db)):
    term = _term(db, term_id)
    if version_id is not None:
        version = db.query(TimetableVersion).filter(
            TimetableVersion.version_id == version_id,
            TimetableVersion.term_id == term_id,
        ).first()
        if version is None:
            raise HTTPException(status_code=404, detail="Timetable version not found for this semester.")
    else:
        version = db.query(TimetableVersion).filter(
            TimetableVersion.term_id == term_id,
            TimetableVersion.status == "published",
        ).order_by(TimetableVersion.version_number.desc()).first()
        if not version:
            version = db.query(TimetableVersion).filter(TimetableVersion.term_id == term_id).order_by(TimetableVersion.version_number.desc()).first()
    if not version:
        return {"term": {"term_id": term.term_id, "term_name": term.term_name}, "version": None, "summary": {"required_periods": 0, "scheduled": 0, "completed": 0, "cancelled": 0, "rescheduled": 0, "outstanding": 0, "unresolved_locked_conflicts": 0}, "subject_loads": [], "incomplete": True}

    sessions = db.query(ScheduledSession).filter(ScheduledSession.version_id == version.version_id).all()
    status_counts = Counter(s.session_status for s in sessions)
    subjects = {s.subject_id: s for s in db.query(Subject).all()}
    classes = {c.class_id: c for c in db.query(Class).all()}
    weekly_template = db.query(Timetable).all()
    # Count touched Monday-Sunday calendar weeks, including partial weeks at both ends.
    first_monday = term.start_date - timedelta(days=term.start_date.weekday())
    last_sunday = term.end_date + timedelta(days=6 - term.end_date.weekday())
    weeks = ((last_sunday - first_monday).days // 7) + 1
    unique_class_subjects = {(row.class_id, row.subject_id) for row in weekly_template}
    events = db.query(CalendarEvent).filter(
        CalendarEvent.term_id == term_id,
        CalendarEvent.approval_status == "approved",
    ).all()
    working_days = _working_days(term)
    required_by_pair = {}
    for class_id, subject_id in unique_class_subjects:
        subject = subjects.get(subject_id)
        pair_target = 0
        if subject:
            for week_index in range(weeks):
                week_start = first_monday + timedelta(days=7 * week_index)
                week_end = week_start + timedelta(days=6)
                pair_target += _target_for_week(
                    subject.periods_per_week,
                    max(week_start, term.start_date),
                    min(week_end, term.end_date),
                    events,
                    working_days,
                )
        required_by_pair[(class_id, subject_id)] = pair_target
    required = sum(required_by_pair.values())
    subject_counts = defaultdict(Counter)
    for s in sessions:
        subject_counts[(s.class_id, s.subject_id)][s.session_status] += 1
    subject_loads = []
    all_pairs = unique_class_subjects | set(subject_counts.keys())
    for class_id, subject_id in sorted(all_pairs):
        counts = subject_counts[(class_id, subject_id)]
        subject = subjects.get(subject_id)
        subject_loads.append({
            "class_id": class_id,
            "class_name": classes[class_id].class_name if class_id in classes else str(class_id),
            "subject_id": subject_id,
            "subject_name": subject.subject_name if subject else str(subject_id),
            "required_periods": required_by_pair.get((class_id, subject_id), 0),
            "scheduled": counts["scheduled"],
            "completed": counts["completed"],
            "cancelled": counts["cancelled"],
            "rescheduled": counts["rescheduled"],
            "outstanding": counts["outstanding"] + counts["missed"],
        })
    summary = {
        "required_periods": required,
        "scheduled": status_counts["scheduled"],
        "completed": status_counts["completed"],
        "cancelled": status_counts["cancelled"],
        "rescheduled": status_counts["rescheduled"],
        "outstanding": status_counts["outstanding"] + status_counts["missed"],
        "unresolved_locked_conflicts": sum(s.closure_conflict and s.is_locked for s in sessions),
    }
    return {
        "term": {"term_id": term.term_id, "academic_year": term.academic_year, "term_name": term.term_name, "start_date": term.start_date.isoformat(), "end_date": term.end_date.isoformat()},
        "version": _serialize_version(version),
        "summary": summary,
        "subject_loads": subject_loads,
        "incomplete": summary["outstanding"] > 0 or summary["cancelled"] > 0 or summary["unresolved_locked_conflicts"] > 0,
    }
