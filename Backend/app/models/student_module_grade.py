from sqlalchemy import Column, String, Integer, Float, Boolean, ForeignKey, TIMESTAMP, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database import Base
import uuid


def compute_letter_grade(percentage: float) -> str:
    if percentage >= 93: return "A"
    if percentage >= 90: return "A-"
    if percentage >= 87: return "B+"
    if percentage >= 83: return "B"
    if percentage >= 80: return "B-"
    if percentage >= 77: return "C+"
    if percentage >= 73: return "C"
    if percentage >= 70: return "C-"
    if percentage >= 67: return "D+"
    if percentage >= 60: return "D"
    return "F"


class StudentModuleGrade(Base):
    """
    Aggregate gradebook row per student per module per attempt.
    Recomputed whenever an answer_grade is created or updated.
    This is what the teacher's gradebook view reads — one row per student.
    """
    __tablename__ = "student_module_grades"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    student_id = Column(String, nullable=False)
    module_id = Column(UUID(as_uuid=True), ForeignKey("modules.id", ondelete="CASCADE"), nullable=False)
    attempt = Column(Integer, nullable=False, default=1)

    # Aggregate score
    total_points_earned = Column(Float, nullable=False, default=0.0)
    total_points_possible = Column(Float, nullable=False, default=0.0)
    percentage_score = Column(Float, nullable=False, default=0.0)   # 0–100
    letter_grade = Column(String(5), nullable=True)                 # A, B+, C-, F …

    # Completion
    questions_graded = Column(Integer, nullable=False, default=0)   # answers with a grade
    questions_total = Column(Integer, nullable=False, default=0)    # all questions in module
    is_complete = Column(Boolean, nullable=False, default=False)    # all questions graded

    # Grading provenance
    # 'ai'     — all scores from AI
    # 'teacher'— all scores from teacher
    # 'mixed'  — some AI, some teacher
    # 'pending'— no scores yet
    grade_source = Column(String(20), nullable=False, default="pending")

    # Finalization (teacher signs off on the whole submission)
    is_finalized = Column(Boolean, nullable=False, default=False)
    finalized_at = Column(TIMESTAMP(timezone=True), nullable=True)
    finalized_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        # One row per student per module per attempt
        UniqueConstraint("student_id", "module_id", "attempt", name="uix_smg_student_module_attempt"),
        Index("ix_smg_module_id", "module_id"),
        Index("ix_smg_student_id", "student_id"),
        # Teacher gradebook: "show all students in module X, attempt 1, sorted by score"
        Index("ix_smg_module_attempt_score", "module_id", "attempt", "percentage_score"),
        Index("ix_smg_finalized", "module_id", "is_finalized"),
    )
