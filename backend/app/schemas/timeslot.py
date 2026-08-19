from typing import Optional

from pydantic import BaseModel


class TimeSlotBase(BaseModel):
    day: str
    period_number: int


class TimeSlotCreate(BaseModel):
    day: str
    period_number: int


class TimeSlotUpdate(BaseModel):
    day: Optional[str] = None
    period_number: Optional[int] = None


class TimeSlotRead(BaseModel):
    slot_id: int
    day: str
    period_number: int

