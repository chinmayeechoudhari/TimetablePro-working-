from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import get_db
from app.models.models import AcademicGroup, Class, Division

router = APIRouter(prefix="/academic-structure", tags=["academic-structure"])


class YearConfig(BaseModel):
    year_of_study: int = Field(ge=1, le=4)
    division_count: int = Field(ge=1, le=26)


class AcademicStructureCreate(BaseModel):
    academic_year: str
    department: str
    years: List[YearConfig]


class DepartmentRename(BaseModel):
    old_department: str
    new_department: str


class AdoptClassRequest(BaseModel):
    class_id: int
    academic_year: str
    department: str
    year_of_study: int = Field(ge=1, le=4)
    division_name: str = Field(min_length=1, max_length=1)


def year_label(year: int) -> str:
    return {1: "1st Year", 2: "2nd Year", 3: "3rd Year", 4: "4th Year"}[year]


def _serialize_group(group: AcademicGroup) -> dict:
    return {
        "group_id": group.group_id,
        "academic_year": group.academic_year,
        "department": group.department,
        "year_of_study": group.year_of_study,
        "divisions": [
            {"division_id": d.division_id, "class_id": d.class_id, "division_name": d.division_name}
            for d in sorted(group.divisions, key=lambda x: x.division_name)
        ],
    }


@router.get("")
def list_structure(db: Session = Depends(get_db)):
    groups = db.query(AcademicGroup).order_by(AcademicGroup.department, AcademicGroup.year_of_study).all()
    linked_class_ids = {d.class_id for g in groups for d in g.divisions}
    legacy_classes = (
        db.query(Class).filter(~Class.class_id.in_(linked_class_ids)).order_by(Class.class_name).all()
        if linked_class_ids else db.query(Class).order_by(Class.class_name).all()
    )
    return {
        "groups": [_serialize_group(g) for g in groups],
        "legacy_classes": [{"class_id": c.class_id, "class_name": c.class_name} for c in legacy_classes],
    }


@router.post("", status_code=201)
def create_structure(payload: AcademicStructureCreate, db: Session = Depends(get_db)):
    academic_year = payload.academic_year.strip()
    department = payload.department.strip()
    if not academic_year or not department:
        raise HTTPException(status_code=400, detail="Academic year and department are required.")

    years = {item.year_of_study: item.division_count for item in payload.years}
    if not years:
        raise HTTPException(status_code=400, detail="Add at least one year with divisions.")

    created = []
    for year, count in sorted(years.items()):
        existing = db.query(AcademicGroup).filter(
            func.lower(func.trim(AcademicGroup.academic_year)) == academic_year.lower(),
            func.lower(func.trim(AcademicGroup.department)) == department.lower(),
            AcademicGroup.year_of_study == year,
        ).first()
        if existing:
            raise HTTPException(status_code=409, detail=f"{department} {year_label(year)} already exists for {academic_year}.")

        group = AcademicGroup(academic_year=academic_year, department=department, year_of_study=year)
        db.add(group)
        db.flush()
        for index in range(count):
            division_name = chr(ord("A") + index)
            class_obj = Class(class_name=f"{department} {year_label(year)} - {division_name}")
            db.add(class_obj)
            db.flush()
            db.add(Division(group_id=group.group_id, class_id=class_obj.class_id, division_name=division_name))
        created.append(group)

    db.commit()
    return {
        "message": "Academic structure created.",
        "groups": [
            {"group_id": g.group_id, "department": g.department, "year_of_study": g.year_of_study,
             "divisions": [d.division_name for d in sorted(g.divisions, key=lambda x: x.division_name)]}
            for g in created
        ],
    }


@router.put("/department")
def rename_department(payload: DepartmentRename, db: Session = Depends(get_db)):
    old = payload.old_department.strip()
    new = payload.new_department.strip()
    if not old or not new:
        raise HTTPException(status_code=400, detail="Both department names are required.")
    groups = db.query(AcademicGroup).filter(func.lower(func.trim(AcademicGroup.department)) == old.lower()).all()
    if not groups:
        raise HTTPException(status_code=404, detail="Department not found.")
    if old.lower() == new.lower():
        return {"message": "Department name is unchanged."}
    for group in groups:
        duplicate = db.query(AcademicGroup).filter(
            AcademicGroup.group_id != group.group_id,
            func.lower(func.trim(AcademicGroup.academic_year)) == group.academic_year.lower(),
            func.lower(func.trim(AcademicGroup.department)) == new.lower(),
            AcademicGroup.year_of_study == group.year_of_study,
        ).first()
        if duplicate:
            raise HTTPException(status_code=409, detail=f"{new} already exists for {group.academic_year} {year_label(group.year_of_study)}.")
    for group in groups:
        group.department = new
    db.commit()
    return {"message": f"Department renamed to {new}."}


@router.delete("/department")
def remove_department(department: str, db: Session = Depends(get_db)):
    name = department.strip()
    groups = db.query(AcademicGroup).filter(func.lower(func.trim(AcademicGroup.department)) == name.lower()).all()
    if not groups:
        raise HTTPException(status_code=404, detail="Department not found.")

    assignment_count = sum(len(d.assignments) for g in groups for d in g.divisions)
    if assignment_count:
        raise HTTPException(
            status_code=409,
            detail=f"{name} cannot be removed yet because it has {assignment_count} teaching assignment(s). Remove those assignments first.",
        )

    # Delete only the academic-structure records. Existing Class rows remain,
    # so old class/subject/timetable data is not destroyed by this action.
    for group in groups:
        for division in list(group.divisions):
            db.delete(division)
        db.delete(group)
    db.commit()
    return {"message": f"{name} was removed from academic structure. Existing class records were preserved."}


@router.post("/adopt-class")
def adopt_existing_class(payload: AdoptClassRequest, db: Session = Depends(get_db)):
    academic_year = payload.academic_year.strip()
    department = payload.department.strip()
    division_name = payload.division_name.strip().upper()
    if not academic_year or not department:
        raise HTTPException(status_code=400, detail="Academic year and department are required.")
    if not division_name.isalpha() or len(division_name) != 1:
        raise HTTPException(status_code=400, detail="Division must be a single letter such as A or B.")

    class_obj = db.query(Class).filter(Class.class_id == payload.class_id).first()
    if class_obj is None:
        raise HTTPException(status_code=404, detail="Class not found.")
    if class_obj.division is not None:
        raise HTTPException(status_code=409, detail="This class is already linked to an academic division.")

    group = db.query(AcademicGroup).filter(
        func.lower(func.trim(AcademicGroup.academic_year)) == academic_year.lower(),
        func.lower(func.trim(AcademicGroup.department)) == department.lower(),
        AcademicGroup.year_of_study == payload.year_of_study,
    ).first()
    if group is None:
        raise HTTPException(status_code=404, detail=f"Create {department} {year_label(payload.year_of_study)} first, then link the class.")

    duplicate_division = db.query(Division).filter(
        Division.group_id == group.group_id,
        func.lower(Division.division_name) == division_name.lower(),
    ).first()
    if duplicate_division is not None:
        raise HTTPException(status_code=409, detail=f"Division {division_name} already exists in {department} {year_label(payload.year_of_study)}.")

    db.add(Division(group_id=group.group_id, class_id=class_obj.class_id, division_name=division_name))
    db.commit()
    return {"message": f"{class_obj.class_name} linked as {department} {year_label(payload.year_of_study)} - {division_name}."}
