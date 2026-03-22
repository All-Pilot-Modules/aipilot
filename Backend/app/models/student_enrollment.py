from sqlalchemy import Column, String, ForeignKey, TIMESTAMP, UniqueConstraint, Integer, Index
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
import uuid
from datetime import datetime


class ConsentStatus:
    """Consent status constants for students"""
    PENDING = None              # Not yet submitted
    AGREE_TO_RESEARCH = 1       # Agreed to participate in research
    NOT_AGREE = 2               # Did not agree to participate
    NOT_ELIGIBLE = 3            # Not eligible for research


class StudentEnrollment(Base):
    __tablename__ = "student_enrollments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(String, nullable=False)  # Banner ID - student identifier
    module_id = Column(UUID(as_uuid=True), ForeignKey("modules.id", ondelete="CASCADE"), nullable=False)

    enrolled_at = Column(TIMESTAMP, default=datetime.utcnow)
    access_code_used = Column(String, nullable=False)  # The access code used to join

    # Consent/Waiver status for research participation
    # 1=Agree to research, 2=Not agree, 3=Not eligible, NULL=Not yet submitted
    waiver_status = Column(Integer, nullable=True, default=None)
    consent_submitted_at = Column(TIMESTAMP, nullable=True)

    # Ensure a student can only be enrolled once per module
    __table_args__ = (
        UniqueConstraint('student_id', 'module_id', name='uix_student_module_enrollment'),
        # Fast lookup: "get all students in this module" (very frequent query)
        Index('ix_student_enrollments_module_id', 'module_id'),
        # Fast lookup: "get all modules this student is in"
        Index('ix_student_enrollments_student_id', 'student_id'),
    )