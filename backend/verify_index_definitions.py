from sqlalchemy import text
from app.core.config import engine

query = """
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
      'uq_room_room_number_lower',
      'uq_academic_group_scope',
      'uq_teacher_name_normalized'
  )
ORDER BY indexname
"""

with engine.connect() as connection:
    for row in connection.execute(text(query)):
        print(row)
