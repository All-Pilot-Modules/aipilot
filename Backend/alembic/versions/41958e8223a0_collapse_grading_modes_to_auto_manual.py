"""collapse grading modes to auto/manual

Revision ID: 41958e8223a0
Revises: 8fdabc833357
Create Date: 2026-08-11 00:00:00.000000

Data-only migration: the 4-way ai_grading_mode enum ("auto" | "teacher_assist" |
"teacher_only" | "disabled") is collapsed to 2 values ("auto" | "manual").
"teacher_assist" and "teacher_only" both become "manual" (gated, teacher review
and release — the permanent "hidden from student forever" behavior of
"teacher_only" is intentionally dropped). "disabled" (AI never grades) also
becomes "manual" (AI now always grades; teacher can still fully overwrite the
grade before releasing).

Also backfills the ai_config.grading.mode and assignment_config.grading.mode
JSONB mirrors on modules so previously-saved settings-page state doesn't show a
retired value on next load, and the (unused-in-gating) module_batches override.
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '41958e8223a0'
down_revision: Union[str, Sequence[str], None] = '8fdabc833357'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("""
        UPDATE modules
        SET ai_grading_mode = CASE
            WHEN ai_grading_mode IN ('teacher_assist', 'teacher_only', 'disabled') THEN 'manual'
            WHEN ai_grading_mode IS NULL OR ai_grading_mode NOT IN ('auto', 'manual') THEN 'auto'
            ELSE ai_grading_mode
        END
    """)
    op.execute("""
        UPDATE modules
        SET ai_config = jsonb_set(COALESCE(ai_config, '{}'::jsonb), '{grading,mode}', to_jsonb(ai_grading_mode))
        WHERE ai_config #>> '{grading,mode}' IN ('teacher_assist', 'teacher_only', 'disabled')
    """)
    op.execute("""
        UPDATE modules
        SET assignment_config = jsonb_set(COALESCE(assignment_config, '{}'::jsonb), '{grading,mode}', '"auto"'::jsonb)
        WHERE assignment_config #>> '{grading,mode}' = 'ai_visible'
    """)
    op.execute("""
        UPDATE modules
        SET assignment_config = jsonb_set(COALESCE(assignment_config, '{}'::jsonb), '{grading,mode}', '"manual"'::jsonb)
        WHERE assignment_config #>> '{grading,mode}' IN ('teacher_assist', 'ai_teacher_only', 'manual')
    """)
    op.execute("""
        UPDATE module_batches
        SET ai_grading_mode = CASE
            WHEN ai_grading_mode = 'visible' THEN 'auto'
            WHEN ai_grading_mode IN ('teacher_only', 'disabled') THEN 'manual'
            ELSE ai_grading_mode
        END
        WHERE ai_grading_mode IS NOT NULL
    """)


def downgrade() -> None:
    """Downgrade schema."""
    # The original 4-way distinction is genuinely lost once collapsed — there is
    # no way to tell "manual" apart from what used to be teacher_assist /
    # teacher_only / disabled. No-op, matching the empty baseline migration.
    pass
