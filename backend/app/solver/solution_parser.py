from app.models.models import Timetable
from sqlalchemy.orm import Session


def parse_and_save_solution(solver, assign, db: Session):
    """Read solved BoolVars and write Timetable rows to DB"""

    new_entries = []

    # 🔍 Collect solution FIRST (no DB changes yet)
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

    print("Entries found by solver:", len(new_entries))  # 🔥 debug

    # ❗ SAFETY CHECK — don't delete old data if no solution
    if not new_entries:
        return {
            'status': 'no_solution',
            'message': 'Solver produced no timetable. Old timetable preserved.'
        }

    # 🔁 Now safe to overwrite old timetable
    db.query(Timetable).delete()

    for entry in new_entries:
        db.add(entry)

    db.commit()

    return {
        'status': 'success',
        'entries_saved': len(new_entries)
    }


def solution_to_dict(solver, assign) -> list:
    """Convert solution to list of dicts (used in API response)"""
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