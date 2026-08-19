from collections import defaultdict
from sqlalchemy.orm import Session
from app.models.models import (
    Subject, Teacher, Room, TimeSlot,
    TeacherSubject, TeacherAvailability
)

def run_preflight_checks(db: Session) -> dict:
    """
    Runs validation checks before (or after failed) timetable generation.
    Returns a structured report with passed/failed checks.
    """
    issues = []
    warnings = []
    passed = []

    subjects = db.query(Subject).all()
    teachers = db.query(Teacher).all()
    rooms = db.query(Room).all()
    slots = db.query(TimeSlot).all()
    ts_links = db.query(TeacherSubject).all()

    total_slots = len(slots)
    linked_subject_ids = {link.subject_id for link in ts_links}
    linked_teacher_ids = {link.teacher_id for link in ts_links}
    lab_subject_ids = {s.subject_id for s in subjects if s.subject_type == "lab"}
    lab_room_ids = {r.room_id for r in rooms if r.room_type == "lab"}

    # Check 1: slot capacity check (PER CLASS, not global)
    subjects_by_class = defaultdict(list)
    for s in subjects:
        subjects_by_class[s.class_id].append(s)

    capacity_issues = []
    for class_id, class_subjects in subjects_by_class.items():
        class_periods_needed = sum(s.periods_per_week for s in class_subjects)

        if class_periods_needed > total_slots:
            capacity_issues.append(
                f"Class {class_id} needs {class_periods_needed} periods/week "
                f"but only {total_slots} timeslots are available. "
                f"Add more timeslots or reduce periods_per_week."
            )

    if capacity_issues:
        issues.extend(capacity_issues)
    else:
        passed.append(
            f"Slot capacity OK: each class fits within {total_slots} available timeslots."
        )

# Check 2: subjects with no teacher linked
    unlinked_subjects = [
        s for s in subjects if s.subject_id not in linked_subject_ids
    ]
    if unlinked_subjects:
        names = ", ".join(
            f"{s.subject_name} ({s.class_.class_name})" if s.class_ else s.subject_name
            for s in unlinked_subjects
        )
        issues.append(
            f"These subjects have no teacher assigned: {names}. "
            f"Go to Teacher-Subject page and link a teacher."
        )
    else:
        passed.append("All subjects have at least one teacher linked.")

    # Check 3: lab subjects but no lab rooms
    if lab_subject_ids and not lab_room_ids:
        issues.append(
            f"You have {len(lab_subject_ids)} lab subject(s) but no lab rooms. "
            f"Add a lab room or change subject type to theory."
        )
    elif lab_subject_ids and lab_room_ids:
        passed.append(
            f"Lab matching OK: {len(lab_subject_ids)} lab subject(s), "
            f"{len(lab_room_ids)} lab room(s)."
        )

    # Check 4: teachers with no subjects linked
    unlinked_teachers = [
        t for t in teachers if t.teacher_id not in linked_teacher_ids
    ]
    if unlinked_teachers:
        names = ", ".join(t.teacher_name for t in unlinked_teachers)
        warnings.append(
            f"These teachers have no subjects assigned: {names}. "
            f"They will be ignored by the solver."
        )
    else:
        passed.append("All teachers have at least one subject linked.")

    # Check 5: no subjects entered at all
    if not subjects:
        issues.append("No subjects found. Please add subjects before generating.")

    # Check 6: no timeslots entered at all
    if not slots:
        issues.append("No timeslots found. Please generate timeslots first.")

    # Check 7: no rooms entered at all
    if not rooms:
        issues.append("No rooms found. Please add at least one room.")

    is_ready = len(issues) == 0

    return {
        "ready": is_ready,
        "issues": issues,
        "warnings": warnings,
        "passed": passed,
        "summary": (
            "Ready to generate." if is_ready
            else f"{len(issues)} issue(s) must be fixed before generating."
        )
    }