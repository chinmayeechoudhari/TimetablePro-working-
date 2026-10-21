from sqlalchemy import text
from app.core.config import engine

query = """
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'makeup_session'
ORDER BY ordinal_position
"""

with engine.connect() as connection:
    for row in connection.execute(text(query)):
        print(row)
