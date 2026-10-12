"""Private, evidence-linked AI learning journal and durable generation state."""
import uuid
from sqlalchemy import Column, String, Integer, ForeignKey, TIMESTAMP, Text, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base


class LearningMemory(Base):
    __tablename__ = 'learning_memories'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    submission_id = Column(UUID(as_uuid=True), ForeignKey('test_submissions.id', ondelete='CASCADE'), nullable=False, unique=True)
    module_id = Column(UUID(as_uuid=True), ForeignKey('modules.id', ondelete='CASCADE'), nullable=False)
    student_id = Column(String, nullable=False)
    attempt = Column(Integer, nullable=False)
    status = Column(String, nullable=False, default='processing')
    observations = Column(JSONB, nullable=True)
    source_answer_ids = Column(JSONB, nullable=False, default=list)
    retry_count = Column(Integer, nullable=False, default=0)
    lease_token = Column(UUID(as_uuid=True), nullable=True)
    available_at = Column(TIMESTAMP(timezone=True), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False)
    error = Column(Text, nullable=True)
    __table_args__ = (Index('ix_learning_memory_student_module', 'module_id', 'student_id', 'created_at'),)
