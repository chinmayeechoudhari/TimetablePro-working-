from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_db
from app.models.models import AcademicGroup, Division, Subject, SubjectDefinition, Teacher, TeacherSubject, TeachingAssignment

router = APIRouter(prefix="/teaching-assignments", tags=["teaching-assignments"])

class AssignmentCreate(BaseModel):
    teacher_id: int
    definition_id: int | None = None
    definition_ids: list[int] = []
    division_ids: list[int]

@router.get("")
def list_assignments(db: Session = Depends(get_db)):
    rows = db.query(TeachingAssignment).order_by(TeachingAssignment.assignment_id.asc()).all()
    return [{
        "assignment_id": row.assignment_id, "teacher_id": row.teacher_id, "teacher_name": row.teacher.teacher_name,
        "definition_id": row.definition_id, "subject_name": row.subject_definition.subject_name,
        "subject_type": row.subject_definition.subject_type, "division_id": row.division_id,
        "division_name": row.division.division_name, "class_id": row.division.class_id,
        "department": row.division.academic_group.department, "year_of_study": row.division.academic_group.year_of_study,
    } for row in rows]

@router.get("/groups")
def assignment_groups(db: Session = Depends(get_db)):
    groups = db.query(AcademicGroup).order_by(AcademicGroup.department, AcademicGroup.year_of_study).all()
    return [{
        "group_id": g.group_id,
        "label": f"{g.department} - {year_label(g.year_of_study)}",
        "department": g.department, "year_of_study": g.year_of_study,
        "divisions": [{"division_id": d.division_id, "division_name": d.division_name} for d in sorted(g.divisions, key=lambda x: x.division_name)],
        "subjects": [{"definition_id": s.definition_id, "subject_name": s.subject_name, "subject_type": s.subject_type, "periods_per_week": s.periods_per_week} for s in sorted(g.subject_definitions, key=lambda x: (x.subject_name, x.subject_type))],
    } for g in groups]

@router.post("", status_code=201)
def create_assignment(payload: AssignmentCreate, db: Session = Depends(get_db)):
    teacher = db.query(Teacher).filter(Teacher.teacher_id == payload.teacher_id).first()
    if not teacher: raise HTTPException(status_code=404, detail="Teacher not found.")

    def_ids = list(payload.definition_ids)
    if payload.definition_id and payload.definition_id not in def_ids:
        def_ids.append(payload.definition_id)

    if not def_ids:
        raise HTTPException(status_code=400, detail="Select at least one subject.")
    if not payload.division_ids:
        raise HTTPException(status_code=400, detail="Select at least one division.")

    definitions = db.query(SubjectDefinition).filter(SubjectDefinition.definition_id.in_(def_ids)).all()
    if len(definitions) != len(set(def_ids)):
        raise HTTPException(status_code=404, detail="One or more subjects were not found.")

    divisions = db.query(Division).filter(Division.division_id.in_(payload.division_ids)).all()
    if len(divisions) != len(set(payload.division_ids)):
        raise HTTPException(status_code=404, detail="One or more divisions were not found.")

    created_divisions = set()
    for definition in definitions:
        for division in divisions:
            if division.group_id != definition.group_id:
                raise HTTPException(status_code=400, detail="Subject and division must belong to the same department/year.")
            subject = db.query(Subject).filter(
                Subject.class_id == division.class_id,
                Subject.subject_name.ilike(definition.subject_name),
                Subject.subject_type == definition.subject_type
            ).first()
            if not subject:
                subject = Subject(
                    subject_name=definition.subject_name,
                    periods_per_week=definition.periods_per_week,
                    subject_type=definition.subject_type,
                    class_id=division.class_id
                )
                db.add(subject)
                db.flush()
            existing = db.query(TeachingAssignment).filter(
                TeachingAssignment.teacher_id == teacher.teacher_id,
                TeachingAssignment.definition_id == definition.definition_id,
                TeachingAssignment.division_id == division.division_id
            ).first()
            if existing:
                continue
            link = db.query(TeacherSubject).filter(
                TeacherSubject.teacher_id == teacher.teacher_id,
                TeacherSubject.subject_id == subject.subject_id
            ).first()
            if not link:
                db.add(TeacherSubject(teacher_id=teacher.teacher_id, subject_id=subject.subject_id))
            db.add(TeachingAssignment(
                teacher_id=teacher.teacher_id,
                definition_id=definition.definition_id,
                division_id=division.division_id,
                subject_id=subject.subject_id
            ))
            created_divisions.add(division.division_name)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="One or more assignments already exist.")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save assignment: {str(e)}")

    if not created_divisions:
        return {"message": "Selected assignment(s) are already assigned to this teacher.", "divisions": []}
    return {"message": f"Assignment saved for division(s): {', '.join(sorted(list(created_divisions)))}.", "divisions": sorted(list(created_divisions))}

@router.delete("/{assignment_id}")
def delete_assignment(assignment_id: int, db: Session = Depends(get_db)):
    row = db.query(TeachingAssignment).filter(TeachingAssignment.assignment_id == assignment_id).first()
    if not row: raise HTTPException(status_code=404, detail="Assignment not found.")
    db.delete(row); db.commit()
    return {"message": "Assignment deleted."}

def year_label(year: int) -> str:
    return {1: "1st Year", 2: "2nd Year", 3: "3rd Year", 4: "4th Year"}[year]
