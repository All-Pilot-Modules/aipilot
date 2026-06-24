from sqlalchemy import Column, String, ForeignKey, TIMESTAMP, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
import uuid
from datetime import datetime, timezone


class ModuleCollaborator(Base):
    """
    Junction table: teachers/users who can co-manage a module.

    Roles:
      owner      — the creator (maps to modules.teacher_id); full control
      co_teacher — can edit questions, manage batches, grade students
      viewer     — read-only access to analytics and submissions
    """
    __tablename__ = "module_collaborators"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    module_id = Column(UUID(as_uuid=True), ForeignKey("modules.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # "owner" | "co_teacher" | "viewer"
    role = Column(String, nullable=False, default="co_teacher", server_default="co_teacher")

    added_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("module_id", "user_id", name="uix_module_collaborator"),
        Index("ix_module_collaborators_module_id", "module_id"),
        Index("ix_module_collaborators_user_id", "user_id"),
    )
