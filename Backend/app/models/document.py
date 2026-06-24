from sqlalchemy import Boolean, Column, String, Integer, TIMESTAMP, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base
import uuid
from datetime import datetime, timezone


class ProcessingStatus:
    """Document processing status constants"""
    UPLOADED = "uploaded"           # File uploaded to storage
    EXTRACTING = "extracting"       # Extracting text from file
    EXTRACTED = "extracted"         # Text extraction complete
    CHUNKING = "chunking"           # Splitting text into chunks
    CHUNKED = "chunked"             # Chunking complete
    EMBEDDING = "embedding"         # Generating embeddings
    EMBEDDED = "embedded"           # Embeddings generated
    INDEXED = "indexed"             # Ready for RAG retrieval
    FAILED = "failed"               # Processing failed

    # Testbank specific
    PARSING = "parsing"             # Parsing testbank questions
    PARSED = "parsed"               # Testbank parsing complete


class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    file_name = Column(String, nullable=False)
    file_hash = Column(String, nullable=False)  # SHA256 hash for duplicate detection
    file_type = Column(String, nullable=False)  # e.g., pdf, pptx, docx

    teacher_id = Column(String, ForeignKey("users.id"), nullable=False)

    # 🔗 Replaces `module_name`
    module_id = Column(UUID(as_uuid=True), ForeignKey("modules.id"), nullable=False)

    storage_path = Column(String, nullable=False)
    index_path = Column(String, nullable=True)
    slide_count = Column(Integer, nullable=True)

    # ✨ NEW: RAG Processing Status
    processing_status = Column(String, default=ProcessingStatus.UPLOADED, nullable=False)
    processing_metadata = Column(JSONB, default={})  # Store: chunk_count, embedding_model, error_msg, timestamps, etc.

    # Legacy testbank parsing fields (kept for backward compatibility)
    parse_status = Column(String, nullable=True)  # 'pending', 'success', 'failed'
    parse_error = Column(String, nullable=True)
    is_testbank = Column(Boolean, default=False)

    uploaded_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint('teacher_id', 'file_hash', 'module_id', name='uix_teacher_filehash'),
    )