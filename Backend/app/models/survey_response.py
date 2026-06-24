from sqlalchemy import Column, String, ForeignKey, TIMESTAMP, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base
import uuid
from datetime import datetime, timezone


class SurveyResponse(Base):
    __tablename__ = "survey_responses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(String, nullable=False)  # Banner ID - student identifier
    module_id = Column(UUID(as_uuid=True), ForeignKey("modules.id", ondelete="CASCADE"), nullable=False)

    # Survey responses stored as JSONB: {"q1": "answer text", "q2": "answer text", ...}
    responses = Column(JSONB, nullable=False, default={})

    submitted_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Ensure a student can only submit one survey response per module
    __table_args__ = (
        UniqueConstraint('student_id', 'module_id', name='uix_student_module_survey'),
    )
