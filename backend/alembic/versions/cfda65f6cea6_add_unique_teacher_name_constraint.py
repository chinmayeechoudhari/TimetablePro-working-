"""add unique teacher name constraint

Revision ID: cfda65f6cea6
Revises: 620d2b422b19
Create Date: 2026-08-10 20:10:37.935813

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cfda65f6cea6'
down_revision: Union[str, Sequence[str], None] = '620d2b422b19'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
