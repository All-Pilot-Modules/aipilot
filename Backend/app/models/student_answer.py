from sqlalchemy import Column, String, Integer, ForeignKey, TIMESTAMP, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base
import uuid
from datetime import datetime

class StudentAnswer(Base):
    __tablename__ = "student_answers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(String, nullable=False)  # Banner ID - no foreign key needed
    question_id = Column(UUID(as_uuid=True), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    module_id = Column(UUID(as_uuid=True), ForeignKey("modules.id", ondelete="CASCADE"), nullable=False)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=True)

    answer = Column(JSONB, nullable=False)  # Supports MCQ + text answers
    attempt = Column(Integer, nullable=False)  # 1 or 2
    submitted_at = Column(TIMESTAMP, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('student_id', 'question_id', 'attempt', name='uix_student_question_attempt'),
        Index('ix_student_answers_module_id', 'module_id'),
        Index('ix_student_answers_student_module', 'student_id', 'module_id'),
        Index('ix_student_answers_student_module_attempt', 'student_id', 'module_id', 'attempt'),
    )