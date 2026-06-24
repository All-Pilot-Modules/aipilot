from sqlalchemy import Column, String, TIMESTAMP, ForeignKey, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
import uuid
from datetime import datetime, timezone


class EnrollmentClaim(Base):
    __tablename__ = "enrollment_claims"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id     = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    banner_id   = Column(String, nullable=False)
    module_id   = Column(UUID(as_uuid=True), ForeignKey("modules.id", ondelete="CASCADE"), nullable=False)
    access_code = Column(String, nullable=False)

    # pending | approved | denied
    status      = Column(String, nullable=False, default="pending")

    created_at  = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc))
    reviewed_at = Column(TIMESTAMP(timezone=True), nullable=True)
    reviewed_by = Column(String, ForeignKey("users.id"), nullable=True)

    __table_args__ = (
        # One pending claim per student per module at a time
        UniqueConstraint("user_id", "module_id", name="uix_claim_user_module"),
        Index("ix_enrollment_claims_user_id",   "user_id"),
        Index("ix_enrollment_claims_module_id",  "module_id"),
        Index("ix_enrollment_claims_status",     "status"),
    )
