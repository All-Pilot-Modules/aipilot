"""
Embedding generation service using OpenAI API
Generates vector embeddings for text chunks
"""
import os
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models.document_chunk import DocumentChunk
from app.crud.document_embedding import bulk_create_embeddings
from app.core.config import OPENAI_API_KEYS, EMBED_MODEL

EMBED_DIMENSIONS = 1536  # cap at 1536 so pgvector HNSW index works (max 2000 dims)
from app.services.openai_client import OpenAIClientWithRetry


client = OpenAIClientWithRetry(api_keys=OPENAI_API_KEYS)


from app.core.latency import timed

@timed("generate_embedding")
def generate_embedding(
    text: str,
    model: str = None
) -> Dict[str, Any]:
    """
    Generate embedding for a single text string

    Args:
        text: Text to embed
        model: OpenAI embedding model (default: from EMBED_MODEL config)

    Returns:
        {
            'embedding': List[float],  # The vector
            'dimensions': int,          # Vector dimensions
            'tokens': int              # Tokens used
        }
    """
    if model is None:
        model = EMBED_MODEL

    try:
        response = client.create_embedding(
            input=text,
            model=model,
            dimensions=EMBED_DIMENSIONS
        )

        embedding_data = response.data[0]

        return {
            'embedding': embedding_data.embedding,
            'dimensions': len(embedding_data.embedding),
            'tokens': response.usage.total_tokens
        }

    except Exception as e:
        print(f"❌ Error generating embedding: {str(e)}")
        raise


@timed("generate_embeddings_batch")
def generate_embeddings_batch(
    texts: List[str],
    model: str = None
) -> List[Dict[str, Any]]:
    """
    Generate embeddings for multiple texts in a single API call
    More efficient than generating one at a time

    Args:
        texts: List of text strings to embed
        model: OpenAI embedding model (default: from EMBED_MODEL config)

    Returns:
        List of embedding dicts with 'embedding', 'dimensions', 'tokens'
    """
    if model is None:
        model = EMBED_MODEL

    try:
        response = client.create_embedding(
            input=texts,
            model=model,
            dimensions=EMBED_DIMENSIONS
        )

        results = []
        for embedding_data in response.data:
            results.append({
                'embedding': embedding_data.embedding,
                'dimensions': len(embedding_data.embedding),
                'tokens': response.usage.total_tokens // len(texts)  # Approximate per-text tokens
            })

        return results

    except Exception as e:
        print(f"❌ Error generating batch embeddings: {str(e)}")
        raise


@timed("generate_embeddings_for_document")
def generate_embeddings_for_document(
    db: Session,
    document_id: str,
    batch_size: int = 100,
    model: str = None
) -> int:
    """
    Generate and save embeddings for all chunks of a document

    Args:
        db: Database session
        document_id: UUID of the document
        batch_size: Number of chunks to process at once (OpenAI limit is ~2048)
        model: Embedding model to use (default: from EMBED_MODEL config)

    Returns:
        Number of embeddings created
    """
    if model is None:
        model = EMBED_MODEL

    # Get all chunks for this document
    chunks = db.query(DocumentChunk).filter(
        DocumentChunk.document_id == document_id
    ).order_by(DocumentChunk.chunk_index).all()

    if not chunks:
        print(f"⚠️ No chunks found for document {document_id}")
        return 0

    print(f"📊 Generating embeddings for {len(chunks)} chunks...")

    total_embeddings = 0

    # Process in batches
    for i in range(0, len(chunks), batch_size):
        batch_chunks = chunks[i:i + batch_size]
        batch_texts = [chunk.chunk_text for chunk in batch_chunks]

        print(f"  Processing batch {i // batch_size + 1} ({len(batch_chunks)} chunks)...")

        try:
            # Generate embeddings for batch
            embeddings_data = generate_embeddings_batch(batch_texts, model=model)

            # Prepare data for bulk insert
            embeddings_to_insert = []
            for chunk, embedding_info in zip(batch_chunks, embeddings_data):
                embeddings_to_insert.append({
                    'chunk_id': chunk.id,
                    'document_id': chunk.document_id,
                    'module_id': chunk.module_id,
                    'embedding_vector': embedding_info['embedding'],
                    'embedding_model': model,
                    'embedding_dimensions': embedding_info['dimensions'],
                    'token_count': embedding_info['tokens']
                })

            # Bulk insert to database
            bulk_create_embeddings(db, embeddings_to_insert)
            total_embeddings += len(embeddings_to_insert)

            print(f"  ✅ Saved {len(embeddings_to_insert)} embeddings")

        except Exception as e:
            print(f"  ❌ Error processing batch: {str(e)}")
            # Continue with next batch even if one fails
            continue

    print(f"✅ Total embeddings created: {total_embeddings}")
    return total_embeddings


def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """
    Calculate cosine similarity between two vectors

    Args:
        vec1: First vector
        vec2: Second vector

    Returns:
        Similarity score between -1 and 1 (1 = identical, -1 = opposite)
    """
    import math

    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    magnitude1 = math.sqrt(sum(a * a for a in vec1))
    magnitude2 = math.sqrt(sum(b * b for b in vec2))

    if magnitude1 == 0 or magnitude2 == 0:
        return 0.0

    return float(dot_product / (magnitude1 * magnitude2))


