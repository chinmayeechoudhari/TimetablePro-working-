"""Optimize a semester across dated slots and persist a new draft version."""
import json
from datetime import date, timedelta, datetime
import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_db
from app.models.calendar import AcademicTerm, CalendarEvent
from app.models.models import (AcademicGroup, Constraint, Division, Room, Subject, Teacher, TeacherAvailability, TeacherSubject, TeachingAssignment, TimeSlot)
from app.models.semester import ScheduledSession, TimetableVersion
from app.constraints.schemas import GeneratedConstraint
from app.constraints.resolver import EntityResolutionError
from app.solver.semester_solver import solve_semester_schedule

router = APIRouter(prefix="/semester", tags=["semester-optimization"])


def _normalize_academic_year(value) -> str:
    """Compare AY labels independently of dash characters, spaces, or full end years."""
    text = str(value or "").strip().casefold()
    text = re.sub(r"\s+", "", text).replace("–", "-").replace("—", "-").replace("−", "-")
    match = re.fullmatch(r"(\d{4})[-/](\d{2}|\d{4})", text)
    if match:
        start, end = match.groups()
        return f"{start}-{end[-2:]}"
    return text


def _working_days(term, slots=None):
    try:
        days = set(json.loads(term.working_days_json or "[]"))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail="Term working days are not valid JSON.") from exc
    if slots:
        configured = {str(slot.day).strip() for slot in slots if str(slot.day).strip()}
        if configured:
            return configured
    valid = {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}
    if not days or not days.issubset(valid):
        raise HTTPException(status_code=422, detail="Term working days are invalid.")
    return days


