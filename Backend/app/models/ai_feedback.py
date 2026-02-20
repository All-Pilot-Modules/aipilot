from sqlalchemy import Column, String, Integer, Boolean, ForeignKey, TIMESTAMP, Index, Text, Float
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base
import uuid
from datetime import datetime, timezone

class AIFeedback(Base):
    __tablename__ = "ai_feedback"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Link to student answer (single source of truth)
    answer_id = Column(UUID(as_uuid=True), ForeignKey("student_answers.id", ondelete="CASCADE"), nullable=False, unique=True)

    # Correctness (nullable to allow feedback without correct answer)
    is_correct = Column(Boolean, nullable=True)  # None when correct answer not set
    score = Column(Integer, nullable=True)  # 0-100, None when correct answer not set

    # Points tracking (for point-based grading)
    points_earned = Column(Float, nullable=True)     # Actual points earned (e.g., 7.5 out of 10)
    points_possible = Column(Float, nullable=True)   # Max points for this question

    # Rubric-based scoring
    criterion_scores = Column(JSONB, nullable=True)  # Per-criterion breakdown
    # Format: {"accuracy": {"score": 34, "out_of": 40, "reasoning": "..."}, ...}

    confidence_level = Column(String(20), nullable=True)  # "high", "medium", "low"

    # Feedback content (stored as JSONB for flexibility)
    # NULLABLE: Will be None during generation, populated when complete
    feedback_data = Column(JSONB, nullable=True)  # Contains explanation, hints, strengths, weaknesses, etc.

    # Generation status tracking (NEW - for real-time feedback generation monitoring)
    # Default 'completed' ensures existing feedback rows work without migration
    generation_status = Column(String(20), nullable=False, default='completed', server_default='completed')
    # Possible values: 'pending', 'generating', 'completed', 'failed', 'timeout'

    generation_progress = Column(Integer, nullable=False, default=100, server_default='100')  # 0-100%

    # Error tracking
    error_message = Column(String, nullable=True)  # Error description if generation failed
    error_type = Column(String(50), nullable=True)  # 'timeout', 'api_error', 'parse_error', 'network_error'

    # Retry management
    retry_count = Column(Integer, nullable=False, default=0, server_default='0')
    max_retries = Column(Integer, nullable=False, default=3, server_default='3')
    can_retry = Column(Boolean, nullable=False, default=False, server_default='false')

    # Timeout configuration
    timeout_seconds = Column(Integer, nullable=False, default=45, server_default='45')

    # Performance tracking
    generation_duration = Column(Integer, nullable=True)  # Seconds taken to generate
    ai_model_used = Column(String(50), nullable=True)  # Track which AI model was used

    # Timestamp
    generated_at = Column(TIMESTAMP, default=lambda: datetime.now(timezone.utc))
    started_at = Column(TIMESTAMP, nullable=True)  # When generation started
    completed_at = Column(TIMESTAMP, nullable=True)  # When generation completed/failed

    __table_args__ = (
        Index('ix_ai_feedback_answer_id', 'answer_id'),
        Index('ix_ai_feedback_generated_at', 'generated_at'),
    )
