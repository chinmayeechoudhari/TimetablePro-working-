from typing import Optional

from pydantic import BaseModel


class TeacherSubjectBase(BaseModel):
    teacher_id: int
    subject_id: int


class TeacherSubjectCreate(BaseModel):
    teacher_id: int
    subject_id: int


class TeacherSubjectUpdate(BaseModel):
    teacher_id: Optional[int] = None
    subject_id: Optional[int] = None


class TeacherSubjectRead(BaseModel):
    teacher_id: int
    subject_id: int

