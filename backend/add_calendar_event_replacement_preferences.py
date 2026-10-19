"""Add preferred replacement fields to calendar_event without dropping existing data.

Run from the backend directory after activating the project's virtual environment:
    python add_calendar_event_replacement_preferences.py
Safe to rerun; existing rows and tables are preserved.
"""
from sqlalchemy import inspect, text

from app.core.config import engine


def migrate():
    inspector = inspect(engine)
    if "calendar_event" not in inspector.get_table_names():
        raise RuntimeError("calendar_event table does not exist; start the app once to initialize the database.")
    columns = {column["name"] for column in inspector.get_columns("calendar_event")}
    with engine.begin() as connection:
        if "preferred_replacement_date" not in columns:
            connection.execute(text("ALTER TABLE calendar_event ADD COLUMN preferred_replacement_date DATE NULL"))
        if "preferred_replacement_period" not in columns:
            connection.execute(text("ALTER TABLE calendar_event ADD COLUMN preferred_replacement_period INTEGER NULL"))
    print("Migration complete: optional preferred replacement date/period columns are available.")


if __name__ == "__main__":
    migrate()
