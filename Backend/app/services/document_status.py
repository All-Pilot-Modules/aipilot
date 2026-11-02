"""
Document status management utilities
Handles updating and tracking document processing status
"""
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from app.models.document import Document, ProcessingStatus


def update_document_status(
    db: Session,
    document_id: str,
    status: str,
    metadata: Optional[Dict[str, Any]] = None
) -> Document:
    """
    Update document processing status and metadata

    Args:
        db: Database session
        document_id: UUID of the document
        status: New status (use ProcessingStatus constants)
        metadata: Additional metadata to merge with existing

    Returns:
        Updated Document object
    """
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise ValueError(f"Document {document_id} not found")

    # Update status
    doc.processing_status = status

    # Merge metadata
    if metadata:
        current_metadata = dict(doc.processing_metadata or {})
        current_metadata.update(metadata)
        current_metadata[f"{status}_at"] = datetime.now(timezone.utc).isoformat()
        doc.processing_metadata = current_metadata

    db.commit()
    db.refresh(doc)

    return doc


def set_document_error(
    db: Session,
    document_id: str,
    error_message: str,
    error_details: Optional[Dict[str, Any]] = None
) -> Document:
    """
    Mark document as failed with error details

    Args:
        db: Database session
        document_id: UUID of the document
        error_message: Human-readable error message
        error_details: Additional error context

    Returns:
        Updated Document object
    """
    metadata = {
        "error": error_message,
        "error_details": error_details or {},
        "failed_at": datetime.now(timezone.utc).isoformat()
    }

    return update_document_status(
        db=db,
        document_id=document_id,
        status=ProcessingStatus.FAILED,
        metadata=metadata
    )


def get_document_status(db: Session, document_id: str) -> Dict[str, Any]:
    """
    Get current processing status and metadata for a document

    Args:
        db: Database session
        document_id: UUID of the document

    Returns:
        Dict with status, metadata, and progress info
    """
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise ValueError(f"Document {document_id} not found")

    return {
        "document_id": str(doc.id),
        "status": doc.processing_status,
        "metadata": doc.processing_metadata or {},
        "is_ready": doc.processing_status in (ProcessingStatus.INDEXED, ProcessingStatus.EMBEDDED, ProcessingStatus.PARSED),
        "has_error": doc.processing_status == ProcessingStatus.FAILED,
        "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None
    }


def is_document_indexed(db: Session, document_id: str) -> bool:
    """
    Check if document is fully indexed and ready for RAG

    Args:
        db: Database session
        document_id: UUID of the document

    Returns:
        True if document is indexed, False otherwise
    """
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        return False

    return doc.processing_status in (ProcessingStatus.INDEXED, ProcessingStatus.EMBEDDED, ProcessingStatus.PARSED)
