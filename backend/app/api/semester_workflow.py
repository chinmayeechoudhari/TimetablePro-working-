import json
from collections import Counter, defaultdict
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import get_db
from app.models.calendar import AcademicTerm, CalendarEvent
from app.models.models import Class, Subject, TimeSlot, Timetable
from app.models.semester import ScheduledSession, TimetableVersion

router = APIRouter(prefix="/semester", tags=["semester-planning"])


def _get_term(db: Session, term_id: int) -> AcademicTerm:
    term = db.query(AcademicTerm).filter(AcademicTerm.term_id == term_id).first()
    if term is None:
        raise HTTPException(status_code=404, detail="Academic term not found.")
    if term.end_date < term.start_date:
        raise HTTPException(status_code=422, detail="Term end date must be on or after its start date.")
    return term


def _day_state(day, events, working_days):
    active = [event for event in events if event.start_date <= day <= event.end_date]
    override = any(event.is_working_day_override is True for event in active)
    closed = any(event.is_closure for event in active) and not override
    return (override or day.strftime("%A") in working_days) and not closed, closed, active


def _touched_weeks(start, end):
    first_monday = start - timedelta(days=start.weekday())
    last_sunday = end + timedelta(days=6 - end.weekday())
    count = ((last_sunday - first_monday).days // 7) + 1
    return first_monday, count


def _weekly_target(periods_per_week, start, end, events, working_days):
    """Scale a weekly subject target to the eligible teaching days in a partial week.

    A closure removes an eligible teaching day; an approved working-day override
    restores it. Targets are rounded up so partial weeks do not silently lose a
    subject's expected sessions.
    """
    periods = max(0, int(periods_per_week or 0))
    if periods == 0 or end < start or not working_days:
        return 0
    eligible_days = 0
    day = start
    while day <= end:
        eligible, _, _ = _day_state(day, events, working_days)
        eligible_days += int(eligible)
        day += timedelta(days=1)
    if eligible_days == 0:
        return 0
    # Integer ceiling avoids floating-point rounding surprises.
    prorated = (periods * eligible_days + len(working_days) - 1) // len(working_days)
    return min(periods, prorated)


@router.post("/terms/{term_id}/preview")
def preview_semester_draft(term_id: int, db: Session = Depends(get_db)):
    """Return a read-only preview before a draft is persisted."""
    term = _get_term(db, term_id)
    weekly_rows = db.query(Timetable).all()
    slots = {slot.slot_id: slot for slot in db.query(TimeSlot).all()}
    if not weekly_rows:
        raise HTTPException(status_code=409, detail="Generate a valid weekly timetable before previewing a semester draft.")
    if any(row.slot_id not in slots for row in weekly_rows):
        raise HTTPException(status_code=409, detail="The weekly timetable references a missing time slot.")

    try:
        working_days = set(json.loads(term.working_days_json or "[]"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="Term working days are not valid JSON.")
    valid_days = {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}
    if not working_days or not working_days.issubset(valid_days):
        raise HTTPException(status_code=422, detail="Term working days are invalid.")

    events = db.query(CalendarEvent).filter(
        CalendarEvent.term_id == term_id,
        CalendarEvent.approval_status == "approved",
    ).all()
    current = db.query(TimetableVersion).filter(
        TimetableVersion.term_id == term_id,
        TimetableVersion.status == "published",
    ).order_by(TimetableVersion.version_number.desc()).first()
    current_sessions = current.sessions if current else []
    current_by_key = {
        (s.session_date, s.class_id, s.period_number): s
        for s in current_sessions
    }

    planned = cancelled = changed = locked_conflicts = 0
    impacted_dates = set()
    proposed_keys = set()
    first_monday, weeks = _touched_weeks(term.start_date, term.end_date)
    day = term.start_date
    while day <= term.end_date:
        eligible, closed, active_events = _day_state(day, events, working_days)
        day_rows = [row for row in weekly_rows if slots[row.slot_id].day == day.strftime("%A")]
        for row in day_rows:
            slot = slots[row.slot_id]
            key = (day, row.class_id, slot.period_number)
            proposed_keys.add(key)
            prior = current_by_key.get(key)
            if not eligible:
                if closed:
                    cancelled += 1
                    impacted_dates.add(day.isoformat())
                if prior and prior.is_locked:
                    locked_conflicts += 1
                continue
            planned += 1
            if prior and (prior.subject_id, prior.teacher_id, prior.room_id) != (row.subject_id, row.teacher_id, row.room_id):
                changed += 1
                impacted_dates.add(day.isoformat())
            elif prior is None and current:
                changed += 1
                impacted_dates.add(day.isoformat())
        day += timedelta(days=1)

    if current:
        for key, prior in current_by_key.items():
            if key not in proposed_keys:
                changed += 1
                impacted_dates.add(key[0].isoformat())
                if prior.is_locked:
                    locked_conflicts += 1

    subjects = {subject.subject_id: subject for subject in db.query(Subject).all()}
    pairs = {(row.class_id, row.subject_id) for row in weekly_rows}
    required = 0
    for week_index in range(weeks):
        week_start = first_monday + timedelta(days=7 * week_index)
        week_end = week_start + timedelta(days=6)
        range_start = max(week_start, term.start_date)
        range_end = min(week_end, term.end_date)
        for _, subject_id in pairs:
            subject = subjects.get(subject_id)
            if subject:
                required += _weekly_target(subject.periods_per_week, range_start, range_end, events, working_days)
    template_load = Counter((row.class_id, row.subject_id) for row in weekly_rows)
    template_shortfalls = [
        {"class_id": cid, "subject_id": sid, "required_per_week": max(0, int(subjects[sid].periods_per_week or 0)), "weekly_template_periods": template_load[(cid, sid)]}
        for cid, sid in sorted(pairs)
        if sid in subjects and template_load[(cid, sid)] < max(0, int(subjects[sid].periods_per_week or 0))
    ]
    return {
        "term_id": term.term_id,
        "term_name": term.term_name,
        "start_date": term.start_date.isoformat(),
        "end_date": term.end_date.isoformat(),
        "weeks_touched": weeks,
        "required_periods": required,
        "planned_sessions": planned,
        "closure_cancellations": cancelled,
        "changed_sessions_vs_published": changed,
        "locked_conflicts": locked_conflicts,
        "affected_dates": sorted(impacted_dates),
        "weekly_template_shortfalls": template_shortfalls,
        "can_confirm": locked_conflicts == 0,
        "note": "This preview expands the current weekly solver output. It does not yet re-optimize the CP-SAT solver across every dated semester slot.",
    }


@router.get("/terms/{term_id}/weekly-progress")
def weekly_progress(term_id: int, db: Session = Depends(get_db)):
    """Show target vs planned/completed sessions for every touched calendar week."""
    term = _get_term(db, term_id)
    version = db.query(TimetableVersion).filter(
        TimetableVersion.term_id == term_id,
        TimetableVersion.status == "published",
    ).order_by(TimetableVersion.version_number.desc()).first()
    if version is None:
        version = db.query(TimetableVersion).filter(
            TimetableVersion.term_id == term_id,
        ).order_by(TimetableVersion.version_number.desc()).first()

    template = db.query(Timetable).all()
    subjects = {s.subject_id: s for s in db.query(Subject).all()}
    try:
        working_days = set(json.loads(term.working_days_json or "[]"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="Term working days are not valid JSON.")
    valid_days = {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}
    if not working_days or not working_days.issubset(valid_days):
        raise HTTPException(status_code=422, detail="Term working days are invalid.")
    events = db.query(CalendarEvent).filter(
        CalendarEvent.term_id == term_id,
        CalendarEvent.approval_status == "approved",
    ).all()
    classes = {c.class_id: c for c in db.query(Class).all()}
    pairs = {(row.class_id, row.subject_id) for row in template}
    first_monday, weeks = _touched_weeks(term.start_date, term.end_date)
    session_rows = version.sessions if version else []
    week_counts = Counter()
    for session in session_rows:
        week_start = session.session_date - timedelta(days=session.session_date.weekday())
        if session.session_status in {"scheduled", "completed"}:
            week_counts[(week_start, session.class_id, session.subject_id)] += 1

    rows = []
    for week_index in range(weeks):
        week_start = first_monday + timedelta(days=7 * week_index)
        week_end = week_start + timedelta(days=6)
        range_start = max(week_start, term.start_date)
        range_end = min(week_end, term.end_date)
        for class_id, subject_id in sorted(pairs):
            subject = subjects.get(subject_id)
            if not subject:
                continue
            target = _weekly_target(subject.periods_per_week, range_start, range_end, events, working_days)
            actual = week_counts[(week_start, class_id, subject_id)]
            rows.append({
                "week_start": range_start.isoformat(),
                "week_end": range_end.isoformat(),
                "class_id": class_id,
                "class_name": classes[class_id].class_name if class_id in classes else str(class_id),
                "subject_id": subject_id,
                "subject_name": subject.subject_name,
                "target_periods": target,
                "scheduled_or_completed": actual,
                "shortfall": max(0, target - actual),
            })
    return {
        "term_id": term_id,
        "version_id": version.version_id if version else None,
        "weeks_touched": weeks,
        "shortfalls": rows,
        "total_shortfall": sum(row["shortfall"] for row in rows),
    }
