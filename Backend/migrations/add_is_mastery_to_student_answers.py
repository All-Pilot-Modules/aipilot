"""
Migration: add is_mastery column to student_answers.

Mastery practice answers must never appear in the test feedback tab.
After this migration, mastery_submit_answer marks answers with is_mastery=True
before deleting them (belt-and-suspenders).  If deletion ever fails silently,
the feedback endpoint filters them out via  WHERE is_mastery = FALSE.

This migration also deletes old mastery answers that were saved before the
delete-fix was applied.  It identifies them by cross-referencing question_queue:
any student_answer whose (student_id, module_id, question_id) matches a
question_queue row AND for which no test_submission exists for that
student+module+attempt is treated as a stale mastery answer.

Usage:
    cd Backend
    python migrations/add_is_mastery_to_student_answers.py
    python migrations/add_is_mastery_to_student_answers.py down   # drops column (no data preserved)
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import engine
from sqlalchemy import text


def upgrade():
    print("Step 1 — adding is_mastery column to student_answers...")
    with engine.connect() as conn:
        conn.execute(text("""
            ALTER TABLE student_answers
            ADD COLUMN IF NOT EXISTS is_mastery BOOLEAN NOT NULL DEFAULT FALSE
        """))
        conn.commit()
    print("  ✅ Column added (default=FALSE for all existing rows)")

    print("Step 2 — deleting stale mastery answers (pre-fix)...")
    with engine.connect() as conn:
        result = conn.execute(text("""
            DELETE FROM student_answers
            WHERE id IN (
                SELECT sa.id
                FROM student_answers sa
                JOIN question_queue qq
                    ON  qq.student_id  = sa.student_id
                    AND qq.module_id   = sa.module_id
                    AND qq.question_id = sa.question_id
                LEFT JOIN test_submissions ts
                    ON  ts.student_id = sa.student_id
                    AND ts.module_id  = sa.module_id
                    AND ts.attempt    = sa.attempt
                WHERE ts.id IS NULL
            )
        """))
        conn.commit()
        deleted = result.rowcount
    print(f"  ✅ Deleted {deleted} stale mastery answer(s) (cascade removes associated ai_feedback)")
    print("\nDone.")


def downgrade():
    print("Dropping is_mastery column from student_answers...")
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE student_answers DROP COLUMN IF EXISTS is_mastery"))
        conn.commit()
    print("✅ Done")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "down":
        downgrade()
    else:
        upgrade()
