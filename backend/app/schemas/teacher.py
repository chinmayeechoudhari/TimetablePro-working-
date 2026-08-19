from typing import List, Optional

from pydantic import BaseModel


class TeacherBase(BaseModel):
    teacher_name: str
    max_periods_per_day: int = 6


class TeacherCreate(BaseModel):
    teacher_name: str
    max_periods_per_day: Optional[int] = None


class TeacherUpdate(BaseModel):
    teacher_name: Optional[str] = None
    max_periods_per_day: Optional[int] = None


class TeacherRead(BaseModel):
    teacher_id: int
    teacher_name: str
    max_periods_per_day: int


class TeacherImportRowResult(BaseModel):
    row: int
    teacher_name: str
    max_periods_per_day: Optional[int] = None
    status: str  # 'imported', 'skipped', 'invalid'
    reason: Optional[str] = None


class TeacherImportResponse(BaseModel):
    total: int
    imported: int
    skipped: int
    failed: int
    rows: list[TeacherImportRowResult]
