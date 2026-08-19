from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import get_db
from app.models.models import Teacher, Room, Class, Subject, TimeSlot, TeacherSubject

router = APIRouter(prefix="/validate", tags=["validate"])


@router.get("")
def validate_system(db: Session = Depends(get_db)):
    """
    Checks whether all required data is present to generate a timetable.
    Returns a ready flag, a human-readable summary, and per-item details.
    """

    teacher_count  = db.query(Teacher).count()
    room_count     = db.query(Room).count()
    class_count    = db.query(Class).count()
    subject_count  = db.query(Subject).count()
    timeslot_count = db.query(TimeSlot).count()
    ts_count       = db.query(TeacherSubject).count()

    checks = {
        "teachers":        teacher_count > 0,
        "rooms":           room_count > 0,
        "classes":         class_count > 0,
        "subjects":        subject_count > 0,
        "timeslots":       timeslot_count > 0,
        "teacher_subjects": ts_count > 0,
    }

    ready = all(checks.values())

    if ready:
        summary = (
            f"All systems go! You have {teacher_count} teacher(s), "
            f"{room_count} room(s), {class_count} class(es), "
            f"{subject_count} subject(s), {timeslot_count} time slot(s), "
            f"and {ts_count} teacher-subject assignment(s) configured."
        )
    else:
        missing = [k for k, v in checks.items() if not v]
        summary = (
            "Setup incomplete. Please add: "
            + ", ".join(missing).replace("_", " ")
            + "."
        )

    return {
        "ready":   ready,
        "summary": summary,
        "checks":  checks,
        "counts": {
            "teachers":         teacher_count,
            "rooms":            room_count,
            "classes":          class_count,
            "subjects":         subject_count,
            "timeslots":        timeslot_count,
            "teacher_subjects": ts_count,
        },
    }
