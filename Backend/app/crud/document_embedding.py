"""
CRUD operations for DocumentEmbedding
"""
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional, Dict, Any
from uuid import UUID

from app.models.document_embedding import DocumentEmbedding
from app.schemas.document_embedding import DocumentEmbeddingCreate


def create_embedding(db: Session, embedding_data: DocumentEmbeddingCreate) -> DocumentEmbedding:
    """
    Create a single embedding record
    """
    embedding = DocumentEmbedding(
        chunk_id=embedding_data.chunk_id,
        document_id=embedding_data.document_id,
        embedding_vector=embedding_data.embedding_vector,
        embedding_model=embedding_data.embedding_model,
        embedding_dimensions=embedding_data.embedding_dimensions,
        token_count=embedding_data.token_count
    )
    db.add(embedding)
    db.commit()
    db.refresh(embedding)
    return embedding


def bulk_create_embeddings(
    db: Session,
    embeddings_data: List[Dict[str, Any]]
) -> List[DocumentEmbedding]:
    """
    Bulk create embeddings for multiple chunks

    Args:
        db: Database session
        embeddings_data: List of dicts with keys:
            - chunk_id: UUID
            - document_id: UUID
            - embedding_vector: List[float]
            - embedding_model: str
            - embedding_dimensions: int
            - token_count: int (optional)

    Returns:
        List of created DocumentEmbedding objects
    """
    embedding_objects = []

    for data in embeddings_data:
        embedding = DocumentEmbedding(
            chunk_id=data['chunk_id'],
            document_id=data['document_id'],
            embedding_vector=data['embedding_vector'],
            embedding_model=data.get('embedding_model', 'text-embedding-ada-002'),
            embedding_dimensions=data.get('embedding_dimensions', 1536),
            token_count=data.get('token_count')
        )
        embedding_objects.append(embedding)
        db.add(embedding)

    db.commit()

    for embedding in embedding_objects:
        db.refresh(embedding)

    return embedding_objects


def get_embeddings_by_document(db: Session, document_id: str) -> List[DocumentEmbedding]:
    """
    Get all embeddings for a specific document
    """
    return db.query(DocumentEmbedding).filter(
        DocumentEmbedding.document_id == document_id
    ).order_by(DocumentEmbedding.created_at).all()


def get_embedding_by_chunk(db: Session, chunk_id: str) -> Optional[DocumentEmbedding]:
    """
    Get embedding for a specific chunk
    """
    return db.query(DocumentEmbedding).filter(
        DocumentEmbedding.chunk_id == chunk_id
    ).first()


def delete_embeddings_by_document(db: Session, document_id: str) -> int:
    """
    Delete all embeddings for a document
    Returns count of deleted embeddings
    """
    count = db.query(DocumentEmbedding).filter(
        DocumentEmbedding.document_id == document_id
    ).delete()
    db.commit()
    return count


def get_embedding_summary(db: Session, document_id: str) -> Dict[str, Any]:
    """
    Get summary statistics about embeddings for a document
    """
    result = db.query(
        func.count(DocumentEmbedding.id).label('count'),
        func.sum(DocumentEmbedding.token_count).label('total_tokens'),
        DocumentEmbedding.embedding_model,
        DocumentEmbedding.embedding_dimensions
    ).filter(
        DocumentEmbedding.document_id == document_id
    ).group_by(
        DocumentEmbedding.embedding_model,
        DocumentEmbedding.embedding_dimensions
    ).first()

    if not result:
        return {
            'document_id': document_id,
            'embedding_count': 0,
            'model': None,
            'dimensions': 0,
            'total_tokens': 0
        }

    return {
        'document_id': document_id,
        'embedding_count': result.count,
        'model': result.embedding_model,
        'dimensions': result.embedding_dimensions,
        'total_tokens': result.total_tokens or 0
    }


def similarity_search(
    db: Session,
    query_vector: List[float],
    limit: int = 5,
    document_id: Optional[str] = None
) -> List[tuple]:
    """
    Perform cosine similarity search using pgvector (<=> operator).

    Args:
        db: Database session
        query_vector: The query embedding vector
        limit: Number of results to return
        document_id: Optional document ID to limit search scope

    Returns:
        List of (embedding, similarity_score) tuples, ordered by similarity descending
    """
    from sqlalchemy import text

    distance_expr = DocumentEmbedding.embedding_vector.cosine_distance(query_vector)

    query = db.query(DocumentEmbedding, (1 - distance_expr).label("similarity"))

    if document_id:
        query = query.filter(DocumentEmbedding.document_id == document_id)

    results = query.order_by(distance_expr).limit(limit).all()

    return [(row.DocumentEmbedding, row.similarity) for row in results]
