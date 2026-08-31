from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.teachers import router as teachers_router
from app.api.rooms import router as rooms_router
from app.api.classes import router as classes_router
from app.api.subjects import router as subjects_router
from app.api.timeslots import router as timeslots_router
from app.api.teacher_availabilities import router as teacher_availabilities_router
from app.api.teacher_subjects import router as teacher_subjects_router
from app.api.academic_structure import router as academic_structure_router
from app.api.academic_subjects import router as academic_subjects_router
from app.api.teaching_assignments import router as teaching_assignments_router
from app.api.generate import router as generate_router
from app.api.constraints import router as constraints_router

from app.core.config import Base, engine
from app.models import models

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Timetable Generator API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/")
def health_check():
    return {"status": "ok", "message": "Timetable API is running"}


app.include_router(teachers_router)
app.include_router(rooms_router)
app.include_router(classes_router)
app.include_router(subjects_router)
app.include_router(timeslots_router)
app.include_router(teacher_availabilities_router)
app.include_router(teacher_subjects_router)
app.include_router(academic_structure_router)
app.include_router(academic_subjects_router)
app.include_router(teaching_assignments_router)
app.include_router(generate_router)
app.include_router(constraints_router)
