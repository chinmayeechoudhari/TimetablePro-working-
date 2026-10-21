from alembic.migration import MigrationContext
from alembic.autogenerate import compare_metadata
from app.core.config import engine
from app.models.models import Base
from app.models import calendar as calendar_models
from app.models import semester as semester_models

with engine.connect() as connection:
    context = MigrationContext.configure(
        connection,
        opts={"compare_type": True, "compare_server_default": True},
    )
    for difference in compare_metadata(context, Base.metadata):
        print(difference)
