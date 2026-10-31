from typing import Optional
from pydantic import BaseModel, Field


class SubjectBase(BaseModel):
    subject_name: str
    periods_per_week: int = 3
    total_hours: Optional[int] = None
    lecture_duration: int = Field(default=1, ge=1, le=4)
    subject_type: str = "theory"
    class_id: int


class SubjectCreate(BaseModel):
    subject_name: str
    periods_per_week: int = 3
    total_hours: Optional[int] = None
    lecture_duration: int = Field(default=1, ge=1, le=4)
    subject_type: Optional[str] = "theory"
    class_id: int


class SubjectUpdate(BaseModel):
    subject_name: Optional[str] = None
    periods_per_week: Optional[int] = None
    total_hours: Optional[int] = None
    lecture_duration: Optional[int] = None
    subject_type: Optional[str] = None
    class_id: Optional[int] = None


class SubjectRead(BaseModel):
    subject_id: int
    subject_name: str
    periods_per_week: int
    total_hours: Optional[int] = None
    lecture_duration: int = 1
    subject_type: str
    class_id: int
