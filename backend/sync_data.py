import os
import sys
from dotenv import load_dotenv

load_dotenv()

from app.core.config import engine, Base, SessionLocal
from app.models.models import (
    Class, Subject, Teacher, Room, TimeSlot,
    TeacherSubject, TeacherAvailability, Timetable
)

def test_connection():
    print(f"Connecting to database...")
    try:
        with engine.connect() as conn:
            print("Successfully connected to database!")
            Base.metadata.create_all(bind=engine)
            print("Database tables created / verified successfully.")
            
        db = SessionLocal()
        print(f"Classes count: {db.query(Class).count()}")
        print(f"Subjects count: {db.query(Subject).count()}")
        print(f"Teachers count: {db.query(Teacher).count()}")
        print(f"Rooms count: {db.query(Room).count()}")
        print(f"TimeSlots count: {db.query(TimeSlot).count()}")
        db.close()
        return True
    except Exception as e:
        print(f"Database connection error: {e}")
        return False

if __name__ == "__main__":
    test_connection()
