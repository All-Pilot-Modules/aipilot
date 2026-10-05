"""add job timing columns and error_category; make worker_lock releasable

Revision ID: c3b7f0a1d5e9
Revises: 41958e8223a0
Create Date: 2026-10-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c3b7f0a1d5e9'
down_revision: Union[str, Sequence[str], None] = '41958e8223a0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Separates "time spent waiting for a worker slot" from "time spent in
    # the actual AI call" — generation_started_at is stamped right before the
    # OpenAI request, so (generation_started_at - created_at) is queue wait
    # and (completed_at - generation_started_at) is generation time.
    op.add_column('feedback_jobs', sa.Column('generation_started_at', sa.TIMESTAMP(timezone=True), nullable=True))

    # Sanitized bucket (timeout / rate_limit / auth / parsing / connection /
    # data_error / unknown) derived from the raw error_type, so failures can
    # be aggregated without parsing free-text error_message.
    op.add_column('feedback_jobs', sa.Column('error_category', sa.String(length=30), nullable=True))

    # Let a leader release its row on clean shutdown (instance_id = NULL)
    # instead of leaving a fresh-looking heartbeat that forces the next
    # leader to wait out the full staleness window.
    op.alter_column('worker_lock', 'instance_id', existing_type=sa.String(), nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('worker_lock', 'instance_id', existing_type=sa.String(), nullable=False)
    op.drop_column('feedback_jobs', 'error_category')
    op.drop_column('feedback_jobs', 'generation_started_at')
