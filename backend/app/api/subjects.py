from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_db
from app.models.models import Subject
from app.schemas.subject import SubjectCreate, SubjectRead, SubjectUpdate

router = APIRouter(prefix="/subjects", tags=["subjects"])


def _dump_payload(payload):
    """
    Support both Pydantic v1 (`dict`) and v2 (`model_dump`) for robustness.
    """
    if hasattr(payload, "model_dump"):
        return payload.model_dump(exclude_unset=True)
    return payload.dict(exclude_unset=True)


@router.get("", response_model=List[SubjectRead])
def get_subjects(db: Session = Depends(get_db)) -> List[SubjectRead]:
    subjects = db.query(Subject).all()
    return [
        SubjectRead(
            subject_id=s.subject_id,
            subject_name=s.subject_name,
            periods_per_week=s.periods_per_week,
            subject_type=s.subject_type,
            class_id=s.class_id,
        )
        for s in subjects
    ]


@router.get("/{subject_id}", response_model=SubjectRead)
def get_subject(subject_id: int, db: Session = Depends(get_db)) -> SubjectRead:
    subject = db.query(Subject).filter(Subject.subject_id == subject_id).first()
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subject not found",
        )
    return SubjectRead(
        subject_id=subject.subject_id,
        subject_name=subject.subject_name,
        periods_per_week=subject.periods_per_week,
        subject_type=subject.subject_type,
        class_id=subject.class_id,
    )


@router.post("", response_model=SubjectRead, status_code=status.HTTP_201_CREATED)
def create_subject(payload: SubjectCreate, db: Session = Depends(get_db)) -> SubjectRead:
    data = _dump_payload(payload)
    subject = Subject(**data)
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return SubjectRead(
        subject_id=subject.subject_id,
        subject_name=subject.subject_name,
        periods_per_week=subject.periods_per_week,
        subject_type=subject.subject_type,
        class_id=subject.class_id,
    )


@router.put("/{subject_id}", response_model=SubjectRead)
def update_subject(
    subject_id: int, payload: SubjectUpdate, db: Session = Depends(get_db)
) -> SubjectRead:
    subject = db.query(Subject).filter(Subject.subject_id == subject_id).first()
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subject not found",
        )

    data = _dump_payload(payload)
    for field, value in data.items():
        setattr(subject, field, value)

    db.add(subject)
    db.commit()
    db.refresh(subject)
    return SubjectRead(
        subject_id=subject.subject_id,
        subject_name=subject.subject_name,
        periods_per_week=subject.periods_per_week,
        subject_type=subject.subject_type,
        class_id=subject.class_id,
    )


@router.delete("/{subject_id}", response_model=SubjectRead)
def delete_subject(subject_id: int, db: Session = Depends(get_db)) -> SubjectRead:
    subject = db.query(Subject).filter(Subject.subject_id == subject_id).first()
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subject not found",
        )

    deleted = SubjectRead(
        subject_id=subject.subject_id,
        subject_name=subject.subject_name,
        periods_per_week=subject.periods_per_week,
        subject_type=subject.subject_type,
        class_id=subject.class_id,
    )

    from app.models.models import TeacherSubject, Timetable
    db.query(TeacherSubject).filter(TeacherSubject.subject_id == subject_id).delete(synchronize_session=False)
    db.query(Timetable).filter(Timetable.subject_id == subject_id).delete(synchronize_session=False)

    db.delete(subject)
    db.commit()
    return deleted

