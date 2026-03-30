"""
Migration: fix question_queue student_id foreign key.

The original question_queue model had student_id with ForeignKey("users.id"),
but students use Banner IDs that are not in the users table.
This migration drops and recreates the table with student_id as a plain String.

Usage:
    cd Backend
    python migrations/fix_question_queue_student_fk.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import engine, Base
from app.models.question_queue import QuestionQueue
from sqlalchemy import text


def upgrade():
    print("Fixing question_queue table (dropping FK on student_id)...")

    with engine.connect() as conn:
        # Drop the old table (no data to preserve — it's a fresh feature)
        conn.execute(text("DROP TABLE IF EXISTS question_queue CASCADE"))
        conn.commit()
        print("  ✅ Old table dropped")

    # Recreate with corrected schema (student_id is plain String, no FK)
    Base.metadata.create_all(bind=engine, tables=[QuestionQueue.__table__])
    print("  ✅ Table recreated without FK constraint")
    print("\nNew schema:")
    print("  - student_id: String (Banner ID, no FK to users)")
    print("  - module_id:  UUID FK → modules")
    print("  - question_id: UUID FK → questions")
    print("  - streak_count, is_mastered, position, attempts, timestamps")


def downgrade():
    print("Dropping question_queue table...")
    with engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS question_queue CASCADE"))
        conn.commit()
    print("✅ Dropped")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "down":
        downgrade()
    else:
        upgrade()
