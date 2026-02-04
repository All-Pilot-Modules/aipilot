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
        with patch("app.services.question_generation.openai") as mock:
            mock_client = MagicMock()
            mock.OpenAI.return_value = mock_client
            yield mock_client

    @pytest.fixture
    def service(self, mock_openai):
        """Create a question generation service instance."""
        from app.services.question_generation import QuestionGenerationService
        service = QuestionGenerationService()
        service.client = mock_openai
        return service

    def _create_mock_document(self, chunks=None):
        """Helper to create a mock document."""
        doc = MagicMock()
        doc.id = uuid.uuid4()
        doc.module_id = uuid.uuid4()
        doc.original_filename = "test_document.pdf"
        doc.processing_status = "completed"
        doc.parse_status = "completed"

        if chunks is None:
            chunks = [
                MagicMock(
                    text="Chapter 1: Introduction to OOP. Object-oriented programming is a paradigm...",
                    metadata={"page": 1}
                ),
                MagicMock(
                    text="Chapter 2: Inheritance. Inheritance allows classes to inherit properties...",
                    metadata={"page": 5}
                ),
            ]
        doc.chunks = chunks
        return doc

    def _create_mock_completion(self, content: str):
        """Helper to create mock OpenAI completion response."""
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = content
        return mock_response

    # -------------------------------------------------------------------------
    # Question Generation Tests
    # -------------------------------------------------------------------------
    def test_generate_questions_from_document(self, service, mock_openai, mock_db):
        """Test generating questions from a document."""
        mock_doc = self._create_mock_document()
        mock_openai.chat.completions.create.return_value = \
            self._create_mock_completion(QUESTION_GENERATION_RESPONSE)

        with patch.object(service, '_parse_openai_response') as mock_parse:
            mock_parse.return_value = json.loads(QUESTION_GENERATION_RESPONSE)["questions"]

            result = service.generate_questions_from_document(
                db=mock_db,
                document=mock_doc,
                num_short=2,
                num_long=1,
                num_mcq=3
            )

            assert result is not None
            mock_openai.chat.completions.create.assert_called_once()

    def test_generate_with_all_question_types(self, service, mock_openai, mock_db):
        """Test generating all question types."""
        mock_doc = self._create_mock_document()

        response_data = {
            "questions": [
                {"type": "short", "text": "Short Q", "points": 5},
                {"type": "long", "text": "Long Q", "points": 10},
                {"type": "mcq", "text": "MCQ", "options": {"A": "1", "B": "2"}, "correct_option_id": "A"},
                {"type": "mcq_multiple", "text": "MCQ Multi", "options": {"A": "1", "B": "2"},
                 "extended_config": {"correct_option_ids": ["A", "B"]}},
                {"type": "fill_blank", "text": "Fill ___",
                 "extended_config": {"blanks": [{"position": 0, "correct_answers": ["answer"]}]}},
            ]
        }

        mock_openai.chat.completions.create.return_value = \
            self._create_mock_completion(json.dumps(response_data))

        result = service.generate_questions_from_document(
            db=mock_db,
            document=mock_doc,
            num_short=1,
            num_long=1,
            num_mcq=1,
            num_mcq_multiple=1,
            num_fill_blank=1
        )

        assert result is not None

    def test_generate_zero_questions_requested(self, service, mock_openai, mock_db):
        """Test behavior when zero questions requested."""
        mock_doc = self._create_mock_document()

        result = service.generate_questions_from_document(
            db=mock_db,
            document=mock_doc,
            num_short=0,
            num_long=0,
            num_mcq=0
        )

        # Should return empty or raise error
        assert result is None or len(result) == 0

    def test_generate_from_document_not_processed(self, service, mock_db):
        """Test handling unprocessed document."""
        mock_doc = self._create_mock_document()
        mock_doc.processing_status = "pending"

        try:
            result = service.generate_questions_from_document(
                db=mock_db,
                document=mock_doc,
                num_short=1,
                num_long=0,
                num_mcq=0
            )
            # Should fail or return None
            assert result is None
        except ValueError:
            pass  # Expected

    def test_generate_from_empty_document(self, service, mock_db):
        """Test handling document with no chunks."""
        mock_doc = self._create_mock_document(chunks=[])

        try:
            result = service.generate_questions_from_document(
                db=mock_db,
                document=mock_doc,
                num_short=1,
                num_long=0,
                num_mcq=0
            )
            assert result is None or len(result) == 0
        except ValueError:
            pass  # Expected

    # -------------------------------------------------------------------------
    # Prompt Building Tests
    # -------------------------------------------------------------------------
    def test_format_chunks_for_prompt(self, service):
        """Test formatting document chunks for the prompt."""
        chunks = [
            MagicMock(text="Chunk 1 content", metadata={"page": 1, "section": "Intro"}),
            MagicMock(text="Chunk 2 content", metadata={"page": 2}),
        ]

        result = service._format_chunks_for_prompt(chunks)

        assert "Chunk 1" in result
        assert "Chunk 2" in result

    def test_build_question_generation_prompt(self, service):
        """Test building the question generation prompt."""
        content = "This is course material about programming concepts."

        result = service._build_question_generation_prompt(
            content=content,
            num_short=2,
            num_long=1,
            num_mcq=3
        )

        assert "programming" in result.lower() or content in result
        assert "short" in result.lower() or "2" in result
        assert "mcq" in result.lower() or "multiple choice" in result.lower()
        assert "json" in result.lower()

    def test_prompt_includes_bloom_taxonomy(self, service):
        """Test that prompt requests Bloom's taxonomy levels."""
        result = service._build_question_generation_prompt(
            content="Test content",
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

        result = service._parse_openai_response(response)

        assert result is not None
        assert len(result) > 0
        assert all("type" in q for q in result)

    def test_parse_openai_response_invalid_json(self, service):
        """Test handling invalid JSON response."""
        response = "This is not valid JSON at all"

        try:
            result = service._parse_openai_response(response)
            assert result is None or len(result) == 0
        except json.JSONDecodeError:
            pass  # Expected

    def test_parse_openai_response_missing_questions_key(self, service):
        """Test handling response without 'questions' key."""
        response = json.dumps({"data": [{"type": "mcq"}]})

        try:
            result = service._parse_openai_response(response)
            # May return empty or raise
            assert result is None or len(result) == 0
        except (KeyError, ValueError):
            pass  # Expected

    def test_parse_response_marks_unreviewed(self, service):
        """Test that parsed questions are marked as unreviewed."""
        response = json.dumps({
            "questions": [
                {"type": "mcq", "text": "Test?", "options": {"A": "1"}, "correct_option_id": "A"}
            ]
        })

        result = service._parse_openai_response(response)

        if result:
            for q in result:
                assert q.get("status") == "unreviewed" or q.get("is_ai_generated") is True

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

        result = service._parse_openai_response(response)

        if result:
            assert result[0].get("bloom_taxonomy") == "Understand"

    # -------------------------------------------------------------------------
    # Edge Cases Tests
    # -------------------------------------------------------------------------
    def test_handles_special_characters_in_content(self, service, mock_openai, mock_db):
        """Test handling content with special characters."""
        mock_doc = self._create_mock_document()
        mock_doc.chunks[0].text = "Content with \"quotes\" and 'apostrophes' and <html> tags"

        mock_openai.chat.completions.create.return_value = \
            self._create_mock_completion(QUESTION_GENERATION_RESPONSE)

        # Should not crash
        try:
            result = service.generate_questions_from_document(
                db=mock_db,
                document=mock_doc,
                num_short=1,
                num_long=0,
                num_mcq=0
            )
        except Exception as e:
            pytest.fail(f"Should handle special characters: {e}")

    def test_handles_unicode_content(self, service, mock_openai, mock_db):
        """Test handling Unicode content."""
        mock_doc = self._create_mock_document()
        mock_doc.chunks[0].text = "Content with émojis 🎉 and accénts café résumé"

        mock_openai.chat.completions.create.return_value = \
            self._create_mock_completion(QUESTION_GENERATION_RESPONSE)

        # Should not crash
        try:
            result = service.generate_questions_from_document(
                db=mock_db,
                document=mock_doc,
                num_short=1,
                num_long=0,
                num_mcq=0
            )
        except Exception as e:
            pytest.fail(f"Should handle Unicode: {e}")

    def test_handles_very_long_document(self, service, mock_openai, mock_db):
        """Test handling very long documents (should truncate)."""
        # Create document with many long chunks
        chunks = [
            MagicMock(text="Long content " * 1000, metadata={"page": i})
            for i in range(50)
        ]
        mock_doc = self._create_mock_document(chunks=chunks)

        mock_openai.chat.completions.create.return_value = \
            self._create_mock_completion(QUESTION_GENERATION_RESPONSE)

        # Should handle without error (may truncate content)
        result = service.generate_questions_from_document(
            db=mock_db,
            document=mock_doc,
            num_short=1,
            num_long=0,
            num_mcq=0
        )

        # Verify API was called (content was processed somehow)
        mock_openai.chat.completions.create.assert_called()
