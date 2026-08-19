"""enforce unique room numbers

Revision ID: 2cc0f788cb1b
Revises: cfda65f6cea6
Create Date: 2026-08-10 20:30:38.555285

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2cc0f788cb1b'
down_revision: Union[str, Sequence[str], None] = 'cfda65f6cea6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade():
    op.execute(
        """
        CREATE UNIQUE INDEX uq_room_room_number_lower
        ON room (LOWER(TRIM(room_number)));
        """
    )


def downgrade():
    op.execute(
        """
        DROP INDEX IF EXISTS uq_room_room_number_lower;
        """
    )