@router.post("/terms/{term_id}/optimize", status_code=201)
def optimize_semester(term_id: int, created_by: str | None = None, notes: str | None = None,
                      max_time_seconds: float = 30.0, db: Session = Depends(get_db)):
    """Solve dated semester sessions and save a new draft; never publish automatically."""
    term = db.query(AcademicTerm).filter(AcademicTerm.term_id == term_id).first()
    if term is None:
        raise HTTPException(status_code=404, detail="Academic term not found.")
    if term.end_date < term.start_date:
        raise HTTPException(status_code=422, detail="Term end date must be on or after its start date.")

    # Validate academic-year scoping before loading slots, constraints, or other
    # scheduling data. Never proceed with another year's assignments.
    all_groups = db.query(AcademicGroup).all()
    term_year = _normalize_academic_year(term.academic_year)
    scoped_groups = [
        group for group in all_groups
        if _normalize_academic_year(group.academic_year) == term_year
    ]
    if all_groups and not scoped_groups:
        raise HTTPException(
            status_code=409,
            detail=(
                f"No academic groups match academic year '{term.academic_year}'. "
                "Check the term's academic year and the department/year setup; "
                "the optimizer will not fall back to another year's subjects."
            ),
        )

    saved_constraints = db.query(Constraint).all()
    dynamic_constraints = []
    for row in saved_constraints:
        try:
            stored_payload = json.loads(row.parameters_json or "{}")
            # Legacy rows are global GeneratedConstraint JSON. New scoped rows
            # use an envelope so this feature needs no database migration.
            if (
                isinstance(stored_payload, dict)
                and isinstance(stored_payload.get("scope"), dict)
                and isinstance(stored_payload.get("constraint"), dict)
            ):
                scoped_term_id = stored_payload["scope"].get("term_id")
                if not isinstance(scoped_term_id, int):
                    raise ValueError("Scoped constraint is missing a valid term_id.")
                if scoped_term_id != term_id:
                    continue
                payload = stored_payload["constraint"]
            else:
                payload = stored_payload
            parsed = GeneratedConstraint.model_validate(payload)
            if row.constraint_type != parsed.constraint_type:
                raise ValueError("Saved constraint type does not match its payload.")
            if parsed.constraint_type == "soft" and parsed.weight not in (1, 2, 3):
                raise ValueError("Soft constraint priority must be 1, 2, or 3.")
            dynamic_constraints.append(parsed)
        except (json.JSONDecodeError, ValueError, TypeError) as exc:
            raise HTTPException(
                status_code=409,
                detail=f"Saved dynamic constraint {row.constraint_id} is invalid and must be repaired before semester optimization.",
            ) from exc

    slots = db.query(TimeSlot).all()
    teachers = db.query(Teacher).all()
    rooms = db.query(Room).all()

    if scoped_groups:
        scoped_group_ids = {group.group_id for group in scoped_groups}
        scoped_divisions = db.query(Division).filter(
            Division.group_id.in_(scoped_group_ids)
        ).all()
        assignments = db.query(TeachingAssignment).filter(
            TeachingAssignment.division_id.in_(
                [division.division_id for division in scoped_divisions]
            )
        ).all() if scoped_divisions else []
        scoped_subject_ids = {assignment.subject_id for assignment in assignments}
        subjects = db.query(Subject).filter(
            Subject.subject_id.in_(scoped_subject_ids)
        ).all() if scoped_subject_ids else []
        teacher_subject_pairs = sorted({
            (assignment.teacher_id, assignment.subject_id)
            for assignment in assignments
        })
        if not scoped_divisions or not subjects or not assignments:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"No complete teaching assignments are configured for academic year "
                    f"'{term.academic_year}'. Add subjects and teacher assignments for "
                    "the selected academic year before optimizing."
                ),
            )
    else:
        # Backward compatibility for installations that have not migrated to
        # the academic-group workflow yet. Once any groups exist, we never mix
        # legacy global subjects into a term with scoped academic data.
        subjects = db.query(Subject).all()
        teacher_subject_pairs = [
            (link.teacher_id, link.subject_id)
            for link in db.query(TeacherSubject).all()
        ]

    if not slots or not subjects or not teachers or not rooms:
        raise HTTPException(status_code=409, detail="Add time slots, subjects, teachers, and rooms before optimizing.")

    events = db.query(CalendarEvent).filter(
        CalendarEvent.term_id == term_id,
        CalendarEvent.approval_status == "approved",
    ).all()
    event_data = [{
        "start_date": event.start_date,
        "end_date": event.end_date,
        "is_closure": event.is_closure,
        "is_working_day_override": event.is_working_day_override,
    } for event in events]

    availability = db.query(TeacherAvailability).filter(TeacherAvailability.is_available.is_(False)).all()
    latest = db.query(TimetableVersion).filter(
        TimetableVersion.term_id == term_id,
    ).order_by(TimetableVersion.version_number.desc()).first()
    locked_sessions = []
    if latest:
        locked_sessions = [{
            "session_date": session.session_date,
            "class_id": session.class_id,
            "subject_id": session.subject_id,
            "teacher_id": session.teacher_id,
            "room_id": session.room_id,
            "slot_id": session.slot_id,
            "period_number": session.period_number,
            "is_locked": session.is_locked,
        } for session in latest.sessions if session.is_locked]

    try:
        result = solve_semester_schedule({
            "db": db,
            "dynamic_constraints": dynamic_constraints,
            "slot_period": {s.slot_id: s.period_number for s in slots},
            "slot_day": {s.slot_id: s.day for s in slots},
            "room_types": {r.room_id: str(r.room_type or "classroom").strip().lower() for r in rooms},
            "subject_types": {s.subject_id: str(s.subject_type or "theory").strip().lower() for s in subjects},
            "start_date": term.start_date,
            "end_date": term.end_date,
            "working_days": _working_days(term, slots),
            "events": event_data,
            "slots": [{"slot_id": s.slot_id, "day": s.day, "period_number": s.period_number} for s in slots],
            "subjects": [{
                "subject_id": s.subject_id,
                "class_id": s.class_id,
                "periods_per_week": s.periods_per_week,
                "subject_type": s.subject_type,
            } for s in subjects],
            "teachers": [{
                "teacher_id": t.teacher_id,
                "max_periods_per_day": t.max_periods_per_day,
            } for t in teachers],
            "rooms": [{"room_id": r.room_id, "room_type": r.room_type} for r in rooms],
            "teacher_subjects": teacher_subject_pairs,
            "unavailable_pairs": [(row.teacher_id, row.slot_id) for row in availability],
            "locked_sessions": locked_sessions,
        }, max_time_seconds=max_time_seconds)
    
    
    except (ValueError, TypeError, KeyError, NotImplementedError, EntityResolutionError) as exc:
        raise HTTPException(
            status_code=409,
            detail=f"A saved dynamic constraint could not be compiled for semester scheduling: {exc}",
        ) from exc

    if result["status"] not in {"optimal", "feasible"}:
        reason = result.get("reason") or "The solver could not find a feasible schedule."
        raise HTTPException(status_code=409, detail={
            "message": "Semester optimization could not produce a valid schedule.",
            "status": result["status"],
            "reason": reason,
            "diagnostic": f"Solver status: {result['status']}. {reason}",
            "locked_conflicts": result.get("locked_conflicts", []),
        })

    # Report sessions displaced by approved closures against the previous draft/published version.
    # The new draft remains a full validated CP-SAT schedule; this report helps admins
    # audit which original dated sessions were moved and which could not be matched.
    closure_events = [event for event in events if event.is_closure]
    affected_sessions = []
    if latest and closure_events:
        for old_session in latest.sessions:
            matching_closure = next((event for event in closure_events
                if event.start_date <= old_session.session_date <= event.end_date), None)
            if matching_closure:
                affected_sessions.append((old_session, matching_closure))

    reschedule_report = {
        "affected_sessions": len(affected_sessions),
        "replacements_found": 0,
        "unresolved_sessions": [],
        "replacements": [],
    }
    if affected_sessions:
        closure_ranges = [(event.start_date, event.end_date) for event in closure_events]

        def is_closed_day(day):
            return any(start_date <= day <= end_date for start_date, end_date in closure_ranges)

        # Only count a replacement when the new solver output actually contains
        # an occurrence on a date that was not already an unaffected occurrence
        # in the previous version. This avoids labelling an ordinary recurring
        # class as a makeup session.
        unaffected_old_occurrences = set()
        for old_session in latest.sessions:
            if not is_closed_day(old_session.session_date):
                unaffected_old_occurrences.add((
                    old_session.class_id,
                    old_session.subject_id,
                    old_session.session_date,
                ))

        candidates_by_subject = {}
        for item in result["sessions"]:
            key = (item["class_id"], item["subject_id"])
            candidates_by_subject.setdefault(key, []).append(item)

        used_replacements = set()
        for old_session, event in sorted(
            affected_sessions,
            key=lambda pair: (pair[0].session_date, pair[0].period_number, pair[0].session_id),
        ):
            key = (old_session.class_id, old_session.subject_id)
            candidates = candidates_by_subject.get(key, [])
            valid = [
                item for item in candidates
                if item["session_date"] != old_session.session_date
                and not is_closed_day(item["session_date"])
                and (item["class_id"], item["subject_id"], item["session_date"])
                    not in unaffected_old_occurrences
                and (
                    item["session_date"],
                    item["period_number"],
                    item["class_id"],
                    item["subject_id"],
                ) not in used_replacements
            ]
            valid.sort(key=lambda item: (
                0 if item["session_date"].isocalendar()[:2] == old_session.session_date.isocalendar()[:2] else 1,
                item["session_date"],
                item["period_number"],
            ))
            if not valid:
                reschedule_report["unresolved_sessions"].append({
                    "original_session_id": old_session.session_id,
                    "date": old_session.session_date.isoformat(),
                    "class_id": old_session.class_id,
                    "subject_id": old_session.subject_id,
                    "period_number": old_session.period_number,
                    "closure_event": event.title,
                    "reason": "The new CP-SAT draft contains no additional eligible occurrence for this class and subject.",
                })
                continue

            moved = valid[0]
            used_key = (
                moved["session_date"],
                moved["period_number"],
                moved["class_id"],
                moved["subject_id"],
            )
            used_replacements.add(used_key)
            # Persist provenance on the actual replacement session in the draft.
            moved["original_session_id"] = old_session.session_id
            moved["source_event_id"] = event.event_id
            moved["outcome_note"] = f"Makeup for {event.title} on {old_session.session_date.isoformat()}."
            reschedule_report["replacements"].append({
                "original_session_id": old_session.session_id,
                "original_date": old_session.session_date.isoformat(),
                "replacement_date": moved["session_date"].isoformat(),
                "replacement_period": moved["period_number"],
                "class_id": old_session.class_id,
                "subject_id": old_session.subject_id,
                "same_week": moved["session_date"].isocalendar()[:2] == old_session.session_date.isocalendar()[:2],
                "closure_event": event.title,
                "replacement_is_in_solver_output": True,
            })
        reschedule_report["replacements_found"] = len(reschedule_report["replacements"])

    next_number = (latest.version_number + 1) if latest else 1
    version = TimetableVersion(
        term_id=term_id,
        version_number=next_number,
        status="draft",
        created_by=created_by,
        notes=notes or "Generated by date-aware semester CP-SAT optimizer.",
    )
    db.add(version)
    db.flush()
    for item in result["sessions"]:
        db.add(ScheduledSession(version_id=version.version_id, **item))

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Optimized draft conflicts with a database uniqueness rule. No draft was saved.") from exc

    db.refresh(version)
    return {
        "status": result["status"],
        "objective_value": result.get("objective_value", 0),
        "version_id": version.version_id,
        "version_number": version.version_number,
        "term_id": term_id,
        "draft_only": True,
        "session_count": len(result["sessions"]),
        "calendar_reschedule_report": reschedule_report,
        "sessions": [{
            "session_id": s.session_id,
            "date": s.session_date.isoformat(),
            "weekday": s.weekday,
            "period_number": s.period_number,
            "slot_id": s.slot_id,
            "class_id": s.class_id,
            "subject_id": s.subject_id,
            "teacher_id": s.teacher_id,
            "room_id": s.room_id,
            "is_locked": s.is_locked,
        } for s in sorted(version.sessions, key=lambda x: (x.session_date, x.period_number, x.class_id))],
        "message": "Draft saved. Review it before publishing.",
    }


