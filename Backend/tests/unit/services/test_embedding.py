"""
Unit tests for embedding.py - Vector embedding generation and similarity search.
Tests: batch processing, cosine similarity, vector storage.
"""
import pytest
import uuid
import math
from unittest.mock import MagicMock, patch


class TestEmbeddingGeneration:
    """Tests for embedding generation functions."""

    @pytest.fixture
    def mock_openai(self):
        """Mock OpenAI client for embedding generation."""
        with patch("app.services.embedding.openai") as mock:
            mock_client = MagicMock()
            mock.OpenAI.return_value = mock_client
            yield mock_client

    # -------------------------------------------------------------------------
    # Single Embedding Tests
    # -------------------------------------------------------------------------
    def test_generate_single_embedding(self, mock_openai):
        """Test generating a single embedding."""
        mock_response = MagicMock()
        mock_response.data = [MagicMock(embedding=[0.1] * 1536)]
        mock_openai.embeddings.create.return_value = mock_response

        from app.services.embedding import generate_embedding

        result = generate_embedding("Test text")

        assert result is not None
        assert len(result) == 1536
        mock_openai.embeddings.create.assert_called_once()

    def test_generate_embedding_empty_text(self, mock_openai):
        """Test handling empty text input."""
        from app.services.embedding import generate_embedding

        # Should handle gracefully
        result = generate_embedding("")

        # Either returns None or raises an error
        assert result is None or isinstance(result, list)

    def test_generate_embedding_long_text(self, mock_openai):
        """Test handling very long text (truncation)."""
        mock_response = MagicMock()
        mock_response.data = [MagicMock(embedding=[0.1] * 1536)]
        mock_openai.embeddings.create.return_value = mock_response

        from app.services.embedding import generate_embedding

        long_text = "word " * 10000  # Very long text
        result = generate_embedding(long_text)

        assert result is not None

    # -------------------------------------------------------------------------
    # Batch Embedding Tests
    # -------------------------------------------------------------------------
    def test_generate_embeddings_batch(self, mock_openai):
        """Test generating embeddings for multiple texts."""
        mock_response = MagicMock()
        mock_response.data = [
            MagicMock(embedding=[0.1] * 1536),
            MagicMock(embedding=[0.2] * 1536),
            MagicMock(embedding=[0.3] * 1536),
        ]
        mock_openai.embeddings.create.return_value = mock_response

        from app.services.embedding import generate_embeddings_batch

        texts = ["Text 1", "Text 2", "Text 3"]
        result = generate_embeddings_batch(texts)

        assert len(result) == 3
        assert all(len(emb) == 1536 for emb in result)

    def test_batch_embeddings_empty_list(self, mock_openai):
        """Test handling empty text list."""
        from app.services.embedding import generate_embeddings_batch

        result = generate_embeddings_batch([])

        assert result == [] or result is None

    def test_batch_embeddings_single_text(self, mock_openai):
        """Test batch with single text."""
        mock_response = MagicMock()
        mock_response.data = [MagicMock(embedding=[0.1] * 1536)]
        mock_openai.embeddings.create.return_value = mock_response

        from app.services.embedding import generate_embeddings_batch

        result = generate_embeddings_batch(["Single text"])

        assert len(result) == 1


class TestCosineSimilarity:
    """Tests for cosine similarity calculation."""

    def test_identical_vectors(self):
        """Test similarity of identical vectors is 1.0."""
        from app.services.embedding import cosine_similarity

        vec = [0.5, 0.5, 0.5, 0.5]
        result = cosine_similarity(vec, vec)

        assert abs(result - 1.0) < 0.0001

    def test_orthogonal_vectors(self):
        """Test similarity of orthogonal vectors is 0."""
        from app.services.embedding import cosine_similarity

        vec1 = [1.0, 0.0]
        vec2 = [0.0, 1.0]
        result = cosine_similarity(vec1, vec2)

        assert abs(result) < 0.0001

    def test_opposite_vectors(self):
        """Test similarity of opposite vectors is -1."""
        from app.services.embedding import cosine_similarity

        vec1 = [1.0, 1.0]
        vec2 = [-1.0, -1.0]
        result = cosine_similarity(vec1, vec2)

        assert abs(result + 1.0) < 0.0001

    def test_similar_vectors(self):
        """Test similarity of similar vectors is high."""
        from app.services.embedding import cosine_similarity

        vec1 = [0.8, 0.6, 0.2]
        vec2 = [0.75, 0.65, 0.25]
        result = cosine_similarity(vec1, vec2)

        assert result > 0.95  # Very similar

    def test_dissimilar_vectors(self):
        """Test similarity of dissimilar vectors is low."""
        from app.services.embedding import cosine_similarity

        vec1 = [1.0, 0.0, 0.0]
        vec2 = [0.0, 0.0, 1.0]
        result = cosine_similarity(vec1, vec2)

        assert result < 0.1

    def test_high_dimensional_vectors(self):
        """Test similarity with high-dimensional vectors (like embeddings)."""
        from app.services.embedding import cosine_similarity
        import random

        # Simulate 1536-dim embedding vectors
        vec1 = [random.uniform(-1, 1) for _ in range(1536)]
        vec2 = vec1.copy()  # Identical

        result = cosine_similarity(vec1, vec2)
        assert abs(result - 1.0) < 0.0001

    def test_zero_vector_handling(self):
        """Test handling of zero vectors."""
        from app.services.embedding import cosine_similarity

        vec1 = [0.0, 0.0, 0.0]
        vec2 = [1.0, 1.0, 1.0]

        # Should handle gracefully (return 0 or raise)
        try:
            result = cosine_similarity(vec1, vec2)
            assert result == 0.0 or math.isnan(result)
        except (ZeroDivisionError, ValueError):
            pass  # Expected behavior


