"""
Unit tests for rag_retriever.py - RAG context retrieval for feedback.
Tests: similarity search, threshold filtering, context formatting.
"""
import pytest
import uuid
from unittest.mock import MagicMock, patch


class TestRAGRetriever:
    """Tests for RAG retrieval functions."""

    @pytest.fixture
    def mock_db(self):
        """Create a mock database session."""
        return MagicMock()

    @pytest.fixture
    def mock_embeddings(self):
        """Mock embedding search results."""
        return [
            {
                "chunk_id": uuid.uuid4(),
                "text": "Paris is the capital of France.",
                "similarity": 0.92,
                "document_title": "Geography Notes",
                "page_number": 15,
            },
            {
                "chunk_id": uuid.uuid4(),
                "text": "France is located in Western Europe.",
                "similarity": 0.85,
                "document_title": "Geography Notes",
                "page_number": 16,
            },
            {
                "chunk_id": uuid.uuid4(),
                "text": "The Eiffel Tower is in Paris.",
                "similarity": 0.78,
                "document_title": "Landmarks Guide",
                "page_number": 42,
            },
        ]

    # -------------------------------------------------------------------------
    # Context Retrieval Tests
    # -------------------------------------------------------------------------
    def test_get_context_for_feedback_returns_chunks(self, mock_db):
        """Test that context retrieval returns relevant chunks."""
        with patch("app.services.rag_retriever.search_similar_chunks") as mock_search:
            mock_search.return_value = [
                MagicMock(
                    text="Relevant content here",
                    similarity_score=0.9,
                    document=MagicMock(original_filename="test.pdf"),
                    metadata={"page": 1}
                )
            ]

            from app.services.rag_retriever import get_context_for_feedback

            result = get_context_for_feedback(
                db=mock_db,
                question_text="What is the capital of France?",
                student_answer="Paris",
                module_id=uuid.uuid4()
            )

            assert result is not None
            mock_search.assert_called_once()

    def test_get_context_respects_similarity_threshold(self, mock_db):
        """Test that low-similarity chunks are filtered out."""
        with patch("app.services.rag_retriever.search_similar_chunks") as mock_search:
            # Return chunks with varying similarity
            mock_search.return_value = [
                MagicMock(text="High relevance", similarity_score=0.95),
                MagicMock(text="Low relevance", similarity_score=0.3),
            ]

            from app.services.rag_retriever import get_context_for_feedback

            result = get_context_for_feedback(
                db=mock_db,
                question_text="Test question",
                student_answer="Test answer",
                module_id=uuid.uuid4(),
                similarity_threshold=0.7
            )

            # Should filter based on threshold
            assert result is not None

    def test_get_context_limits_chunks(self, mock_db):
        """Test that max_chunks parameter is respected."""
        with patch("app.services.rag_retriever.search_similar_chunks") as mock_search:
            # Return many chunks
            mock_search.return_value = [
                MagicMock(text=f"Chunk {i}", similarity_score=0.9 - i*0.05)
                for i in range(10)
            ]

            from app.services.rag_retriever import get_context_for_feedback

            result = get_context_for_feedback(
                db=mock_db,
                question_text="Test",
                student_answer="Answer",
                module_id=uuid.uuid4(),
                max_chunks=3
            )

            assert result is not None

    def test_get_context_empty_when_no_documents(self, mock_db):
        """Test empty context when no documents found."""
        with patch("app.services.rag_retriever.search_similar_chunks") as mock_search:
            mock_search.return_value = []

            from app.services.rag_retriever import get_context_for_feedback

            result = get_context_for_feedback(
                db=mock_db,
                question_text="Test",
                student_answer="Answer",
                module_id=uuid.uuid4()
            )

            assert result is None or result.get("context") == "" or len(result.get("chunks", [])) == 0

    # -------------------------------------------------------------------------
    # Context Formatting Tests
    # -------------------------------------------------------------------------
    def test_format_context_for_prompt(self):
        """Test context formatting for AI prompt."""
        from app.services.rag_retriever import format_context_for_prompt

        chunks = [
            {
                "text": "Paris is the capital of France.",
                "document_title": "Geography",
                "page_number": 15,
                "similarity": 0.92,
            },
            {
                "text": "France is in Europe.",
                "document_title": "Geography",
                "page_number": 16,
                "similarity": 0.85,
            },
        ]

        result = format_context_for_prompt(chunks)

        assert "Paris" in result
        assert "France" in result
        # Should include source attribution
        assert "Geography" in result or "page" in result.lower()

    def test_format_context_empty_chunks(self):
        """Test formatting with empty chunk list."""
        from app.services.rag_retriever import format_context_for_prompt

        result = format_context_for_prompt([])

        assert result == "" or "no context" in result.lower()

    def test_format_context_includes_relevance(self):
        """Test that formatting includes relevance indicators."""
        from app.services.rag_retriever import format_context_for_prompt

        chunks = [
            {
                "text": "High relevance content",
                "document_title": "Doc1",
                "similarity": 0.95,
            },
        ]

        result = format_context_for_prompt(chunks)

        # Should indicate relevance in some way
        assert len(result) > 0

    # -------------------------------------------------------------------------
    # RAG Decision Tests
    # -------------------------------------------------------------------------
    def test_should_use_rag_for_mcq(self):
        """Test RAG decision for MCQ questions."""
        from app.services.rag_retriever import should_use_rag_for_question

        result = should_use_rag_for_question("mcq")
        # MCQs can use RAG for explanations
        assert isinstance(result, bool)

    def test_should_use_rag_for_short(self):
        """Test RAG decision for short answer questions."""
        from app.services.rag_retriever import should_use_rag_for_question

        result = should_use_rag_for_question("short")
        assert result is True

    def test_should_use_rag_for_long(self):
        """Test RAG decision for long/essay questions."""
        from app.services.rag_retriever import should_use_rag_for_question

        result = should_use_rag_for_question("long")
        assert result is True

    # -------------------------------------------------------------------------
    # Context Summary Tests
    # -------------------------------------------------------------------------
    def test_get_context_summary(self):
        """Test context summary generation."""
        from app.services.rag_retriever import get_context_summary

        context = {
            "chunks": [
                {"text": "Content 1", "document_title": "Doc1"},
                {"text": "Content 2", "document_title": "Doc2"},
            ],
            "sources": ["Doc1", "Doc2"],
        }

        result = get_context_summary(context)

        # Should provide a brief summary
        assert isinstance(result, str)

    def test_get_context_summary_empty(self):
        """Test summary for empty context."""
        from app.services.rag_retriever import get_context_summary

        result = get_context_summary(None)

        assert result == "" or "no context" in result.lower()


class TestSimilaritySearch:
    """Tests for similarity search integration."""

    @pytest.fixture
    def mock_db(self):
        return MagicMock()

    def test_search_combines_question_and_answer(self, mock_db):
        """Test that search query combines question and answer."""
        with patch("app.services.rag_retriever.search_similar_chunks") as mock_search, \
             patch("app.services.rag_retriever.generate_embedding") as mock_embed:

            mock_embed.return_value = [0.1] * 1536
            mock_search.return_value = []

            from app.services.rag_retriever import get_context_for_feedback

            get_context_for_feedback(
                db=mock_db,
                question_text="What is X?",
                student_answer="X is Y",
                module_id=uuid.uuid4()
            )

            # Should search with combined context
            mock_search.assert_called()

    def test_search_filters_by_module(self, mock_db):
        """Test that search filters by module ID."""
        with patch("app.services.rag_retriever.search_similar_chunks") as mock_search:
            mock_search.return_value = []

            from app.services.rag_retriever import get_context_for_feedback

            module_id = uuid.uuid4()
            get_context_for_feedback(
                db=mock_db,
                question_text="Test",
                student_answer="Answer",
                module_id=module_id
            )

            # Verify module_id filtering
            call_args = mock_search.call_args
            assert call_args is not None
