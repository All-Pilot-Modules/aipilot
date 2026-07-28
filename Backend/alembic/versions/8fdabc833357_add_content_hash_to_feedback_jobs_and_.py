"""add content_hash to feedback_jobs and ai_feedback

Revision ID: 8fdabc833357
Revises: e7f3a9c1b2d8
Create Date: 2026-07-23 15:43:53.743533

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '8fdabc833357'
down_revision: Union[str, Sequence[str], None] = 'e7f3a9c1b2d8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('ai_feedback', sa.Column('content_hash', sa.String(length=64), nullable=True))
    op.add_column('feedback_jobs', sa.Column('content_hash', sa.String(length=64), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('feedback_jobs', 'content_hash')
    op.drop_column('ai_feedback', 'content_hash')