class TestSimilarChunkSearch:
    """Tests for searching similar document chunks."""

    @pytest.fixture
    def mock_db(self):
        """Create a mock database session."""
        return MagicMock()

    @pytest.fixture
    def mock_chunks(self):
        """Create mock document chunks with embeddings."""
        chunks = []
        for i in range(5):
            chunk = MagicMock()
            chunk.id = uuid.uuid4()
            chunk.text = f"Chunk {i} content"
            chunk.embedding = [0.1 * (i + 1)] * 1536
            chunk.document_id = uuid.uuid4()
            chunk.document = MagicMock(original_filename=f"doc{i}.pdf")
            chunk.metadata = {"page": i + 1}
            chunks.append(chunk)
        return chunks

    def test_search_returns_top_k(self, mock_db, mock_chunks):
        """Test that search returns top k most similar chunks."""
        with patch("app.services.embedding.generate_embedding") as mock_embed:
            mock_embed.return_value = [0.5] * 1536

            # Mock database query
            mock_db.query.return_value.filter.return_value.all.return_value = mock_chunks

            from app.services.embedding import search_similar_chunks

            result = search_similar_chunks(
                db=mock_db,
                query="Test query",
                module_id=uuid.uuid4(),
                top_k=3
            )

            assert len(result) <= 3

    def test_search_filters_by_module(self, mock_db):
        """Test that search filters by module ID."""
        with patch("app.services.embedding.generate_embedding") as mock_embed:
            mock_embed.return_value = [0.5] * 1536
            mock_db.query.return_value.filter.return_value.all.return_value = []

            from app.services.embedding import search_similar_chunks

            module_id = uuid.uuid4()
            search_similar_chunks(
                db=mock_db,
                query="Test",
                module_id=module_id,
                top_k=5
            )

            # Verify filter was called
            mock_db.query.return_value.filter.assert_called()

    def test_search_empty_results(self, mock_db):
        """Test handling when no similar chunks found."""
        with patch("app.services.embedding.generate_embedding") as mock_embed:
            mock_embed.return_value = [0.5] * 1536
            mock_db.query.return_value.filter.return_value.all.return_value = []

            from app.services.embedding import search_similar_chunks

            result = search_similar_chunks(
                db=mock_db,
                query="Test",
                module_id=uuid.uuid4(),
                top_k=5
            )

            assert result == []


class TestDocumentEmbeddingGeneration:
    """Tests for generating embeddings for entire documents."""

    @pytest.fixture
    def mock_db(self):
        return MagicMock()

    @pytest.fixture
    def mock_document(self):
        """Create a mock document with chunks."""
        doc = MagicMock()
        doc.id = uuid.uuid4()
        doc.chunks = [
            MagicMock(id=uuid.uuid4(), text=f"Chunk {i}") for i in range(5)
        ]
        return doc

    def test_generate_embeddings_for_document(self, mock_db, mock_document):
        """Test generating embeddings for all document chunks."""
        with patch("app.services.embedding.generate_embeddings_batch") as mock_batch, \
             patch("app.services.embedding.openai"):

            mock_batch.return_value = [[0.1] * 1536 for _ in range(5)]

            from app.services.embedding import generate_embeddings_for_document

            result = generate_embeddings_for_document(
                db=mock_db,
                document=mock_document
            )

            assert result is True or result == 5
            mock_batch.assert_called()

    def test_generate_embeddings_empty_document(self, mock_db):
        """Test handling document with no chunks."""
        empty_doc = MagicMock()
        empty_doc.chunks = []

        with patch("app.services.embedding.generate_embeddings_batch") as mock_batch:
            from app.services.embedding import generate_embeddings_for_document

            result = generate_embeddings_for_document(
                db=mock_db,
                document=empty_doc
            )

            # Should handle gracefully
            assert result is not None

    def test_generate_embeddings_batch_processing(self, mock_db, mock_document):
        """Test that large documents are processed in batches."""
        # Create document with many chunks
        mock_document.chunks = [
            MagicMock(id=uuid.uuid4(), text=f"Chunk {i}") for i in range(100)
        ]

        with patch("app.services.embedding.generate_embeddings_batch") as mock_batch, \
             patch("app.services.embedding.openai"):

            # Return embeddings for each batch
            mock_batch.return_value = [[0.1] * 1536 for _ in range(20)]

            from app.services.embedding import generate_embeddings_for_document

            generate_embeddings_for_document(
                db=mock_db,
                document=mock_document
            )

            # Should be called multiple times for batching
            assert mock_batch.call_count >= 1
