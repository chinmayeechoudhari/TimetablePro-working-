import logging

from sqlalchemy.orm import Session

from app.models.models import Timetable

logger = logging.getLogger("timetable.solver")


def parse_and_save_solution(solver, assign, db: Session):
    """Read solved BoolVars and write Timetable rows to DB."""

    new_entries = []

    # Collect solution FIRST (no DB changes yet)
    for (c, s, t, sl, r), var in assign.items():
        if solver.Value(var) == 1:
            new_entries.append(
                Timetable(
                    class_id=c,
                    subject_id=s,
                    teacher_id=t,
                    slot_id=sl,
                    room_id=r
                )
            )

    logger.info("Solver produced %d timetable entries", len(new_entries))

    # SAFETY CHECK — don't delete old data if no solution
    if not new_entries:
        return {
            'status': 'no_solution',
            'message': 'Solver produced no timetable. Old timetable preserved.'
        }

    # Overwrite old timetable inside a transaction
    try:
        db.query(Timetable).delete()
        db.bulk_save_objects(new_entries)
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Failed to save timetable to database")
        raise

    return {
        'status': 'success',
        'entries_saved': len(new_entries)
    }


def solution_to_dict(solver, assign) -> list:
    """Convert solution to list of dicts (used in API response)."""
    result = []

    for (c, s, t, sl, r), var in assign.items():
        if solver.Value(var) == 1:
            result.append({
                'class_id':   c,
                'subject_id': s,
                'teacher_id': t,
                'slot_id':    sl,
                'room_id':    r
            })

    return result