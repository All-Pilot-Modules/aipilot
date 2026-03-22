from sqlalchemy import Column, String, Integer, Boolean, ForeignKey, TIMESTAMP, Index, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from app.database import Base
import uuid
from datetime import datetime, timezone


class FeedbackJob(Base):
    """
    Persistent job queue for feedback generation.
    Every feedback request is written here BEFORE processing begins.
    If the server crashes, workers pick up pending jobs on restart.
    """
    __tablename__ = "feedback_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # What to generate feedback for
    answer_id = Column(UUID(as_uuid=True), ForeignKey("student_answers.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(String, nullable=False)
    module_id = Column(UUID(as_uuid=True), nullable=False)
    attempt = Column(Integer, nullable=False)

    # True when this is the student's last allowed attempt.
    # Worker will set ai_feedback.released=False after generation so teacher reviews first.
    is_final_attempt = Column(Boolean, nullable=False, default=False, server_default='false')

    # Job lifecycle: queued -> processing -> done / retry / failed
    status = Column(String(20), nullable=False, default='queued', server_default='queued')

    # 1=urgent (student waiting), 2=normal, 3=background-upgrade
    priority = Column(Integer, nullable=False, default=1, server_default='1')

    # Retry management
    retry_count = Column(Integer, nullable=False, default=0, server_default='0')
    max_retries = Column(Integer, nullable=False, default=5, server_default='5')

    # Worker lock — prevents double-processing
    locked_at = Column(TIMESTAMP(timezone=True), nullable=True)

    # Error tracking
    error_message = Column(Text, nullable=True)

    # Optional context for progressive feedback
    previous_feedback_json = Column(JSONB, nullable=True)

    # Timestamps
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(TIMESTAMP(timezone=True), nullable=True)

    __table_args__ = (
        Index('ix_feedback_jobs_status_priority', 'status', 'priority', 'created_at'),
        Index('ix_feedback_jobs_answer_id', 'answer_id'),
        Index('ix_feedback_jobs_student_module', 'student_id', 'module_id', 'attempt'),
    )
