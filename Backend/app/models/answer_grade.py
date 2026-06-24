from sqlalchemy import Column, String, Integer, Float, Boolean, ForeignKey, TIMESTAMP, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.database import Base
import uuid


class GradeSource:
    PENDING = "pending"    # AI not yet run, no teacher grade
    AI = "ai"              # Score came from AI feedback
    TEACHER = "teacher"    # Teacher overrode the AI score
    AUTO = "auto"          # Auto-graded (MCQ exact match)


class AnswerGrade(Base):
    """
    Single source of truth for the final resolved grade on a student answer.
    Created when AI feedback completes; updated if a teacher overrides.
    Avoids JOINing ai_feedback + teacher_grades on every dashboard/gradebook load.
    """
    __tablename__ = "answer_grades"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Core links
    answer_id = Column(
        UUID(as_uuid=True),
        ForeignKey("student_answers.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )

    # Denormalized for fast queries (avoids JOIN back to student_answers)
    student_id = Column(String, nullable=False)
    question_id = Column(UUID(as_uuid=True), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    module_id = Column(UUID(as_uuid=True), ForeignKey("modules.id", ondelete="CASCADE"), nullable=False)
    attempt = Column(Integer, nullable=False)

    # Final resolved score — this is what the gradebook reads
    score = Column(Float, nullable=True)            # 0–100 percentage
    points_earned = Column(Float, nullable=True)    # e.g. 7.5
    points_possible = Column(Float, nullable=True)  # e.g. 10.0

    # Where the current score came from
    grade_source = Column(String(20), nullable=False, default=GradeSource.PENDING)

    # Rubric breakdown (mirrors ai_feedback.criterion_scores or teacher override)
    criterion_scores = Column(JSONB, nullable=True)
    # {"accuracy": {"score": 34, "out_of": 40, "reasoning": "..."}, ...}

    # AI score snapshot (preserved even after teacher override, useful for analytics)
    ai_score = Column(Float, nullable=True)
    ai_points_earned = Column(Float, nullable=True)

    # Teacher override fields (populated when grade_source = 'teacher')
    graded_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    graded_at = Column(TIMESTAMP(timezone=True), nullable=True)
    teacher_feedback = Column(String, nullable=True)

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_answer_grades_student_id", "student_id"),
        Index("ix_answer_grades_module_id", "module_id"),
        Index("ix_answer_grades_student_module", "student_id", "module_id"),
        Index("ix_answer_grades_student_module_attempt", "student_id", "module_id", "attempt"),
        Index("ix_answer_grades_grade_source", "grade_source"),
    )
