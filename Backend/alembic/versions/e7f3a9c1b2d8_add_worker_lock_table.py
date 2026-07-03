"""add worker_lock table for feedback worker leader election

Revision ID: e7f3a9c1b2d8
Revises: a4ce0a1c6e22
Create Date: 2026-07-02

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'e7f3a9c1b2d8'
down_revision: Union[str, Sequence[str], None] = 'a4ce0a1c6e22'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'worker_lock',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('instance_id', sa.String(), nullable=False),
        sa.Column('heartbeat', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('acquired_at', sa.TIMESTAMP(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('worker_lock')
