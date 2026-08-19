from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_db
from app.models.models import TimeSlot
from app.schemas.timeslot import TimeSlotCreate, TimeSlotRead, TimeSlotUpdate

router = APIRouter(prefix="/timeslots", tags=["timeslots"])


def _dump_payload(payload):
    """
    Support both Pydantic v1 (`dict`) and v2 (`model_dump`) for robustness.
    """
    if hasattr(payload, "model_dump"):
        return payload.model_dump(exclude_unset=True)
    return payload.dict(exclude_unset=True)


@router.get("", response_model=List[TimeSlotRead])
def get_timeslots(db: Session = Depends(get_db)) -> List[TimeSlotRead]:
    timeslots = db.query(TimeSlot).all()
    return [
        TimeSlotRead(slot_id=t.slot_id, day=t.day, period_number=t.period_number)
        for t in timeslots
    ]


@router.get("/{slot_id}", response_model=TimeSlotRead)
def get_timeslot(slot_id: int, db: Session = Depends(get_db)) -> TimeSlotRead:
    timeslot = db.query(TimeSlot).filter(TimeSlot.slot_id == slot_id).first()
    if not timeslot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="TimeSlot not found",
        )
    return TimeSlotRead(
        slot_id=timeslot.slot_id,
        day=timeslot.day,
        period_number=timeslot.period_number,
    )


@router.post("", response_model=TimeSlotRead, status_code=status.HTTP_201_CREATED)
def create_timeslot(payload: TimeSlotCreate, db: Session = Depends(get_db)) -> TimeSlotRead:
    data = _dump_payload(payload)
    timeslot = TimeSlot(**data)
    db.add(timeslot)
    db.commit()
    db.refresh(timeslot)
    return TimeSlotRead(
        slot_id=timeslot.slot_id,
        day=timeslot.day,
        period_number=timeslot.period_number,
    )


@router.put("/{slot_id}", response_model=TimeSlotRead)
def update_timeslot(
    slot_id: int, payload: TimeSlotUpdate, db: Session = Depends(get_db)
) -> TimeSlotRead:
    timeslot = db.query(TimeSlot).filter(TimeSlot.slot_id == slot_id).first()
    if not timeslot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="TimeSlot not found",
        )

    data = _dump_payload(payload)
    for field, value in data.items():
        setattr(timeslot, field, value)

    db.add(timeslot)
    db.commit()
    db.refresh(timeslot)
    return TimeSlotRead(
        slot_id=timeslot.slot_id,
        day=timeslot.day,
        period_number=timeslot.period_number,
    )


@router.delete("/{slot_id}", response_model=TimeSlotRead)
def delete_timeslot(slot_id: int, db: Session = Depends(get_db)) -> TimeSlotRead:
    timeslot = db.query(TimeSlot).filter(TimeSlot.slot_id == slot_id).first()
    if not timeslot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="TimeSlot not found",
        )

    deleted = TimeSlotRead(
        slot_id=timeslot.slot_id,
        day=timeslot.day,
        period_number=timeslot.period_number,
    )

    # Clear timetable and availability rows that reference this slot
    from app.models.models import Timetable, TeacherAvailability
    db.query(Timetable).filter(Timetable.slot_id == slot_id).delete()
    db.query(TeacherAvailability).filter(TeacherAvailability.slot_id == slot_id).delete()

    db.delete(timeslot)
    db.commit()
    return deleted