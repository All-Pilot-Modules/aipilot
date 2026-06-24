from sqlalchemy import Column, String, Integer, ForeignKey, TIMESTAMP, Index, UniqueConstraint, Float, ForeignKeyConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database import Base
import uuid


class TestSubmission(Base):
    """
    Track test submissions separately from answers.
    Linked to student_enrollments(student_id, module_id) so a student can only
    submit if they are enrolled — enforced at the DB level.
    """
    __tablename__ = "test_submissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # student_id + module_id together FK → student_enrollments
    student_id = Column(String, nullable=False)
    module_id = Column(UUID(as_uuid=True), nullable=False)
    # null = whole-module submission (legacy / no-batch mode)
    batch_id = Column(UUID(as_uuid=True), ForeignKey("module_batches.id", ondelete="SET NULL"), nullable=True)

    # Attempt tracking (1, 2, etc.)
    attempt = Column(Integer, nullable=False)

    # Submission metadata
    submitted_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    questions_count = Column(Integer, nullable=False)

    # Score snapshot (mirrors student_module_grades; kept here for quick reads)
    total_points_possible = Column(Float, nullable=True)
    total_points_earned = Column(Float, nullable=True)
    percentage_score = Column(Float, nullable=True)   # 0–100

    __table_args__ = (
        # Enforce: student must be enrolled before they can submit
        ForeignKeyConstraint(
            ['student_id', 'module_id'],
            ['student_enrollments.student_id', 'student_enrollments.module_id'],
            name='fk_test_submission_enrollment',
            ondelete='RESTRICT',  # block enrollment deletion if submissions exist
        ),
        # Cascade if the module itself is deleted
        ForeignKeyConstraint(
            ['module_id'],
            ['modules.id'],
            name='fk_test_submission_module',
            ondelete='CASCADE',
        ),
        UniqueConstraint('student_id', 'module_id', 'attempt', name='uq_test_submission'),
        Index('ix_test_submission_lookup', 'student_id', 'module_id'),
        Index('ix_test_submission_module', 'module_id'),
    )
