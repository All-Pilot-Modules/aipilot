from sqlalchemy import Column, String, Integer, ForeignKey, Text, TIMESTAMP, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base
import uuid
from datetime import datetime, timezone

from app.models.module import DEFAULT_BATCH_SETTINGS


class ModuleBatch(Base):
    """
    A named phase inside a module: Practice → Quiz → Exam etc.
    All batches in a module share the same document/question pool.
    Each batch inherits parent module settings and overrides what it needs.
    """
    __tablename__ = "module_batches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    module_id = Column(UUID(as_uuid=True), ForeignKey("modules.id", ondelete="CASCADE"), nullable=False)

    # ── Identity ───────────────────────────────────────────────────────────────
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    instructions = Column(Text, nullable=True)

    # ── Type & order ───────────────────────────────────────────────────────────
    # "practice" | "quiz" | "exam" | "review"
    batch_type = Column(String, nullable=False, default="practice", server_default="practice")
    batch_order = Column(Integer, nullable=False, default=1)

    # ── Lifecycle ──────────────────────────────────────────────────────────────
    # "draft" | "active" | "locked"
    status = Column(String, nullable=False, default="draft", server_default="draft")
    due_date = Column(TIMESTAMP(timezone=True), nullable=True)

    # ── Grading overrides (null = inherit from module) ─────────────────────────
    # "visible" | "teacher_only" | "disabled" | null
    ai_grading_mode = Column(String, nullable=True)
    max_attempts = Column(Integer, nullable=True)

    # ── Prerequisite ──────────────────────────────────────────────────────────
    # Student must submit this batch before the current one unlocks
    unlock_after_batch_id = Column(
        UUID(as_uuid=True),
        ForeignKey("module_batches.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ── All other batch-level config ───────────────────────────────────────────
    # Shape defined by DEFAULT_BATCH_SETTINGS in module.py.
    # Null values in here mean "inherit from parent module settings".
    settings = Column(JSONB, nullable=False, default=DEFAULT_BATCH_SETTINGS)

    created_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("ix_module_batches_module_id", "module_id"),
        Index("ix_module_batches_module_order", "module_id", "batch_order"),
    )
