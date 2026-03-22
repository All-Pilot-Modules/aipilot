"""
DocumentEmbedding model for storing vector embeddings of document chunks
Uses pgvector for similarity search
"""
from sqlalchemy import Column, String, Integer, ForeignKey, TIMESTAMP, Text, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
from datetime import datetime
import uuid

from app.database import Base


class DocumentEmbedding(Base):
    """
    Stores vector embeddings for document chunks
    Each chunk gets one embedding vector for RAG retrieval
    """
    __tablename__ = "document_embeddings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chunk_id = Column(UUID(as_uuid=True), ForeignKey("document_chunks.id", ondelete="CASCADE"), nullable=False)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)

    # Vector embedding using pgvector — OpenAI text-embedding-ada-002 produces 1536 dimensions
    embedding_vector = Column(Vector(1536), nullable=False)

    # Metadata
    embedding_model = Column(String, nullable=False, default="text-embedding-ada-002")
    embedding_dimensions = Column(Integer, nullable=False, default=1536)
    token_count = Column(Integer)  # Tokens used for this embedding

    created_at = Column(TIMESTAMP, default=datetime.utcnow)

    __table_args__ = (
        # HNSW index for fast approximate nearest neighbour cosine search
        Index(
            "ix_document_embeddings_vector_hnsw",
            embedding_vector,
            postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 64},
            postgresql_ops={"embedding_vector": "vector_cosine_ops"},
        ),
        # Index to quickly fetch all embeddings for a document
        Index("ix_document_embeddings_document_id", "document_id"),
    )

    def __repr__(self):
        return f"<DocumentEmbedding(id={self.id}, chunk_id={self.chunk_id}, model={self.embedding_model})>"
