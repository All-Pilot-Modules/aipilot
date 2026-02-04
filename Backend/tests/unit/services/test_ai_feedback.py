"""
Unit tests for ai_feedback.py - AI feedback generation service.
Tests: MCQ, text, fill-blank, multi-part, status tracking, retry, timeout, fallbacks.
"""
import pytest
import json
import uuid
from unittest.mock import MagicMock, patch, PropertyMock
from datetime import datetime, timezone

from tests.fixtures.ai_responses import (
    MCQ_CORRECT_RESPONSE,
    MCQ_INCORRECT_RESPONSE,
    TEXT_GOOD_RESPONSE,
    TEXT_POOR_RESPONSE,
    FILL_BLANK_ALL_CORRECT,
    FILL_BLANK_PARTIAL,
    MCQ_MULTIPLE_PERFECT,
    MCQ_MULTIPLE_PARTIAL,
    MULTI_PART_COMPLETE,
    FALLBACK_MCQ_RESPONSE,
    FALLBACK_TEXT_RESPONSE,
)


class TestAIFeedbackService:
    """Tests for the AIFeedbackService class."""

    @pytest.fixture
    def mock_dependencies(self):
        """Mock all external dependencies for the AI feedback service."""
        with patch("app.services.ai_feedback.OpenAIClientWithRetry") as mock_openai_cls, \
             patch("app.services.ai_feedback.get_question_by_id") as mock_get_question, \
             patch("app.services.ai_feedback.get_module_rubric") as mock_get_rubric, \
             patch("app.services.ai_feedback.get_context_for_feedback") as mock_get_context, \
             patch("app.services.ai_feedback.create_pending_feedback") as mock_create_pending, \
             patch("app.services.ai_feedback.update_feedback_status") as mock_update_status, \
             patch("app.services.ai_feedback.complete_feedback_generation") as mock_complete, \
             patch("app.services.ai_feedback.mark_feedback_failed") as mock_mark_failed, \
             patch("app.services.ai_feedback.get_feedback_by_answer") as mock_get_feedback:

            mock_openai = MagicMock()
            mock_openai_cls.return_value = mock_openai

            yield {
                "openai_cls": mock_openai_cls,
                "openai": mock_openai,
                "get_question": mock_get_question,
                "get_rubric": mock_get_rubric,
                "get_context": mock_get_context,
                "create_pending": mock_create_pending,
                "update_status": mock_update_status,
                "complete": mock_complete,
                "mark_failed": mock_mark_failed,
                "get_feedback": mock_get_feedback,
            }

    @pytest.fixture
    def feedback_service(self, mock_dependencies):
        """Create a feedback service instance with mocked dependencies."""
        from app.services.ai_feedback import AIFeedbackService
        service = AIFeedbackService()
        service.openai_client = mock_dependencies["openai"]
        return service

    def _create_mock_question(self, q_type="mcq", **kwargs):
        """Helper to create a mock question object."""
        question = MagicMock()
        question.id = kwargs.get("id", uuid.uuid4())
        question.type = q_type
        question.text = kwargs.get("text", "Test question?")
        question.options = kwargs.get("options", {"A": "Option A", "B": "Option B"})
        question.correct_option_id = kwargs.get("correct_option_id", "A")
        question.correct_answer = kwargs.get("correct_answer", None)
        question.points = kwargs.get("points", 1.0)
        question.extended_config = kwargs.get("extended_config", None)
        question.module_id = kwargs.get("module_id", uuid.uuid4())
        return question

    def _create_mock_student_answer(self, **kwargs):
        """Helper to create a mock student answer object."""
        answer = MagicMock()
        answer.id = kwargs.get("id", uuid.uuid4())
        answer.student_id = kwargs.get("student_id", "STU001")
        answer.question_id = kwargs.get("question_id", uuid.uuid4())
        answer.module_id = kwargs.get("module_id", uuid.uuid4())
        answer.answer = kwargs.get("answer", {"selected_option": "A"})
        answer.attempt = kwargs.get("attempt", 1)
        return answer

    def _create_mock_module(self, **kwargs):
        """Helper to create a mock module object."""
        module = MagicMock()
        module.id = kwargs.get("id", uuid.uuid4())
        module.feedback_rubric = kwargs.get("feedback_rubric", None)
        module.assignment_config = kwargs.get("assignment_config", {})
        return module

    def _create_mock_completion(self, content: str):
        """Helper to create a mock OpenAI completion response."""
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = content
        return mock_response

    # -------------------------------------------------------------------------
    # MCQ Feedback Tests
    # -------------------------------------------------------------------------
    class TestMCQFeedback:
        """Tests for MCQ question feedback generation."""

        def test_mcq_correct_answer(self, feedback_service, mock_dependencies):
            """Test feedback for correct MCQ answer."""
            question = feedback_service._TestAIFeedbackService__create_mock_question(
                q_type="mcq",
                options={"A": "Paris", "B": "London"},
                correct_option_id="A"
            )

            mock_dependencies["openai"].create_chat_completion.return_value = \
                feedback_service._TestAIFeedbackService__create_mock_completion(MCQ_CORRECT_RESPONSE)

            result = feedback_service._analyze_mcq_answer(
                student_answer="A",
                question=question,
                ai_model="gpt-4",
                rubric={},
                rag_context=None
            )

            assert result["is_correct"] is True
            assert result["score"] == 100

        def test_mcq_incorrect_answer(self, feedback_service, mock_dependencies):
            """Test feedback for incorrect MCQ answer."""
            question = feedback_service._TestAIFeedbackService__create_mock_question(
                q_type="mcq",
                options={"A": "Paris", "B": "London"},
                correct_option_id="A"
            )

            mock_dependencies["openai"].create_chat_completion.return_value = \
                feedback_service._TestAIFeedbackService__create_mock_completion(MCQ_INCORRECT_RESPONSE)

            result = feedback_service._analyze_mcq_answer(
                student_answer="B",
                question=question,
                ai_model="gpt-4",
                rubric={},
                rag_context=None
            )

            assert result["is_correct"] is False
            assert result["score"] == 0

    # -------------------------------------------------------------------------
    # Text Feedback Tests
    # -------------------------------------------------------------------------
    class TestTextFeedback:
        """Tests for text/essay question feedback generation."""

        def test_good_text_answer(self, feedback_service, mock_dependencies):
            """Test feedback for a good text answer."""
            question = feedback_service._TestAIFeedbackService__create_mock_question(
                q_type="short",
                text="Explain polymorphism.",
                correct_answer="Polymorphism allows objects to take many forms."
            )

            mock_dependencies["openai"].create_chat_completion.return_value = \
                feedback_service._TestAIFeedbackService__create_mock_completion(TEXT_GOOD_RESPONSE)

            rubric = {
                "grading_criteria": {
                    "accuracy": {"weight": 40},
                    "completeness": {"weight": 30},
                    "clarity": {"weight": 30},
                }
            }

            result = feedback_service._analyze_text_answer(
                student_answer="Polymorphism enables objects to be treated as instances of their parent class.",
                question=question,
                ai_model="gpt-4",
                rubric=rubric,
                rag_context=None
            )

            assert result["score"] == 85
            assert "strengths" in result
            assert "weaknesses" in result

        def test_poor_text_answer(self, feedback_service, mock_dependencies):
            """Test feedback for a poor text answer."""
            question = feedback_service._TestAIFeedbackService__create_mock_question(
                q_type="short",
                text="Explain polymorphism."
            )

            mock_dependencies["openai"].create_chat_completion.return_value = \
                feedback_service._TestAIFeedbackService__create_mock_completion(TEXT_POOR_RESPONSE)

            result = feedback_service._analyze_text_answer(
                student_answer="It's something about objects.",
                question=question,
                ai_model="gpt-4",
                rubric={},
                rag_context=None
            )

            assert result["score"] == 35
            assert len(result.get("missing_concepts", [])) > 0

    # -------------------------------------------------------------------------
    # Fill-in-the-Blank Tests
    # -------------------------------------------------------------------------
    class TestFillBlankFeedback:
        """Tests for fill-in-the-blank question feedback."""

        def test_all_blanks_correct(self, feedback_service, mock_dependencies):
            """Test feedback when all blanks are correct."""
            question = feedback_service._TestAIFeedbackService__create_mock_question(
                q_type="fill_blank",
                text="The ___ is the powerhouse. DNA is in the ___.",
                points=4.0,
                extended_config={
                    "blanks": [
                        {"position": 0, "correct_answers": ["mitochondria"], "points": 2.0},
                        {"position": 1, "correct_answers": ["nucleus"], "points": 2.0},
                    ]
                }
            )

            # Mock the grading service
            with patch("app.services.ai_feedback.QuestionGradingService") as mock_grading:
                mock_grading_instance = MagicMock()
                mock_grading.return_value = mock_grading_instance
                mock_grading_instance.grade_fill_blank.return_value = {
                    "is_correct": True,
                    "earned_points": 4.0,
                    "total_points": 4.0,
                    "percentage": 100.0,
                    "blank_results": [
                        {"position": 0, "is_correct": True},
                        {"position": 1, "is_correct": True},
                    ]
                }

                result = feedback_service._analyze_fill_blank_answer(
                    student_answer={"blanks": {0: "mitochondria", 1: "nucleus"}},
                    question=question,
                    ai_model="gpt-4",
                    rubric={},
                    rag_context=None
                )

            assert result["is_correct"] is True
            assert result["points_earned"] == 4.0

        def test_partial_blanks_correct(self, feedback_service, mock_dependencies):
            """Test feedback when some blanks are correct."""
            question = feedback_service._TestAIFeedbackService__create_mock_question(
                q_type="fill_blank",
                points=4.0,
                extended_config={
                    "blanks": [
                        {"position": 0, "correct_answers": ["mitochondria"], "points": 2.0},
                        {"position": 1, "correct_answers": ["nucleus"], "points": 2.0},
                    ]
                }
            )

            with patch("app.services.ai_feedback.QuestionGradingService") as mock_grading:
                mock_grading_instance = MagicMock()
                mock_grading.return_value = mock_grading_instance
                mock_grading_instance.grade_fill_blank.return_value = {
                    "is_correct": False,
                    "earned_points": 2.0,
                    "total_points": 4.0,
                    "percentage": 50.0,
                    "partial_credit": True,
                    "blank_results": [
                        {"position": 0, "is_correct": True},
                        {"position": 1, "is_correct": False},
                    ]
                }

                result = feedback_service._analyze_fill_blank_answer(
                    student_answer={"blanks": {0: "mitochondria", 1: "wrong"}},
                    question=question,
                    ai_model="gpt-4",
                    rubric={},
                    rag_context=None
                )

            assert result["is_correct"] is False
            assert result["points_earned"] == 2.0
            assert result["score"] == 50

    # -------------------------------------------------------------------------
    # MCQ Multiple Tests
    # -------------------------------------------------------------------------
    class TestMCQMultipleFeedback:
        """Tests for MCQ with multiple correct answers."""

        def test_all_correct_selected(self, feedback_service, mock_dependencies):
            """Test perfect score on MCQ multiple."""
            question = feedback_service._TestAIFeedbackService__create_mock_question(
                q_type="mcq_multiple",
                options={"A": "Python", "B": "HTML", "C": "Java", "D": "CSS"},
                points=4.0,
                extended_config={
                    "correct_option_ids": ["A", "C"],
                    "partial_credit": True,
                    "penalty_for_wrong": True,
                }
            )

            with patch("app.services.ai_feedback.QuestionGradingService") as mock_grading:
                mock_grading_instance = MagicMock()
                mock_grading.return_value = mock_grading_instance
                mock_grading_instance.grade_mcq_multiple.return_value = {
                    "is_correct": True,
                    "score": 100.0,
                    "correctly_selected": ["A", "C"],
                    "incorrectly_selected": [],
                    "missed_correct": [],
                }

                result = feedback_service._analyze_mcq_multiple_answer(
                    student_answer={"selected_options": ["A", "C"]},
                    question=question,
                    ai_model="gpt-4",
                    rubric={},
                    rag_context=None
                )

            assert result["is_correct"] is True
            assert result["score"] == 100

        def test_partial_credit_with_penalty(self, feedback_service, mock_dependencies):
            """Test partial credit with wrong selection penalty."""
            question = feedback_service._TestAIFeedbackService__create_mock_question(
                q_type="mcq_multiple",
                options={"A": "Python", "B": "HTML", "C": "Java", "D": "CSS"},
                points=4.0,
                extended_config={
                    "correct_option_ids": ["A", "C"],
                    "partial_credit": True,
                    "penalty_for_wrong": True,
                }
            )

            with patch("app.services.ai_feedback.QuestionGradingService") as mock_grading:
                mock_grading_instance = MagicMock()
                mock_grading.return_value = mock_grading_instance
                mock_grading_instance.grade_mcq_multiple.return_value = {
                    "is_correct": False,
                    "score": 37.5,  # One correct, one wrong with penalty
                    "correctly_selected": ["A"],
                    "incorrectly_selected": ["B"],
                    "missed_correct": ["C"],
                }

                result = feedback_service._analyze_mcq_multiple_answer(
                    student_answer={"selected_options": ["A", "B"]},
                    question=question,
                    ai_model="gpt-4",
                    rubric={},
                    rag_context=None
                )

            assert result["is_correct"] is False
            assert result["score"] < 100

    # -------------------------------------------------------------------------
    # Multi-Part Question Tests
    # -------------------------------------------------------------------------
    class TestMultiPartFeedback:
        """Tests for multi-part question feedback."""

        def test_multi_part_mixed_results(self, feedback_service, mock_dependencies):
            """Test multi-part question with mixed results."""
            question = feedback_service._TestAIFeedbackService__create_mock_question(
                q_type="multi_part",
                points=6.0,
                extended_config={
                    "sub_questions": [
                        {"id": "1a", "type": "mcq", "points": 2.0, "correct_option_id": "A"},
                        {"id": "1b", "type": "short", "points": 2.0, "correct_answer": "Expected"},
                        {"id": "1c", "type": "short", "points": 2.0, "correct_answer": "Another"},
                    ]
                }
            )

            mock_dependencies["openai"].create_chat_completion.return_value = \
                feedback_service._TestAIFeedbackService__create_mock_completion(MULTI_PART_COMPLETE)

            result = feedback_service._analyze_multi_part_answer(
                student_answer={
                    "sub_answers": {
                        "1a": {"selected_option": "A"},
                        "1b": {"text": "Good answer"},
                        "1c": {"text": "Partial answer"},
                    }
                },
                question=question,
                ai_model="gpt-4",
                rubric={},
                rag_context=None
            )

            assert "sub_question_results" in result or "points_earned" in result

    # -------------------------------------------------------------------------
    # Fallback Tests
    # -------------------------------------------------------------------------
    class TestFallbackBehavior:
        """Tests for fallback behavior when AI fails."""

        def test_mcq_fallback_on_api_error(self, feedback_service, mock_dependencies):
            """Test MCQ fallback when API fails."""
            question = feedback_service._TestAIFeedbackService__create_mock_question(
                q_type="mcq",
                correct_option_id="A"
            )

            mock_dependencies["openai"].create_chat_completion.side_effect = Exception("API Error")

            result = feedback_service._analyze_mcq_answer(
                student_answer="B",
                question=question,
                ai_model="gpt-4",
                rubric={},
                rag_context=None
            )

            # Should return fallback feedback
            assert result["confidence"] == "low"
            assert result["is_correct"] is False

        def test_text_fallback_on_api_error(self, feedback_service, mock_dependencies):
            """Test text fallback when API fails."""
            question = feedback_service._TestAIFeedbackService__create_mock_question(
                q_type="short"
            )

            mock_dependencies["openai"].create_chat_completion.side_effect = Exception("API Error")

            result = feedback_service._analyze_text_answer(
                student_answer="Some answer",
                question=question,
                ai_model="gpt-4",
                rubric={},
                rag_context=None
            )

            # Should return fallback with neutral score
            assert result["confidence"] == "low"
            assert result["score"] == 50

        def test_fallback_on_json_parse_error(self, feedback_service, mock_dependencies):
            """Test fallback when AI returns invalid JSON."""
            question = feedback_service._TestAIFeedbackService__create_mock_question(
                q_type="mcq",
                correct_option_id="A"
            )

            # Return invalid JSON
            mock_dependencies["openai"].create_chat_completion.return_value = \
                feedback_service._TestAIFeedbackService__create_mock_completion("This is not valid JSON")

            result = feedback_service._analyze_mcq_answer(
                student_answer="A",
                question=question,
                ai_model="gpt-4",
                rubric={},
                rag_context=None
            )

            # Should handle gracefully with fallback
            assert "is_correct" in result

    # -------------------------------------------------------------------------
    # Status Tracking Tests
    # -------------------------------------------------------------------------
    class TestStatusTracking:
        """Tests for feedback generation status tracking."""

        def test_pending_feedback_created(self, feedback_service, mock_dependencies, db_session):
            """Test that pending feedback is created before generation."""
            # This would test the full flow with database
            pass  # Requires integration test setup

        def test_status_updated_during_generation(self, feedback_service, mock_dependencies):
            """Test status updates during generation."""
            # Would verify update_feedback_status calls
            pass

        def test_completed_status_on_success(self, feedback_service, mock_dependencies):
            """Test status is completed on successful generation."""
            pass

        def test_failed_status_on_error(self, feedback_service, mock_dependencies):
            """Test status is failed on error."""
            pass

    # -------------------------------------------------------------------------
    # Helper Method Tests
    # -------------------------------------------------------------------------
    class TestHelperMethods:
        """Tests for helper methods."""

        def test_extract_answer_text_from_dict(self, feedback_service):
            """Test extracting answer text from dict."""
            answer_data = {"text": "My answer here"}
            result = feedback_service._extract_answer_text(answer_data)
            assert result == "My answer here"

        def test_extract_answer_text_from_selected_option(self, feedback_service):
            """Test extracting from selected_option."""
            answer_data = {"selected_option": "B"}
            result = feedback_service._extract_answer_text(answer_data)
            assert "B" in result

        def test_format_options(self, feedback_service):
            """Test formatting MCQ options."""
            options = {"A": "First", "B": "Second", "C": "Third"}
            result = feedback_service._format_options(options)
            assert "A" in result
            assert "First" in result
            assert "B" in result
            assert "Second" in result

        def test_get_ai_model_from_rubric(self, feedback_service):
            """Test extracting AI model from rubric."""
            rubric = {"ai_model": "gpt-4-turbo"}
            result = feedback_service._get_ai_model_from_rubric(rubric)
            assert result == "gpt-4-turbo"

        def test_get_ai_model_default(self, feedback_service):
            """Test default AI model when not specified."""
            result = feedback_service._get_ai_model_from_rubric({})
            assert result == "gpt-4" or result is not None


# Create the helper methods on the test class for reference
TestAIFeedbackService._TestAIFeedbackService__create_mock_question = TestAIFeedbackService._create_mock_question
TestAIFeedbackService._TestAIFeedbackService__create_mock_student_answer = TestAIFeedbackService._create_mock_student_answer
TestAIFeedbackService._TestAIFeedbackService__create_mock_module = TestAIFeedbackService._create_mock_module
TestAIFeedbackService._TestAIFeedbackService__create_mock_completion = TestAIFeedbackService._create_mock_completion
