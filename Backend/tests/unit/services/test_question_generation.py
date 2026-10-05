"""
Unit tests for question_generation.py - AI question generation from documents.
Tests: document-to-questions, JSON parsing, validation.
"""
import pytest
import uuid
import json
from unittest.mock import MagicMock, patch

from tests.fixtures.ai_responses import QUESTION_GENERATION_RESPONSE


class TestQuestionGenerationService:
    """Tests for the QuestionGenerationService class."""

    @pytest.fixture
    def mock_db(self):
        """Create a mock database session."""
        return MagicMock()

    @pytest.fixture
    def mock_openai(self):
        """Mock OpenAI client."""
        with patch("app.services.question_generation.OpenAIClientWithRetry") as mock_cls:
            mock_client = MagicMock()
            mock_cls.return_value = mock_client
            yield mock_client

    @pytest.fixture
    def service(self, mock_openai):
        """Create a question generation service instance."""
        from app.services.question_generation import QuestionGenerationService
        service = QuestionGenerationService()
        service.client = mock_openai
        return service

    def _create_mock_document(self, processing_status="embedded"):
        """Helper to create a mock Document row."""
        doc = MagicMock()
        doc.id = uuid.uuid4()
        doc.module_id = uuid.uuid4()
        doc.title = "test_document.pdf"
        doc.processing_status = processing_status
        return doc

    def _create_mock_chunks(self, texts=None):
        """Helper to create mock DocumentChunk rows."""
        if texts is None:
            texts = [
                "Chapter 1: Introduction to OOP. Object-oriented programming is a paradigm...",
                "Chapter 2: Inheritance. Inheritance allows classes to inherit properties...",
            ]
        chunks = []
        for i, text in enumerate(texts):
            chunk = MagicMock()
            chunk.chunk_index = i
            chunk.chunk_text = text
            chunk.chunk_metadata = {"page_number": i + 1}
            chunks.append(chunk)
        return chunks

    def _wire_db(self, mock_db, document, chunks):
        """Wire a mock db session's query chain for Document lookup + chunk fetch."""
        mock_db.query.return_value.filter.return_value.first.return_value = document
        mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = chunks

    def _create_mock_completion(self, content: str):
        """Helper to create mock OpenAI completion response."""
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = content
        mock_response.choices[0].finish_reason = "stop"
        mock_response.usage = MagicMock(total_tokens=100, prompt_tokens=80, completion_tokens=20)
        return mock_response

    # -------------------------------------------------------------------------
    # Question Generation Tests
    # -------------------------------------------------------------------------
    def test_generate_questions_from_document(self, service, mock_openai, mock_db):
        """Test generating questions from a document."""
        mock_doc = self._create_mock_document()
        self._wire_db(mock_db, mock_doc, self._create_mock_chunks())
        mock_openai.create_chat_completion.return_value = \
            self._create_mock_completion(QUESTION_GENERATION_RESPONSE)

        result = service.generate_questions_from_document(
            db=mock_db,
            document_id=mock_doc.id,
            num_short=2,
            num_long=1,
            num_mcq=3
        )

        assert result is not None
        assert len(result) == 3
        mock_openai.create_chat_completion.assert_called_once()

    def test_generate_with_all_question_types(self, service, mock_openai, mock_db):
        """Test generating short, long, and MCQ questions together."""
        mock_doc = self._create_mock_document()
        self._wire_db(mock_db, mock_doc, self._create_mock_chunks())

        mock_openai.create_chat_completion.return_value = \
            self._create_mock_completion(QUESTION_GENERATION_RESPONSE)

        result = service.generate_questions_from_document(
            db=mock_db,
            document_id=mock_doc.id,
            num_short=1,
            num_long=1,
            num_mcq=1
        )

        assert result is not None
        types = {q["type"] for q in result}
        assert types == {"short", "long", "mcq"}

    def test_generate_zero_questions_requested(self, service, mock_openai, mock_db):
        """Test behavior when zero questions requested."""
        mock_doc = self._create_mock_document()
        self._wire_db(mock_db, mock_doc, self._create_mock_chunks())
        mock_openai.create_chat_completion.return_value = \
            self._create_mock_completion(json.dumps({"questions": []}))

        with pytest.raises(ValueError):
            service.generate_questions_from_document(
                db=mock_db,
                document_id=mock_doc.id,
                num_short=0,
                num_long=0,
                num_mcq=0
            )

    def test_generate_from_document_not_processed(self, service, mock_db):
        """Test handling unprocessed document."""
        mock_doc = self._create_mock_document(processing_status="pending")
        self._wire_db(mock_db, mock_doc, self._create_mock_chunks())

        with pytest.raises(ValueError):
            service.generate_questions_from_document(
                db=mock_db,
                document_id=mock_doc.id,
                num_short=1,
                num_long=0,
                num_mcq=0
            )

    def test_generate_from_empty_document(self, service, mock_db):
        """Test handling document with no chunks."""
        mock_doc = self._create_mock_document()
        self._wire_db(mock_db, mock_doc, [])

        with pytest.raises(ValueError):
            service.generate_questions_from_document(
                db=mock_db,
                document_id=mock_doc.id,
                num_short=1,
                num_long=0,
                num_mcq=0
            )

    # -------------------------------------------------------------------------
    # Prompt Building Tests
    # -------------------------------------------------------------------------
    def test_format_chunks_for_prompt(self, service):
        """Test formatting document chunks for the prompt."""
        chunks = self._create_mock_chunks(["Chunk 1 content", "Chunk 2 content"])

        result = service._format_chunks_for_prompt(chunks, "Test Document")

        assert "Chunk 1" in result
        assert "Chunk 2" in result

    def test_build_question_generation_prompt(self, service):
        """Test building the question generation prompt."""
        content = "This is course material about programming concepts."

        result = service._build_question_generation_prompt(
            document_content=content,
            document_title="Programming 101",
            num_short=2,
            num_long=1,
            num_mcq=3
        )

        assert content in result
        assert "SHORT ANSWER" in result and "2" in result
        assert "MULTIPLE CHOICE" in result or "mcq" in result.lower()
        assert "JSON" in result or "json" in result.lower()

    def test_prompt_includes_bloom_taxonomy(self, service):
        """Test that prompt requests Bloom's taxonomy levels."""
        result = service._build_question_generation_prompt(
            document_content="Test content",
            document_title="Test Doc",
            num_short=1,
            num_long=1,
            num_mcq=1
        )

        assert "bloom" in result.lower() or "taxonomy" in result.lower() or \
               "understand" in result.lower() or "analyze" in result.lower()

    # -------------------------------------------------------------------------
    # Response Parsing Tests
    # -------------------------------------------------------------------------
    def test_parse_openai_response_valid_json(self, service):
        """Test parsing valid JSON response."""
        response = QUESTION_GENERATION_RESPONSE

        result = service._parse_openai_response(
            response, document_id=uuid.uuid4(), module_id=uuid.uuid4()
        )

        assert result is not None
        assert len(result) > 0
        assert all("type" in q for q in result)

    def test_parse_openai_response_invalid_json(self, service):
        """Test handling invalid JSON response."""
        response = "This is not valid JSON at all"

        with pytest.raises(ValueError):
            service._parse_openai_response(
                response, document_id=uuid.uuid4(), module_id=uuid.uuid4()
            )

    def test_parse_openai_response_missing_questions_key(self, service):
        """Test handling response without 'questions' key."""
        response = json.dumps({"data": [{"type": "mcq"}]})

        with pytest.raises(ValueError):
            service._parse_openai_response(
                response, document_id=uuid.uuid4(), module_id=uuid.uuid4()
            )

    def test_parse_response_marks_unreviewed(self, service):
        """Test that parsed questions are marked as unreviewed."""
        response = json.dumps({
            "questions": [
                {"type": "mcq", "text": "Test?", "options": {"A": "1"}, "correct_option_id": "A"}
            ]
        })

        result = service._parse_openai_response(
            response, document_id=uuid.uuid4(), module_id=uuid.uuid4()
        )

        assert result[0]["is_ai_generated"] is True
        assert str(result[0]["status"]) == "unreviewed" or result[0]["status"].value == "unreviewed"

    def test_parse_response_includes_bloom_level(self, service):
        """Test that parsed questions include Bloom's taxonomy."""
        response = json.dumps({
            "questions": [
                {
                    "type": "short",
                    "text": "Explain X.",
                    "bloom_taxonomy": "Understand",
                    "learning_outcome": "Demonstrate understanding"
                }
            ]
        })

        result = service._parse_openai_response(
            response, document_id=uuid.uuid4(), module_id=uuid.uuid4()
        )

        assert result[0].get("bloom_taxonomy") == "Understand"

    # -------------------------------------------------------------------------
    # Edge Cases Tests
    # -------------------------------------------------------------------------
    def test_handles_special_characters_in_content(self, service, mock_openai, mock_db):
        """Test handling content with special characters."""
        mock_doc = self._create_mock_document()
        chunks = self._create_mock_chunks(
            ['Content with "quotes" and \'apostrophes\' and <html> tags']
        )
        self._wire_db(mock_db, mock_doc, chunks)

        mock_openai.create_chat_completion.return_value = \
            self._create_mock_completion(QUESTION_GENERATION_RESPONSE)

        try:
            service.generate_questions_from_document(
                db=mock_db,
                document_id=mock_doc.id,
                num_short=1,
                num_long=0,
                num_mcq=0
            )
        except Exception as e:
            pytest.fail(f"Should handle special characters: {e}")

    def test_handles_unicode_content(self, service, mock_openai, mock_db):
        """Test handling Unicode content."""
        mock_doc = self._create_mock_document()
        chunks = self._create_mock_chunks(["Content with émojis 🎉 and accénts café résumé"])
        self._wire_db(mock_db, mock_doc, chunks)

        mock_openai.create_chat_completion.return_value = \
            self._create_mock_completion(QUESTION_GENERATION_RESPONSE)

        try:
            service.generate_questions_from_document(
                db=mock_db,
                document_id=mock_doc.id,
                num_short=1,
                num_long=0,
                num_mcq=0
            )
        except Exception as e:
            pytest.fail(f"Should handle Unicode: {e}")

    def test_handles_very_long_document(self, service, mock_openai, mock_db):
        """Test handling very long documents."""
        chunks = self._create_mock_chunks(["Long content " * 1000 for _ in range(50)])
        mock_doc = self._create_mock_document()
        self._wire_db(mock_db, mock_doc, chunks)

        mock_openai.create_chat_completion.return_value = \
            self._create_mock_completion(QUESTION_GENERATION_RESPONSE)

        service.generate_questions_from_document(
            db=mock_db,
            document_id=mock_doc.id,
            num_short=1,
            num_long=0,
            num_mcq=0
        )

        mock_openai.create_chat_completion.assert_called()