@timed("search_similar_chunks")
def search_similar_chunks(
    db: Session,
    query_text: str,
    document_id: Optional[str] = None,
    limit: int = 5,
    model: str = None,
    query_vector: Optional[List[float]] = None,
) -> List[Dict[str, Any]]:
    """
    Search for chunks similar to a query text

    Args:
        db: Database session
        query_text: The search query (ignored for embedding if query_vector
            is provided — still used for logging/debugging)
        document_id: Optional document ID to limit search scope
        limit: Number of results to return
        model: Embedding model to use (default: from EMBED_MODEL config)
        query_vector: Precomputed embedding for query_text. Pass this when
            calling in a loop over multiple documents for the SAME query
            (e.g. rag_retriever's per-module document scan) so the query
            is embedded once via the OpenAI API instead of once per document.

    Returns:
        List of dicts with 'chunk', 'similarity', 'text'
    """
    if model is None:
        model = EMBED_MODEL

    if query_vector is None:
        query_embedding_info = generate_embedding(query_text, model=model)
        query_vector = query_embedding_info['embedding']

    # Get all embeddings (optionally filtered by document)
    from app.models.document_embedding import DocumentEmbedding

    query = db.query(DocumentEmbedding).join(DocumentChunk)

    if document_id:
        query = query.filter(DocumentEmbedding.document_id == document_id)

    embeddings = query.all()

    if not embeddings:
        print("⚠️ No embeddings found")
        return []

    # Calculate similarity scores
    results = []
    for embedding in embeddings:
        similarity = cosine_similarity(query_vector, embedding.embedding_vector)
        results.append({
            'chunk_id': embedding.chunk_id,
            'document_id': embedding.document_id,
            'similarity': similarity,
            'embedding': embedding
        })

    # Sort by similarity (highest first)
    results.sort(key=lambda x: x['similarity'], reverse=True)

    # Get top N results with chunk text
    top_results = []
    for result in results[:limit]:
        chunk = db.query(DocumentChunk).filter(
            DocumentChunk.id == result['chunk_id']
        ).first()

        if chunk:
            top_results.append({
                'chunk_id': result['chunk_id'],
                'document_id': result['document_id'],
                'similarity': result['similarity'],
                'text': chunk.chunk_text,
                'chunk_index': chunk.chunk_index,
                'metadata': chunk.chunk_metadata or {}  # Include metadata (page, slide, section info)
            })

    return top_results


def search_similar_chunks_in_module(
    db: Session,
    module_id,
    query_vector: List[float],
    limit: int = 5,
    exclude_testbank: bool = True,
) -> List[Dict[str, Any]]:
    """
    Nearest-neighbor search across every embedded chunk in a module, in one
    query — the HNSW index on document_embeddings.embedding_vector (built
    with vector_cosine_ops) only gets used if the ORDER BY is the matching
    operator, so this must use .cosine_distance() (<=>), not a plain Python
    comparison. Returns the module's globally best `limit` chunks directly,
    joined with chunk text/metadata and document title — replaces the old
    search_similar_chunks() being called once per document (each call
    pulling that whole document's vectors into Python to score and sort
    there) with the equivalent, strictly cheaper single round trip.

    Args:
        db: Database session
        module_id: Module to search within
        query_vector: Precomputed query embedding (see generate_embedding)
        limit: Max chunks to return (already the module-wide top N, sorted)
        exclude_testbank: Skip documents marked as testbank (answer keys etc.)

    Returns:
        List of dicts: chunk_id, document_id, document_title, similarity,
        text, chunk_index, metadata — same shape search_similar_chunks()
        returns, with document_title/document_id already merged in (callers
        used to add those themselves after the fact).
    """
    from app.models.document_embedding import DocumentEmbedding
    from app.models.document import Document

    distance = DocumentEmbedding.embedding_vector.cosine_distance(query_vector)

    query = (
        db.query(
            DocumentEmbedding.chunk_id,
            DocumentEmbedding.document_id,
            DocumentChunk.chunk_text,
            DocumentChunk.chunk_index,
            DocumentChunk.chunk_metadata,
            Document.title,
            distance.label("distance"),
        )
        .join(DocumentChunk, DocumentEmbedding.chunk_id == DocumentChunk.id)
        .join(Document, DocumentEmbedding.document_id == Document.id)
        .filter(DocumentEmbedding.module_id == module_id)
        .filter(Document.processing_status == "embedded")
    )

    if exclude_testbank:
        query = query.filter(Document.is_testbank == False)

    rows = query.order_by(distance).limit(limit).all()

    return [
        {
            'chunk_id': row.chunk_id,
            'document_id': row.document_id,
            'document_title': row.title,
            # pgvector's cosine_distance is 1 - cosine_similarity, so convert
            # back to a similarity score to keep this the same metric
            # (0..1, higher = more relevant) callers already expect.
            'similarity': 1.0 - row.distance,
            'text': row.chunk_text,
            'chunk_index': row.chunk_index,
            'metadata': row.chunk_metadata or {},
        }
        for row in rows
    ]