class SessionUpdate(BaseModel):
    session_status: str | None = None
    is_locked: bool | None = None
    lock_reason: str | None = Field(default=None, max_length=500)
    outcome_note: str | None = None

@router.get('/terms/{term_id}/versions')
def list_semester_versions(term_id: int, db: Session = Depends(get_db)):
    term = db.query(AcademicTerm).filter(AcademicTerm.term_id == term_id).first()
    if term is None:
        raise HTTPException(status_code=404, detail='Academic term not found.')
    versions = db.query(TimetableVersion).filter(TimetableVersion.term_id == term_id).order_by(TimetableVersion.version_number.desc()).all()
    return [{'version_id': v.version_id, 'term_id': term_id, 'version_number': v.version_number, 'status': v.status, 'published_at': v.published_at.isoformat() if v.published_at else None, 'session_count': len(v.sessions), 'sessions': [{'session_id': s.session_id, 'date': s.session_date.isoformat(), 'weekday': s.weekday, 'period_number': s.period_number, 'slot_id': s.slot_id, 'class_id': s.class_id, 'subject_id': s.subject_id, 'teacher_id': s.teacher_id, 'room_id': s.room_id, 'session_status': s.session_status, 'is_locked': s.is_locked, 'lock_reason': s.lock_reason} for s in sorted(v.sessions, key=lambda x: (x.session_date, x.period_number, x.class_id))]} for v in versions]

