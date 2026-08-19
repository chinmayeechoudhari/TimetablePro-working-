from typing import Optional

from pydantic import BaseModel


class TeacherAvailabilityBase(BaseModel):
    teacher_id: int
    slot_id: int
    is_available: bool = True


class TeacherAvailabilityCreate(BaseModel):
    teacher_id: int
    slot_id: int
    is_available: Optional[bool] = True


class TeacherAvailabilityUpdate(BaseModel):
    is_available: Optional[bool] = None


class TeacherAvailabilityRead(BaseModel):
    teacher_id: int
    slot_id: int
    is_available: bool

