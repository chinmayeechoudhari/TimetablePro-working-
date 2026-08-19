from celery import Celery
import os
from dotenv import load_dotenv

load_dotenv()

celery_app = Celery(
    'timetable',
    broker='redis://127.0.0.1:6379/0',
    backend='redis://127.0.0.1:6379/0'
)

@celery_app.task(bind=True)
def run_solver_task(self):
    print("🔥 CELERY TASK STARTED")

    from app.core.config import SessionLocal
    from app.solver.solver import build_and_solve

    db = SessionLocal()

    try:
        result = build_and_solve(db)
        print("🔥 CELERY RESULT:", result)
        return result

    except Exception as e:
        print("🔥 CELERY ERROR:", str(e))
        return {"status": "error", "message": str(e)}

    finally:
        db.close()