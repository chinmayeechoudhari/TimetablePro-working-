from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.core.config import get_db
from app.models.models import AcademicGroup, Division, Subject, SubjectDefinition

router = APIRouter(prefix="/academic-subjects", tags=["academic-subjects"])

class SubjectCreate(BaseModel):
    group_id: int
    subject_name: str
    subject_type: str = Field(default="theory", pattern="^(theory|lab)$")
    periods_per_week: int = Field(ge=1, le=30)

@router.get("")
def list_subjects(group_id: int | None = None, db: Session = Depends(get_db)):
    query=db.query(SubjectDefinition)
    if group_id: query=query.filter(SubjectDefinition.group_id==group_id)
    rows=query.order_by(SubjectDefinition.subject_name, SubjectDefinition.subject_type).all()
    return [{"definition_id":r.definition_id,"group_id":r.group_id,"subject_name":r.subject_name,"subject_type":r.subject_type,"periods_per_week":r.periods_per_week} for r in rows]

@router.post("", status_code=201)
def create_subject(payload: SubjectCreate, db: Session = Depends(get_db)):
    group=db.query(AcademicGroup).filter(AcademicGroup.group_id==payload.group_id).first()
    if not group: raise HTTPException(status_code=404, detail="Academic group not found.")
    name=payload.subject_name.strip()
    if not name: raise HTTPException(status_code=400, detail="Subject name is required.")
    duplicate=db.query(SubjectDefinition).filter(SubjectDefinition.group_id==group.group_id, SubjectDefinition.subject_name.ilike(name), SubjectDefinition.subject_type==payload.subject_type.lower()).first()
    if duplicate: raise HTTPException(status_code=409, detail=f"{name} ({payload.subject_type}) already exists for this department/year.")
    definition=SubjectDefinition(group_id=group.group_id,subject_name=name,subject_type=payload.subject_type.lower(),periods_per_week=payload.periods_per_week)
    db.add(definition); db.flush()
    divisions=db.query(Division).filter(Division.group_id==group.group_id).all()
    for division in divisions:
        db.add(Subject(subject_name=name,periods_per_week=payload.periods_per_week,subject_type=payload.subject_type.lower(),class_id=division.class_id))
    db.commit(); db.refresh(definition)
    return {"definition_id":definition.definition_id,"group_id":definition.group_id,"subject_name":definition.subject_name,"subject_type":definition.subject_type,"periods_per_week":definition.periods_per_week,"assigned_to_divisions":[d.division_name for d in divisions]}
