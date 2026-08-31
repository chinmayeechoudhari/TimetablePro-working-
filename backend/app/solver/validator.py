from collections import defaultdict
from sqlalchemy.orm import Session
from app.models.models import Subject, Teacher, Room, TimeSlot, TeacherSubject, TeacherAvailability, AcademicGroup, Division, SubjectDefinition, TeachingAssignment


def run_preflight_checks(db: Session) -> dict:
    issues=[]; warnings=[]; passed=[]
    subjects=db.query(Subject).all(); teachers=db.query(Teacher).all(); rooms=db.query(Room).all(); slots=db.query(TimeSlot).all(); ts_links=db.query(TeacherSubject).all()
    groups=db.query(AcademicGroup).all(); definitions=db.query(SubjectDefinition).all(); assignments=db.query(TeachingAssignment).all()
    total_slots=len(slots); linked_subject_ids={x.subject_id for x in ts_links}; linked_teacher_ids={x.teacher_id for x in ts_links}
    lab_subject_ids={s.subject_id for s in subjects if s.subject_type=='lab'}; lab_room_ids={r.room_id for r in rooms if r.room_type=='lab'}

    if groups:
        passed.append(f"Academic structure OK: {len(groups)} department/year group(s) and {len(db.query(Division).all())} division(s) configured.")
        missing=[]
        for definition in definitions:
            divs=db.query(Division).filter(Division.group_id==definition.group_id).all()
            for div in divs:
                found=db.query(Subject).filter(Subject.class_id==div.class_id, Subject.subject_name==definition.subject_name, Subject.subject_type==definition.subject_type).first()
                if not found: missing.append(f"{definition.subject_name} ({definition.subject_type}) → Division {div.division_name}")
        if missing: issues.append("Missing subject copies for divisions: " + ", ".join(missing))
        else: passed.append("Every configured subject is present for every division in its department/year.")

        missing_assignments=[]
        for definition in definitions:
            for div in db.query(Division).filter(Division.group_id==definition.group_id).all():
                if not db.query(TeachingAssignment).filter(TeachingAssignment.definition_id==definition.definition_id, TeachingAssignment.division_id==div.division_id).first():
                    missing_assignments.append(f"{definition.subject_name} → Division {div.division_name}")
        if missing_assignments: issues.append("These subjects/divisions have no teaching assignment: " + ", ".join(missing_assignments))
        else: passed.append("Every subject has at least one teacher assignment for every division.")
    else:
        warnings.append("No academic structure has been created yet. Use Academic Structure before generation.")

    subjects_by_class=defaultdict(list)
    for s in subjects: subjects_by_class[s.class_id].append(s)
    capacity_issues=[]
    for class_id,class_subjects in subjects_by_class.items():
        needed=sum(s.periods_per_week for s in class_subjects)
        if needed>total_slots: capacity_issues.append(f"Class {class_id} needs {needed} periods/week but only {total_slots} timeslots are available.")
    if capacity_issues: issues.extend(capacity_issues)
    else: passed.append(f"Slot capacity OK: each class fits within {total_slots} available timeslots.")

    unlinked_subjects=[s for s in subjects if s.subject_id not in linked_subject_ids]
    if unlinked_subjects:
        issues.append("These subjects have no teacher assigned: " + ", ".join(f"{s.subject_name} ({s.class_.class_name})" if s.class_ else s.subject_name for s in unlinked_subjects) + ".")
    else: passed.append("All subjects have at least one teacher linked.")

    if lab_subject_ids and not lab_room_ids: issues.append(f"You have {len(lab_subject_ids)} lab subject(s) but no lab rooms.")
    elif lab_subject_ids and lab_room_ids: passed.append(f"Lab matching OK: {len(lab_subject_ids)} lab subject(s), {len(lab_room_ids)} lab room(s).")

    unlinked_teachers=[t for t in teachers if t.teacher_id not in linked_teacher_ids]
    if unlinked_teachers: warnings.append("These teachers have no subjects assigned: " + ", ".join(t.teacher_name for t in unlinked_teachers) + ".")
    else: passed.append("All teachers have at least one subject linked.")

    if not subjects: issues.append("No subjects found. Please add subjects before generating.")
    if not slots: issues.append("No timeslots found. Please generate timeslots first.")
    if not rooms: issues.append("No rooms found. Please add at least one room.")

    return {'ready':len(issues)==0,'issues':issues,'warnings':warnings,'passed':passed,'summary':('Ready to generate.' if not issues else f'{len(issues)} issue(s) must be fixed before generating.')}
