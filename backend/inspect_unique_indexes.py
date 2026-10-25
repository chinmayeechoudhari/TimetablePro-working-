from sqlalchemy import text
from app.core.config import engine

query = """
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('teacher', 'room', 'academic_group')
ORDER BY tablename, indexname
"""

with engine.connect() as connection:
    for row in connection.execute(text(query)):
        print(row)
