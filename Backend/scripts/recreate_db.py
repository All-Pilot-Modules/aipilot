#!/usr/bin/env python3
"""
Script to drop and recreate all database tables with the current schema.
This will DELETE all existing data!
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import engine, Base

# Import every model so SQLAlchemy registers them in Base.metadata  # noqa: F401
from app.models import (  # noqa: F401
    user, document, question, module, student_answer, student_enrollment,
    survey_response, question_queue, document_chunk, document_embedding,
    ai_feedback, chat_conversation, chat_message, enrollment_claim,
    feedback_job, teacher_grade, feedback_critique,
    answer_grade, student_module_grade,
    module_batch,
    module_collaborator,
)

print("⚠️  WARNING: This will DELETE all data in the database!")
print("Dropping all tables...")

Base.metadata.drop_all(engine)
print("✅ All tables dropped")

print("\nCreating tables with new schema...")

Base.metadata.create_all(engine)
print("✅ All tables created with new schema")

print("\n🎉 Database recreation complete!")
