from typing import List, Optional

from pydantic import BaseModel


class ClassBase(BaseModel):
    class_name: str


class ClassCreate(BaseModel):
    class_name: str


class ClassUpdate(BaseModel):
    class_name: Optional[str] = None


class ClassRead(BaseModel):
    class_id: int
    class_name: str


class ClassImportRowResult(BaseModel):
    row: int
    class_name: str
    status: str  # 'imported', 'skipped', 'invalid'
    reason: Optional[str] = None


class ClassImportResponse(BaseModel):
    total: int
    imported: int
    skipped: int
    failed: int
    rows: list[ClassImportRowResult]
