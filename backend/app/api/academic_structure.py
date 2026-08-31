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


@router.get("")
def list_structure(db: Session = Depends(get_db)):
    groups = db.query(AcademicGroup).order_by(AcademicGroup.department, AcademicGroup.year_of_study).all()
    return [
        {
            "group_id": g.group_id,
            "academic_year": g.academic_year,
            "department": g.department,
            "year_of_study": g.year_of_study,
            "divisions": [
                {"division_id": d.division_id, "class_id": d.class_id, "division_name": d.division_name}
                for d in sorted(g.divisions, key=lambda x: x.division_name)
            ],
        }
        for g in groups
    ]


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
        existing = (
            db.query(AcademicGroup)
            .filter(
                func.lower(func.trim(AcademicGroup.academic_year)) == academic_year.lower(),
                func.lower(func.trim(AcademicGroup.department)) == department.lower(),
                AcademicGroup.year_of_study == year,
            )
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"{department} {year_label(year)} already exists for {academic_year}.",
            )

        group = AcademicGroup(
            academic_year=academic_year,
            department=department,
            year_of_study=year,
        )
        db.add(group)
        db.flush()

        for index in range(count):
            division_name = chr(ord('A') + index)
            class_obj = Class(class_name=f"{department} {year_label(year)} - {division_name}")
            db.add(class_obj)
            db.flush()
            db.add(
                Division(
                    group_id=group.group_id,
                    class_id=class_obj.class_id,
                    division_name=division_name,
                )
            )

        created.append(group)

    db.commit()
    return {
        "message": "Academic structure created.",
        "groups": [
            {
                "group_id": g.group_id,
                "department": g.department,
                "year_of_study": g.year_of_study,
                "divisions": [d.division_name for d in sorted(g.divisions, key=lambda x: x.division_name)],
            }
            for g in created
        ],
    }


def year_label(year: int) -> str:
    return {1: "1st Year", 2: "2nd Year", 3: "3rd Year", 4: "4th Year"}[year]
