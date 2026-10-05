"""add available_at for scheduled retry backoff; enforce one active job per answer

Revision ID: f1a9c4e2b6d3
Revises: c3b7f0a1d5e9
Create Date: 2026-10-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f1a9c4e2b6d3'
down_revision: Union[str, Sequence[str], None] = 'c3b7f0a1d5e9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # NULL = immediately claimable. On retry we set this to NOW() + backoff
    # instead of blocking the worker thread with time.sleep(), so a retrying
    # job actually waits before becoming visible to _claim_next_jobs again.
    op.add_column('feedback_jobs', sa.Column('available_at', sa.TIMESTAMP(timezone=True), nullable=True))

    # At most one active (queued/processing) job per answer at a time —
    # closes the race between submit-test's bump-vs-create check, the
    # speculative autosave job, and feedback-status's auto-retry all
    # inserting concurrently for the same answer.
    op.create_index(
        'ux_feedback_jobs_answer_active',
        'feedback_jobs',
        ['answer_id'],
        unique=True,
        postgresql_where=sa.text("status IN ('queued', 'processing')"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ux_feedback_jobs_answer_active', table_name='feedback_jobs')
    op.drop_column('feedback_jobs', 'available_at')
