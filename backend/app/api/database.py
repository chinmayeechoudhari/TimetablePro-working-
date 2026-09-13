from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.config import get_db, Base, engine

router = APIRouter(prefix="/database", tags=["database"])


@router.delete("/wipe")
@router.post("/wipe")
def wipe_database(db: Session = Depends(get_db)):
    """
    Wipes all record data from every database table without dropping the tables.
    Also resets identity sequences (auto-increment counters) so newly added items start from ID 1.
    """
    try:
        table_names = [t.name for t in Base.metadata.sorted_tables]

        if engine.dialect.name == "postgresql":
            # In PostgreSQL, quote reserved keywords (like "constraint") and truncate in cascade
            quoted_tables = [f'"{name}"' for name in table_names]
            sql = f"TRUNCATE TABLE {', '.join(quoted_tables)} RESTART IDENTITY CASCADE;"
            db.execute(text(sql))
            db.commit()
        elif engine.dialect.name == "sqlite":
            db.execute(text("PRAGMA foreign_keys = OFF;"))
            for name in table_names:
                db.execute(text(f'DELETE FROM "{name}";'))
            try:
                db.execute(text("DELETE FROM sqlite_sequence;"))
            except Exception:
                pass
            db.execute(text("PRAGMA foreign_keys = ON;"))
            db.commit()
        else:
            for table in reversed(Base.metadata.sorted_tables):
                db.execute(table.delete())
            db.commit()

        return {
            "status": "success",
            "message": "All table data wiped successfully while keeping tables intact.",
            "tables_cleared": table_names,
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to wipe database: {str(e)}")
