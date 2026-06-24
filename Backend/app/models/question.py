from sqlalchemy import Column, String, Integer, Boolean, ForeignKey, Text, Index, TIMESTAMP, Float
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base
import uuid
from datetime import datetime


class QuestionStatus:
    """Question status constants for the review workflow"""
    UNREVIEWED = "unreviewed"  # AI-generated, pending teacher review
    ACTIVE = "active"          # Approved by teacher, visible to students
    ARCHIVED = "archived"      # Hidden but not deleted


class QuestionType:
    """Question type constants"""
    MCQ = "mcq"                    # Single correct answer MCQ
    SHORT = "short"                # Short answer (1-2 sentences)
    LONG = "long"                  # Long answer (essay)
    MCQ_MULTIPLE = "mcq_multiple"  # Multiple correct answers MCQ
    FILL_BLANK = "fill_blank"      # Fill in the blanks
    MULTI_PART = "multi_part"      # Multi-part questions (1a, 1b, 1c)


class Question(Base):
    __tablename__ = "questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    module_id = Column(UUID(as_uuid=True), ForeignKey("modules.id", ondelete="CASCADE"), nullable=False)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=True)
    # null = unassigned (lives in module pool); set when teacher assigns to a batch
    batch_id = Column(UUID(as_uuid=True), ForeignKey("module_batches.id", ondelete="SET NULL"), nullable=True)

    # null = inherit from batch (which inherits from module)
    # "visible" | "teacher_only" | "disabled"
    grading_mode = Column(String, nullable=True)

    type = Column(String, nullable=False)  # mcq, short, long
    text = Column(Text, nullable=False)
    slide_number = Column(Integer, nullable=True)
    question_order = Column(Integer, nullable=True)  # Order/position of question in the module

    options = Column(JSONB, nullable=True)  # Only for MCQs - format: {"A": "Apple", "B": "Ball"}
    correct_answer = Column(String, nullable=True)  # Legacy field - kept for backward compatibility
    correct_option_id = Column(String, nullable=True)  # New field - stores "A", "B", "C", "D" for MCQs

    # Extended configuration for new question types
    extended_config = Column(JSONB, nullable=True)
    # For mcq_multiple: {"correct_option_ids": ["A", "B"], "partial_credit": true}
    # For fill_blank: {"blanks": [{"position": 0, "correct_answers": ["answer1", "answer2"], "points": 5}]}
    # For multi_part: {"sub_questions": [{"id": "1a", "type": "mcq", "text": "...", "options": {...}, ...}]}

    learning_outcome = Column(String, nullable=True)
    bloom_taxonomy = Column(String, nullable=True)
    image_url = Column(String, nullable=True)

    has_text_input = Column(Boolean, default=False)

    # Points for this question
    points = Column(Float, default=1.0, nullable=False)

    # Feedback Critique Settings
    allow_critique = Column(Boolean, default=False, nullable=False)  # Allow students to critique AI feedback

    # AI Generation and Review Workflow Fields
    status = Column(String, default=QuestionStatus.ACTIVE, nullable=False)
    is_ai_generated = Column(Boolean, default=False, nullable=False)
    generated_at = Column(TIMESTAMP, nullable=True)

    __table_args__ = (
        Index('ix_questions_module_id', 'module_id'),
        Index('ix_questions_document_id', 'document_id'),
        Index('ix_questions_batch_id', 'batch_id'),
        Index('ix_questions_status', 'status'),
        Index('ix_questions_module_status', 'module_id', 'status'),
    )