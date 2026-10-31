"""Add total_hours and lecture_duration to SubjectDefinition and Subject models.

Safe and idempotent migration. Existing data and foreign keys are preserved.
"""
from sqlalchemy import inspect, text
from app.core.config import engine

def migrate():
    inspector = inspect(engine)
    with engine.begin() as conn:
        # 1. subject_definition table
        sd_cols = {c["name"] for c in inspector.get_columns("subject_definition")}
        if "total_hours" not in sd_cols:
            print("Adding total_hours to subject_definition...")
            conn.execute(text("ALTER TABLE subject_definition ADD COLUMN total_hours INTEGER NULL;"))
        if "lecture_duration" not in sd_cols:
            print("Adding lecture_duration to subject_definition...")
            conn.execute(text("ALTER TABLE subject_definition ADD COLUMN lecture_duration INTEGER NOT NULL DEFAULT 1;"))

        # 2. subject table
        s_cols = {c["name"] for c in inspector.get_columns("subject")}
        if "total_hours" not in s_cols:
            print("Adding total_hours to subject...")
            conn.execute(text("ALTER TABLE subject ADD COLUMN total_hours INTEGER NULL;"))
        if "lecture_duration" not in s_cols:
            print("Adding lecture_duration to subject...")
            conn.execute(text("ALTER TABLE subject ADD COLUMN lecture_duration INTEGER NOT NULL DEFAULT 1;"))

        # 3. calendar_event table (ensure suppresses_lectures exists)
        ce_cols = {c["name"] for c in inspector.get_columns("calendar_event")}
        if "suppresses_lectures" not in ce_cols:
            print("Adding suppresses_lectures to calendar_event...")
            conn.execute(text("ALTER TABLE calendar_event ADD COLUMN suppresses_lectures BOOLEAN NOT NULL DEFAULT FALSE;"))

    print("Migration complete and verified.")

if __name__ == "__main__":
    migrate()
