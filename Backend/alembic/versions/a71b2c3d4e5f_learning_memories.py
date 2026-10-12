"""Private student learning journal and resumable generation state."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg
revision = 'a71b2c3d4e5f'
down_revision = 'f1a9c4e2b6d3'
branch_labels = depends_on = None


def upgrade():
    op.create_table('learning_memories',
        sa.Column('id', pg.UUID(as_uuid=True), primary_key=True),
        sa.Column('submission_id', pg.UUID(as_uuid=True), sa.ForeignKey('test_submissions.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('module_id', pg.UUID(as_uuid=True), sa.ForeignKey('modules.id', ondelete='CASCADE'), nullable=False),
        sa.Column('student_id', sa.String(), nullable=False),
        sa.Column('attempt', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('observations', pg.JSONB()),
        sa.Column('source_answer_ids', pg.JSONB(), nullable=False),
        sa.Column('retry_count', sa.Integer(), nullable=False),
        sa.Column('lease_token', pg.UUID(as_uuid=True)),
        sa.Column('available_at', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('error', sa.Text()))
    op.create_index('ix_learning_memory_student_module', 'learning_memories', ['module_id', 'student_id', 'created_at'])
    # Backend-only table. Browser Supabase roles receive no direct access.
    op.execute('ALTER TABLE learning_memories ENABLE ROW LEVEL SECURITY')
    op.execute('REVOKE ALL ON learning_memories FROM anon, authenticated')


def downgrade():
    op.drop_table('learning_memories')
