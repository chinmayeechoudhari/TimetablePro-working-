from sqlalchemy import text
from app.core.config import engine

queries = {
    "TEACHER TABLE": """
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'teacher'
        ORDER BY ordinal_position
    """,
    "MAKEUP SESSION FOREIGN KEYS": """
        SELECT
            tc.constraint_name,
            kcu.column_name,
            ccu.table_name AS references_table,
            ccu.column_name AS references_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.constraint_schema = kcu.constraint_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
         AND ccu.constraint_schema = tc.constraint_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name = 'makeup_session'
    """
}

with engine.connect() as connection:
    for title, query in queries.items():
        print(f"\n--- {title} ---")
        for row in connection.execute(text(query)):
            print(row)
