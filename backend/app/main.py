import logging
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

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
from app.api.validate import router as validate_router
from app.api.database import router as database_router
from app.api.calendar import router as calendar_router
from app.api.semester import router as semester_router
from app.api.semester_workflow import router as semester_workflow_router
from app.api.semester_optimize import router as semester_optimize_router

from app.core.config import Base, engine
from app.models import models
from app.models import calendar as calendar_models
from app.models import semester as semester_models

# ── Logging ──────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("timetable")

# ── Database ─────────────────────────────────────────────────
Base.metadata.create_all(bind=engine)

# ── App ──────────────────────────────────────────────────────
app = FastAPI(
    title="Timetable Generator API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ─────────────────────────────────────────────────────
# Read allowed origins from environment, defaulting to common dev origins.
# In production, set ALLOWED_ORIGINS="https://yourdomain.com,https://app.yourdomain.com"
_raw_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000,http://localhost:4173",
)
_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# ── Global Exception Handler ────────────────────────────────
@app.exception_handler(Exception)
async def _unhandled_exception_handler(request: Request, exc: Exception):
    import traceback
    tb = traceback.format_exc()
    logger.error("Unhandled error on %s %s: %s\n%s", request.method, request.url.path, exc, tb)
    with open("debug_error.log", "w", encoding="utf-8") as f:
        f.write(f"Unhandled error on {request.method} {request.url.path}: {exc}\n{tb}\n")
    return JSONResponse(
        status_code=500,
        content={"detail": f"{type(exc).__name__}: {str(exc)}", "traceback": tb},
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
app.include_router(validate_router)
app.include_router(database_router)
app.include_router(calendar_router)
app.include_router(semester_router)
app.include_router(semester_workflow_router)
app.include_router(semester_optimize_router)

logger.info("TimetablePro API started — %d router(s) mounted", 18)

