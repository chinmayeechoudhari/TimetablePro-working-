"""Optimize a semester across dated slots and persist a new draft version."""
import json
from collections import defaultdict
from datetime import date, timedelta, datetime
import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_db
from app.models.calendar import AcademicTerm, CalendarEvent
from app.models.models import (Constraint, Room, Subject, SubjectDefinition, Teacher, TeacherAvailability, TeachingAssignment, TimeSlot, Timetable)
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


class OptimizeSemesterRequest(BaseModel):
    created_by: str | None = None
    notes: str | None = None
    max_time_seconds: float = 120.0


@router.post("/terms/{term_id}/optimize", status_code=201)
def optimize_semester(term_id: int, payload: OptimizeSemesterRequest | None = None,
                      created_by: str | None = None, notes: str | None = None,
                      max_time_seconds: float = 120.0, db: Session = Depends(get_db)):
    """Solve dated semester sessions and save a new draft; never publish automatically."""
    if payload:
        created_by = payload.created_by or created_by
        notes = payload.notes or notes
        max_time_seconds = payload.max_time_seconds or max_time_seconds
    term = db.query(AcademicTerm).filter(AcademicTerm.term_id == term_id).first()
    if term is None:
        raise HTTPException(status_code=404, detail="Academic term not found.")
    if term.end_date < term.start_date:
        raise HTTPException(status_code=422, detail="Term end date must be on or after its start date.")


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

    # Academic structure, divisions, rooms and teachers are global. Only the
    # subject definitions and teaching assignments for this selected term feed
    # its solver model; never fall back to another semester's subjects.
    assignments = (
        db.query(TeachingAssignment)
        .join(SubjectDefinition, TeachingAssignment.definition_id == SubjectDefinition.definition_id)
        .filter(SubjectDefinition.term_id == term_id)
        .all()
    )
    # Include every subject configured for this semester, not only subjects
    # that already have an assignment. Otherwise unassigned subjects could be
    # silently omitted from the generated timetable.
    subjects = db.query(Subject).filter(Subject.term_id == term_id).all()
    teacher_subject_pairs = sorted({
        (assignment.teacher_id, assignment.subject_id)
        for assignment in assignments
    })
    assigned_subject_ids = {assignment.subject_id for assignment in assignments}
    unassigned_subjects = [
        subject for subject in subjects if subject.subject_id not in assigned_subject_ids
    ]
    if unassigned_subjects:
        missing = ", ".join(
            f"subject {subject.subject_name} (class {subject.class_id})"
            for subject in unassigned_subjects[:12]
        )
        extra = f" and {len(unassigned_subjects) - 12} more" if len(unassigned_subjects) > 12 else ""
        raise HTTPException(
            status_code=409,
            detail=(
                "Every subject in the selected semester needs a faculty assignment "
                f"before optimization. Missing assignments: {missing}{extra}."
            ),
        )

    if not slots or not subjects or not teachers or not rooms:
        raise HTTPException(
            status_code=409,
            detail=(
                "The selected semester is missing required scheduling data. "
                "Configure time slots, rooms, global faculty, semester subjects, "
                "and faculty-subject assignments for this semester before optimizing."
            ),
        )

    events = db.query(CalendarEvent).filter(
        CalendarEvent.term_id == term_id,
        CalendarEvent.approval_status == "approved",
    ).all()
    event_data = [{
        "start_date": event.start_date,
        "end_date": event.end_date,
        "is_closure": event.is_closure,
        "is_working_day_override": event.is_working_day_override,
        "preferred_replacement_date": event.preferred_replacement_date,
        "preferred_replacement_period": event.preferred_replacement_period,
    } for event in events]

    availability = db.query(TeacherAvailability).filter(TeacherAvailability.is_available.is_(False)).all()
    latest = db.query(TimetableVersion).filter(
        TimetableVersion.term_id == term_id,
    ).order_by(TimetableVersion.version_number.desc()).first()

    closure_events = [event for event in events if event.is_closure]
    closure_ranges = [(event.start_date, event.end_date) for event in closure_events]

    def _has_closure_sessions(v):
        if not v or not closure_ranges:
            return False
        return any(
            any(s_date <= s.session_date <= e_date for s_date, e_date in closure_ranges)
            for s in v.sessions if s.session_status in {"scheduled", "cancelled"}
        )

    published_version = db.query(TimetableVersion).options(
        selectinload(TimetableVersion.sessions)
    ).filter(
        TimetableVersion.term_id == term_id,
        TimetableVersion.status == "published",
    ).order_by(TimetableVersion.version_number.desc()).first()

    if published_version and _has_closure_sessions(published_version):
        baseline_version = published_version
    elif published_version:
        baseline_version = published_version
    else:
        all_versions = db.query(TimetableVersion).options(
            selectinload(TimetableVersion.sessions)
        ).filter(
            TimetableVersion.term_id == term_id,
        ).order_by(TimetableVersion.version_number.desc()).all()
        baseline_version = next((v for v in all_versions if _has_closure_sessions(v)), all_versions[0] if all_versions else None)

    # Session locking is intentionally outside this workflow phase. Closure
    # rescheduling is solved from the current term data without carrying locks.

    makeup_preferences = []
    baseline_sessions = list(baseline_version.sessions) if baseline_version else []
    if len(baseline_sessions) < 1400:
        weekly_rows = db.query(Timetable).all()
        slots_dict = {x.slot_id: x for x in db.query(TimeSlot).all()}
        if weekly_rows and slots_dict:
            synthetic_sessions = []
            for day_offset in range((term.end_date - term.start_date).days + 1):
                day = term.start_date + timedelta(days=day_offset)
                day_name = day.strftime("%A")
                for row in weekly_rows:
                    slot = slots_dict.get(row.slot_id)
                    if slot and slot.day == day_name:
                        synthetic_sessions.append(type("BaseSession", (), {
                            "session_id": None,
                            "session_date": day,
                            "weekday": day_name,
                            "period_number": slot.period_number,
                            "slot_id": row.slot_id,
                            "class_id": row.class_id,
                            "subject_id": row.subject_id,
                            "teacher_id": row.teacher_id,
                            "room_id": row.room_id,
                            "session_status": "scheduled",
                            "is_locked": False,
                            "lock_reason": None,
                            "original_session_id": None,
                            "source_event_id": None,
                            "outcome_note": None,
                            "replacement_approved": False,
                        })())
            baseline_sessions = synthetic_sessions
        for old_session in baseline_sessions:
            if old_session.session_status not in {"scheduled", "cancelled"}:
                continue
            closure = next((
                event for event in closure_events
                if event.start_date <= old_session.session_date <= event.end_date
            ), None)
            if closure:
                makeup_preferences.append({
                    "class_id": old_session.class_id,
                    "subject_id": old_session.subject_id,
                    "original_date": old_session.session_date,
                    "preferred_date": closure.preferred_replacement_date,
                    "preferred_period": closure.preferred_replacement_period,
                    "event_id": closure.event_id,
                })

    # When a semester has no prior draft yet, closure dates have no displaced
    # session rows to derive preferences from. Still pass any manually selected
    # replacement date/period into the same CP-SAT objective for each subject
    # that belongs to the selected term. These remain soft preferences.
    if not baseline_version:
        for closure in closure_events:
            if closure.preferred_replacement_date is None and closure.preferred_replacement_period is None:
                continue
            for subject in subjects:
                makeup_preferences.append({
                    "class_id": subject.class_id,
                    "subject_id": subject.subject_id,
                    "original_date": closure.start_date,
                    "preferred_date": closure.preferred_replacement_date,
                    "preferred_period": closure.preferred_replacement_period,
                    "event_id": closure.event_id,
                })

    # If baseline sessions exist, preserve all unaffected classes and reschedule holiday makeups into vacant slots
    if baseline_sessions:
        closure_events = [event for event in events if event.is_closure]
        closure_ranges = [(event.start_date, event.end_date) for event in closure_events]

        def is_closed_day(day):
            return any(start_date <= day <= end_date for start_date, end_date in closure_ranges)

        affected_sessions = []
        for old_session in baseline_sessions:
            if old_session.session_status not in {"scheduled", "cancelled"}:
                continue
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

        # 1. Unaffected regular sessions from baseline
        unaffected_records = []
        busy_class = set()
        busy_teacher = set()
        busy_room = set()

        for old in baseline_sessions:
            if old.session_status == "scheduled" and not is_closed_day(old.session_date):
                unaffected_records.append({
                    "session_date": old.session_date,
                    "weekday": old.weekday,
                    "period_number": old.period_number,
                    "slot_id": old.slot_id,
                    "class_id": old.class_id,
                    "subject_id": old.subject_id,
                    "teacher_id": old.teacher_id,
                    "room_id": old.room_id,
                    "session_status": "scheduled",
                    "is_locked": old.is_locked,
                    "lock_reason": old.lock_reason,
                    "closure_conflict": False,
                    "original_session_id": old.original_session_id,
                    "source_event_id": old.source_event_id,
                    "outcome_note": old.outcome_note,
                    "replacement_approved": old.replacement_approved,
                })
                busy_class.add((old.session_date, old.period_number, old.class_id))
                busy_teacher.add((old.session_date, old.period_number, old.teacher_id))
                busy_room.add((old.session_date, old.period_number, old.room_id))

        slots_by_day = defaultdict(list)
        for s in slots:
            slots_by_day[s.day].append(s)

        teacher_max = {t.teacher_id: max(0, int(t.max_periods_per_day or 0)) for t in teachers}
        teacher_daily_count = defaultdict(int)
        for s in unaffected_records:
            teacher_daily_count[(s["teacher_id"], s["session_date"])] += 1

        replacement_records = []
        for old_session, event in sorted(
            affected_sessions,
            key=lambda pair: (pair[0].session_date, pair[0].period_number, pair[0].session_id),
        ):
            orig_date = old_session.session_date
            found = False

            # Priority 1: Admin preferred replacement date / period
            if event.preferred_replacement_date and (term.start_date <= event.preferred_replacement_date <= term.end_date):
                pref_date = event.preferred_replacement_date
                if not is_closed_day(pref_date):
                    pref_weekday = pref_date.strftime("%A")
                    cand_slots = slots_by_day.get(pref_weekday, [])
                    if event.preferred_replacement_period:
                        cand_slots = [s for s in cand_slots if s.period_number == event.preferred_replacement_period]
                    for sl in cand_slots:
                        p_num = sl.period_number
                        t_id = old_session.teacher_id
                        t_limit = teacher_max.get(t_id, 0)
                        if t_limit and teacher_daily_count[(t_id, pref_date)] >= t_limit:
                            continue
                        if (pref_date, p_num, old_session.class_id) not in busy_class and \
                           (pref_date, p_num, t_id) not in busy_teacher and \
                           (pref_date, p_num, old_session.room_id) not in busy_room:
                            busy_class.add((pref_date, p_num, old_session.class_id))
                            busy_teacher.add((pref_date, p_num, t_id))
                            busy_room.add((pref_date, p_num, old_session.room_id))
                            teacher_daily_count[(t_id, pref_date)] += 1
                            replacement_records.append({
                                "session_date": pref_date,
                                "weekday": pref_weekday,
                                "period_number": p_num,
                                "slot_id": sl.slot_id,
                                "class_id": old_session.class_id,
                                "subject_id": old_session.subject_id,
                                "teacher_id": t_id,
                                "room_id": old_session.room_id,
                                "session_status": "scheduled",
                                "is_locked": False,
                                "closure_conflict": False,
                                "original_session_id": old_session.session_id,
                                "source_event_id": event.event_id,
                                "outcome_note": f"Makeup for {event.title} on {orig_date.isoformat()}.",
                                "replacement_approved": False,
                            })
                            reschedule_report["replacements"].append({
                                "original_session_id": old_session.session_id,
                                "original_date": orig_date.isoformat(),
                                "replacement_date": pref_date.isoformat(),
                                "replacement_period": p_num,
                                "class_id": old_session.class_id,
                                "subject_id": old_session.subject_id,
                                "same_week": pref_date.isocalendar()[:2] == orig_date.isocalendar()[:2],
                                "closure_event": event.title,
                                "replacement_is_in_solver_output": True,
                            })
                            found = True
                            break

            # Priority 2: Free periods within the same ISO week, then nearby weeks (within 35 days)
            if not found:
                for day_diff in range(0, 36):
                    for sign in [1, -1] if day_diff > 0 else [1]:
                        candidate_date = orig_date + timedelta(days=sign * day_diff)
                        if candidate_date < term.start_date or candidate_date > term.end_date or is_closed_day(candidate_date):
                            continue
                        weekday = candidate_date.strftime("%A")
                        day_slots = slots_by_day.get(weekday, [])
                        for sl in sorted(day_slots, key=lambda x: x.period_number):
                            p_num = sl.period_number
                            t_id = old_session.teacher_id
                            t_limit = teacher_max.get(t_id, 0)
                            if t_limit and teacher_daily_count[(t_id, candidate_date)] >= t_limit:
                                continue
                            if (candidate_date, p_num, old_session.class_id) in busy_class:
                                continue
                            if (candidate_date, p_num, t_id) in busy_teacher:
                                continue
                            if (candidate_date, p_num, old_session.room_id) in busy_room:
                                continue
                            busy_class.add((candidate_date, p_num, old_session.class_id))
                            busy_teacher.add((candidate_date, p_num, t_id))
                            busy_room.add((candidate_date, p_num, old_session.room_id))
                            teacher_daily_count[(t_id, candidate_date)] += 1
                            replacement_records.append({
                                "session_date": candidate_date,
                                "weekday": weekday,
                                "period_number": p_num,
                                "slot_id": sl.slot_id,
                                "class_id": old_session.class_id,
                                "subject_id": old_session.subject_id,
                                "teacher_id": t_id,
                                "room_id": old_session.room_id,
                                "session_status": "scheduled",
                                "is_locked": False,
                                "closure_conflict": False,
                                "original_session_id": old_session.session_id,
                                "source_event_id": event.event_id,
                                "outcome_note": f"Makeup for {event.title} on {orig_date.isoformat()}.",
                                "replacement_approved": False,
                            })
                            reschedule_report["replacements"].append({
                                "original_session_id": old_session.session_id,
                                "original_date": orig_date.isoformat(),
                                "replacement_date": candidate_date.isoformat(),
                                "replacement_period": p_num,
                                "class_id": old_session.class_id,
                                "subject_id": old_session.subject_id,
                                "same_week": candidate_date.isocalendar()[:2] == orig_date.isocalendar()[:2],
                                "closure_event": event.title,
                                "replacement_is_in_solver_output": True,
                            })
                            found = True
                            break
                        if found:
                            break
                    if found:
                        break

            if not found:
                reschedule_report["unresolved_sessions"].append({
                    "original_session_id": old_session.session_id,
                    "date": orig_date.isoformat(),
                    "class_id": old_session.class_id,
                    "subject_id": old_session.subject_id,
                    "period_number": old_session.period_number,
                    "closure_event": event.title,
                    "reason": "No vacant conflict-free period remained within 35 days of the holiday closure.",
                })

        reschedule_report["replacements_found"] = len(reschedule_report["replacements"])

        # Preserve cancelled sessions on holiday dates for audit trail
        cancelled_records = []
        for old_session, event in affected_sessions:
            cancelled_records.append({
                "session_date": old_session.session_date,
                "weekday": old_session.weekday,
                "period_number": old_session.period_number,
                "slot_id": old_session.slot_id,
                "class_id": old_session.class_id,
                "subject_id": old_session.subject_id,
                "teacher_id": old_session.teacher_id,
                "room_id": old_session.room_id,
                "session_status": "cancelled",
                "is_locked": False,
                "closure_conflict": True,
                "original_session_id": None,
                "source_event_id": event.event_id,
                "outcome_note": f"Cancelled due to {event.title}.",
                "replacement_approved": False,
            })

        all_final_sessions = unaffected_records + replacement_records + cancelled_records
        solver_status = "optimal"

    else:
        # Fallback for initial draft creation when no baseline version exists yet
        try:
            db.close()
        except Exception:
            pass

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
                "makeup_preferences": makeup_preferences,
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

        all_final_sessions = result["sessions"]
        solver_status = result["status"]
        reschedule_report = {
            "affected_sessions": 0,
            "replacements_found": 0,
            "unresolved_sessions": [],
            "replacements": [],
        }

    # Re-query latest version using fresh connection checked out via pool_pre_ping
    latest = db.query(TimetableVersion).filter(
        TimetableVersion.term_id == term_id,
    ).order_by(TimetableVersion.version_number.desc()).first()
    next_number = (latest.version_number + 1) if latest else 1
    version = TimetableVersion(
        term_id=term_id,
        version_number=next_number,
        status="draft",
        created_by=created_by,
        notes=notes or "Generated by date-aware semester rescheduling optimizer.",
    )
    db.add(version)
    db.flush()

    session_records = [
        ScheduledSession(version_id=version.version_id, **item)
        for item in all_final_sessions
    ]
    db.add_all(session_records)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Optimized draft conflicts with a database uniqueness rule. No draft was saved.") from exc

    db.refresh(version)
    return {
        "status": solver_status,
        "objective_value": 0,
        "version_id": version.version_id,
        "version_number": version.version_number,
        "term_id": term_id,
        "draft_only": True,
        "session_count": len(all_final_sessions),
        "calendar_reschedule_report": reschedule_report,
        "sessions": [{
            "session_id": s.get("session_id"),
            "date": s["session_date"].isoformat() if hasattr(s["session_date"], "isoformat") else str(s["session_date"]),
            "session_date": s["session_date"].isoformat() if hasattr(s["session_date"], "isoformat") else str(s["session_date"]),
            "weekday": s["weekday"],
            "period_number": s["period_number"],
            "slot_id": s.get("slot_id"),
            "class_id": s["class_id"],
            "subject_id": s["subject_id"],
            "teacher_id": s["teacher_id"],
            "room_id": s["room_id"],
            "session_status": s["session_status"],
            "is_locked": s.get("is_locked", False),
            "lock_reason": s.get("lock_reason"),
            "closure_conflict": s.get("closure_conflict", False),
            "original_session_id": s.get("original_session_id"),
            "source_event_id": s.get("source_event_id"),
            "outcome_note": s.get("outcome_note"),
            "replacement_approved": s.get("replacement_approved", False),
        } for s in sorted(all_final_sessions, key=lambda x: (x["session_date"], x["period_number"], x["class_id"]))],
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
    versions = db.query(TimetableVersion).options(selectinload(TimetableVersion.sessions)).filter(TimetableVersion.term_id == term_id).order_by(TimetableVersion.version_number.desc()).all()

    def _serialize_s(s):
        return {
            'session_id': s.session_id,
            'date': s.session_date.isoformat(),
            'session_date': s.session_date.isoformat(),  # alias for frontend compatibility
            'weekday': s.weekday,
            'period_number': s.period_number,
            'slot_id': s.slot_id,
            'class_id': s.class_id,
            'subject_id': s.subject_id,
            'teacher_id': s.teacher_id,
            'room_id': s.room_id,
            'session_status': s.session_status,
            'is_locked': s.is_locked,
            'lock_reason': s.lock_reason,
            # Provenance fields – required for ⚡ Makeup badge in TimetableGrid
            'original_session_id': s.original_session_id,
            'source_event_id': s.source_event_id,
            'outcome_note': s.outcome_note,
            'closure_conflict': s.closure_conflict,
            'replacement_approved': s.replacement_approved,
        }

    return [
        {
            'version_id': v.version_id,
            'term_id': term_id,
            'version_number': v.version_number,
            'status': v.status,
            'published_at': v.published_at.isoformat() if v.published_at else None,
            'session_count': len(v.sessions),
            'sessions': [
                _serialize_s(s)
                for s in sorted(v.sessions, key=lambda x: (x.session_date, x.period_number, x.class_id))
            ],
        }
        for v in versions
    ]

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
