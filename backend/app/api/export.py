from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import openpyxl
from io import BytesIO
from app.db.session import get_db
from app.models.models import Timetable, Teacher, Subject, Room, Class, Timeslot

router = APIRouter(prefix="/export", tags=["export"])

@router.get("/excel")
def export_excel(db: Session = Depends(get_db)):
    rows = db.query(Timetable).all()
    wb = openpyxl.Workbook()
    wb.remove(wb.active)  # remove default sheet

    # Group by class
    classes = db.query(Class).all()
    for cls in classes:
        ws = wb.create_sheet(title=cls.class_name[:31])  # Excel sheet name limit
        ws.append(["Day", "Period", "Subject", "Type", "Teacher", "Room"])
        for row in rows:
            if row.class_id != cls.class_id:
                continue
            ws.append([
                row.timeslot.day,
                row.timeslot.period_number,
                row.subject.subject_name,
                row.subject.subject_type,
                row.teacher.teacher_name,
                row.room.room_number,
            ])

    buf = BytesIO()
    wb.save(buf); buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=timetable.xlsx"}
    )