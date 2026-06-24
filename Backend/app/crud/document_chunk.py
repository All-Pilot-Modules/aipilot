"""
CRUD operations for document chunks
"""
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from uuid import UUID
from app.models.document_chunk import DocumentChunk


def create_chunk(
    db: Session,
    document_id: str,
    chunk_index: int,
    chunk_text: str,
    chunk_metadata: Optional[Dict[str, Any]] = None,
    module_id: Optional[str] = None
) -> DocumentChunk:
    """
    Create a new document chunk

    Args:
        db: Database session
        document_id: UUID of parent document
        chunk_index: Order of this chunk in the document
        chunk_text: The text content
        chunk_metadata: Additional metadata (page_num, section, etc.)
        module_id: UUID of parent module

    Returns:
        Created DocumentChunk object
    """
    chunk = DocumentChunk(
        document_id=document_id,
        module_id=module_id,
        chunk_index=chunk_index,
        chunk_text=chunk_text,
        chunk_size=len(chunk_text),
        chunk_metadata=chunk_metadata or {}
    )
    db.add(chunk)
    db.commit()
    db.refresh(chunk)
    return chunk


def bulk_create_chunks(
    db: Session,
    document_id: str,
    chunks: List[Dict[str, Any]],
    module_id: Optional[str] = None
) -> List[DocumentChunk]:
    """
    Create multiple chunks at once (more efficient)

    Args:
        db: Database session
        document_id: UUID of parent document
        chunks: List of dicts with 'text', 'index', 'chunk_metadata'
        module_id: UUID of parent module

    Returns:
        List of created DocumentChunk objects
    """
    chunk_objects = []
    for chunk_data in chunks:
        chunk = DocumentChunk(
            document_id=document_id,
            module_id=module_id,
            chunk_index=chunk_data['index'],
            chunk_text=chunk_data['text'],
            chunk_size=len(chunk_data['text']),
            chunk_metadata=chunk_data.get('chunk_metadata', {})
        )
        chunk_objects.append(chunk)
        db.add(chunk)

    db.commit()

    # Refresh all objects
    for chunk in chunk_objects:
        db.refresh(chunk)

    return chunk_objects


def get_chunk_by_id(db: Session, chunk_id: str) -> Optional[DocumentChunk]:
    """Get a single chunk by ID"""
    return db.query(DocumentChunk).filter(DocumentChunk.id == chunk_id).first()


def get_chunks_by_document(
    db: Session,
    document_id: str,
    order_by_index: bool = True
) -> List[DocumentChunk]:
    """
    Get all chunks for a document

    Args:
        db: Database session
        document_id: UUID of the document
        order_by_index: Whether to order by chunk_index

    Returns:
        List of DocumentChunk objects
    """
    query = db.query(DocumentChunk).filter(DocumentChunk.document_id == document_id)

    if order_by_index:
        query = query.order_by(DocumentChunk.chunk_index)

    return query.all()


def get_chunk_count(db: Session, document_id: str) -> int:
    """Get the number of chunks for a document"""
    return db.query(DocumentChunk).filter(
        DocumentChunk.document_id == document_id
    ).count()


def delete_chunks_by_document(db: Session, document_id: str) -> int:
    """
    Delete all chunks for a document

    Args:
        db: Database session
        document_id: UUID of the document

    Returns:
        Number of chunks deleted
    """
    deleted_count = db.query(DocumentChunk).filter(
        DocumentChunk.document_id == document_id
    ).delete()
    db.commit()
    return deleted_count


def delete_chunk(db: Session, chunk_id: str) -> bool:
    """
    Delete a specific chunk

    Args:
        db: Database session
        chunk_id: UUID of the chunk

    Returns:
        True if deleted, False if not found
    """
    chunk = db.query(DocumentChunk).filter(DocumentChunk.id == chunk_id).first()
    if not chunk:
        return False

    db.delete(chunk)
    db.commit()
    return True


def get_chunk_text_by_document(db: Session, document_id: str) -> str:
    """
    Reconstruct full document text from chunks

    Args:
        db: Database session
        document_id: UUID of the document

    Returns:
        Full text reconstructed from chunks in order
    """
    chunks = get_chunks_by_document(db, document_id, order_by_index=True)
    return "\n".join([chunk.chunk_text for chunk in chunks])
