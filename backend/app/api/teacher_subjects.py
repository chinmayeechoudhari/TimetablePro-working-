from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_db
from app.models.models import TeacherSubject
from app.schemas.teacher_subject import (
    TeacherSubjectCreate,
    TeacherSubjectRead,
    TeacherSubjectUpdate,
)

router = APIRouter(prefix="/teacher-subjects", tags=["teacher-subjects"])


def _dump_payload(payload):
    """
    Support both Pydantic v1 (`dict`) and v2 (`model_dump`) for robustness.
    """
    if hasattr(payload, "model_dump"):
        return payload.model_dump(exclude_unset=True)
    return payload.dict(exclude_unset=True)


@router.get("", response_model=List[TeacherSubjectRead])
def get_teacher_subjects(db: Session = Depends(get_db)) -> List[TeacherSubjectRead]:
    items = db.query(TeacherSubject).all()
    return [TeacherSubjectRead(teacher_id=i.teacher_id, subject_id=i.subject_id) for i in items]


@router.get("/{teacher_id}/{subject_id}", response_model=TeacherSubjectRead)
def get_teacher_subject(teacher_id: int, subject_id: int, db: Session = Depends(get_db)) -> TeacherSubjectRead:
    item = (
        db.query(TeacherSubject)
        .filter(
            TeacherSubject.teacher_id == teacher_id,
            TeacherSubject.subject_id == subject_id,
        )
        .first()
    )
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="TeacherSubject not found",
        )
    return TeacherSubjectRead(teacher_id=item.teacher_id, subject_id=item.subject_id)


@router.post("", response_model=TeacherSubjectRead, status_code=status.HTTP_201_CREATED)
def create_teacher_subject(payload: TeacherSubjectCreate, db: Session = Depends(get_db)) -> TeacherSubjectRead:
    data = _dump_payload(payload)
    item = TeacherSubject(**data)
    db.add(item)
    db.commit()
    db.refresh(item)
    return TeacherSubjectRead(teacher_id=item.teacher_id, subject_id=item.subject_id)


@router.put("/{teacher_id}/{subject_id}", response_model=TeacherSubjectRead)
def update_teacher_subject(
    teacher_id: int,
    subject_id: int,
    payload: TeacherSubjectUpdate,
    db: Session = Depends(get_db),
) -> TeacherSubjectRead:
    item = (
        db.query(TeacherSubject)
        .filter(
            TeacherSubject.teacher_id == teacher_id,
            TeacherSubject.subject_id == subject_id,
        )
        .first()
    )
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="TeacherSubject not found",
        )

    data = _dump_payload(payload)
    for field, value in data.items():
        setattr(item, field, value)

    db.add(item)
    db.commit()
    db.refresh(item)
    return TeacherSubjectRead(teacher_id=item.teacher_id, subject_id=item.subject_id)


@router.delete("/{teacher_id}/{subject_id}", response_model=TeacherSubjectRead)
def delete_teacher_subject(teacher_id: int, subject_id: int, db: Session = Depends(get_db)) -> TeacherSubjectRead:
    item = (
        db.query(TeacherSubject)
        .filter(
            TeacherSubject.teacher_id == teacher_id,
            TeacherSubject.subject_id == subject_id,
        )
        .first()
    )
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="TeacherSubject not found",
        )

    deleted = TeacherSubjectRead(teacher_id=item.teacher_id, subject_id=item.subject_id)
    db.delete(item)
    db.commit()
    return deleted

