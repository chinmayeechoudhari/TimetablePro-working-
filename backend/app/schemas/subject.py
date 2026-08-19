from typing import Optional

from pydantic import BaseModel


class SubjectBase(BaseModel):
    subject_name: str
    periods_per_week: int
    subject_type: str = "theory"
    class_id: int


class SubjectCreate(BaseModel):
    subject_name: str
    periods_per_week: int
    subject_type: Optional[str] = "theory"
    class_id: int


class SubjectUpdate(BaseModel):
    subject_name: Optional[str] = None
    periods_per_week: Optional[int] = None
    subject_type: Optional[str] = None
    class_id: Optional[int] = None


class SubjectRead(BaseModel):
    subject_id: int
    subject_name: str
    periods_per_week: int
    subject_type: str
    class_id: int