@router.patch('/sessions/{session_id}')
def update_semester_session(session_id: int, payload: SessionUpdate, db: Session = Depends(get_db)):
    session = db.query(ScheduledSession).filter(ScheduledSession.session_id == session_id).first()
    if session is None:
        raise HTTPException(status_code=404, detail='Scheduled session not found.')
    version = db.query(TimetableVersion).filter(TimetableVersion.version_id == session.version_id).first()
    if version is None or version.status == 'archived':
        raise HTTPException(status_code=409, detail='This timetable version cannot be changed.')
    data = payload.model_dump(exclude_unset=True)
    if data.get('session_status') is not None and data['session_status'] not in {'scheduled', 'completed', 'cancelled', 'rescheduled'}:
        raise HTTPException(status_code=422, detail='Invalid session status.')
    for field, value in data.items():
        setattr(session, field, value)
    if data.get('is_locked') is True:
        session.locked_at = datetime.now().astimezone()
    elif data.get('is_locked') is False:
        session.locked_at = None
        session.lock_reason = None
        session.locked_by = None
    db.commit()
    db.refresh(session)
    return {'session_id': session.session_id, 'session_status': session.session_status, 'is_locked': session.is_locked, 'lock_reason': session.lock_reason}

@router.post('/versions/{version_id}/publish')
def publish_semester_version(version_id: int, db: Session = Depends(get_db)):
    version = db.query(TimetableVersion).filter(TimetableVersion.version_id == version_id).first()
    if version is None:
        raise HTTPException(status_code=404, detail='Timetable version not found.')
    if version.status != 'draft':
        raise HTTPException(status_code=409, detail='Only draft versions can be published.')
    pending = db.query(CalendarEvent).filter(CalendarEvent.term_id == version.term_id, CalendarEvent.approval_status == 'pending').count()
    if pending:
        raise HTTPException(status_code=409, detail=f'Resolve {pending} pending calendar event review(s) before publishing.')
    for previous in db.query(TimetableVersion).filter(TimetableVersion.term_id == version.term_id, TimetableVersion.status == 'published').all():
        previous.status = 'archived'
    version.status = 'published'
    version.published_at = datetime.now().astimezone()
    db.commit()
    return {'version_id': version.version_id, 'term_id': version.term_id, 'status': version.status, 'published_at': version.published_at.isoformat()}
