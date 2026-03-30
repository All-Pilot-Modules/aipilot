from sqlalchemy import Column, String, Integer, Boolean, TIMESTAMP, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
import uuid
from datetime import datetime


class QuestionQueue(Base):
    __tablename__ = "question_queue"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(String, nullable=False)  # Banner ID — no FK to users
    module_id = Column(UUID(as_uuid=True), ForeignKey("modules.id"), nullable=False)
    question_id = Column(UUID(as_uuid=True), ForeignKey("questions.id"), nullable=False)
    position = Column(Integer, nullable=False)
    attempts = Column(Integer, default=0)
    is_mastered = Column(Boolean, default=False)
    streak_count = Column(Integer, default=0)
    last_attempt_at = Column(TIMESTAMP, nullable=True)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)