"""
Integration tests for the complete feedback generation workflow.
Tests end-to-end feedback generation from answer submission to completion.
"""
import pytest
import uuid
from unittest.mock import patch, MagicMock

from tests.fixtures.ai_responses import (
    MCQ_CORRECT_RESPONSE,
    MCQ_INCORRECT_RESPONSE,
    TEXT_GOOD_RESPONSE,
)


class TestFeedbackWorkflow:
    """End-to-end tests for feedback generation workflow."""

    def test_mcq_correct_answer_workflow(
        self, db_session, student_user, test_module, mcq_question
    ):
        """Test complete workflow for correct MCQ answer."""
        from app.models.student_answer import StudentAnswer
        from app.services.ai_feedback import AIFeedbackService

        # Create student answer
        answer = StudentAnswer(
            id=uuid.uuid4(),
            student_id=student_user.id,
            question_id=mcq_question.id,
            module_id=test_module.id,
            answer={"selected_option": "B"},  # Correct answer
            attempt=1,
        )
        db_session.add(answer)
        db_session.commit()

        # Generate feedback
        with patch("app.services.ai_feedback.OpenAIClientWithRetry") as mock_openai:
            mock_client = MagicMock()
            mock_openai.return_value = mock_client

            mock_response = MagicMock()
            mock_response.choices = [MagicMock()]
            mock_response.choices[0].message.content = MCQ_CORRECT_RESPONSE
            mock_client.create_chat_completion.return_value = mock_response

            service = AIFeedbackService()
            service.openai_client = mock_client

            result = service.generate_instant_feedback(
                db=db_session,
                student_answer=answer,
                question_id=str(mcq_question.id),
                module_id=str(test_module.id),
            )

        assert result is not None
        assert result.get("is_correct") is True or result.get("generation_status") == "completed"

    def test_mcq_incorrect_answer_workflow(
        self, db_session, student_user, test_module, mcq_question
    ):
        """Test complete workflow for incorrect MCQ answer."""
        from app.models.student_answer import StudentAnswer
        from app.services.ai_feedback import AIFeedbackService

        answer = StudentAnswer(
            id=uuid.uuid4(),
            student_id=student_user.id,
            question_id=mcq_question.id,
            module_id=test_module.id,
            answer={"selected_option": "A"},  # Wrong answer (correct is B)
            attempt=1,
        )
        db_session.add(answer)
        db_session.commit()

        with patch("app.services.ai_feedback.OpenAIClientWithRetry") as mock_openai:
            mock_client = MagicMock()
            mock_openai.return_value = mock_client

            mock_response = MagicMock()
            mock_response.choices = [MagicMock()]
            mock_response.choices[0].message.content = MCQ_INCORRECT_RESPONSE
            mock_client.create_chat_completion.return_value = mock_response

            service = AIFeedbackService()
            service.openai_client = mock_client

            result = service.generate_instant_feedback(
                db=db_session,
                student_answer=answer,
                question_id=str(mcq_question.id),
                module_id=str(test_module.id),
            )

        assert result is not None
        assert result.get("is_correct") is False or "feedback" in str(result).lower()

    def test_text_answer_workflow(
        self, db_session, student_user, test_module, short_question
    ):
        """Test complete workflow for text answer."""
        from app.models.student_answer import StudentAnswer
        from app.services.ai_feedback import AIFeedbackService

        answer = StudentAnswer(
            id=uuid.uuid4(),
            student_id=student_user.id,
            question_id=short_question.id,
            module_id=test_module.id,
            answer={"text": "Polymorphism allows objects to take many forms in OOP."},
            attempt=1,
        )
        db_session.add(answer)
        db_session.commit()

        with patch("app.services.ai_feedback.OpenAIClientWithRetry") as mock_openai:
            mock_client = MagicMock()
            mock_openai.return_value = mock_client

            mock_response = MagicMock()
            mock_response.choices = [MagicMock()]
            mock_response.choices[0].message.content = TEXT_GOOD_RESPONSE
            mock_client.create_chat_completion.return_value = mock_response

            service = AIFeedbackService()
            service.openai_client = mock_client

            result = service.generate_instant_feedback(
                db=db_session,
                student_answer=answer,
                question_id=str(short_question.id),
                module_id=str(test_module.id),
            )

        assert result is not None

    def test_feedback_retry_after_failure(
        self, db_session, student_user, test_module, mcq_question
    ):
        """Test retrying feedback after initial failure."""
        from app.models.student_answer import StudentAnswer
        from app.crud.ai_feedback import (
            create_pending_feedback, mark_feedback_failed,
            reset_feedback_for_retry, get_feedback_by_answer
        )

        answer = StudentAnswer(
            id=uuid.uuid4(),
            student_id=student_user.id,
            question_id=mcq_question.id,
            module_id=test_module.id,
            answer={"selected_option": "B"},
            attempt=1,
        )
        db_session.add(answer)
        db_session.commit()

        # Create and fail feedback
        create_pending_feedback(db_session, answer.id)
        mark_feedback_failed(db_session, answer.id, "API timeout", "timeout")

        # Verify failed status
        feedback = get_feedback_by_answer(db_session, answer.id)
        assert feedback.generation_status == "failed"
        assert feedback.can_retry is True

        # Reset for retry
        reset_feedback_for_retry(db_session, answer.id)

        feedback = get_feedback_by_answer(db_session, answer.id)
        assert feedback.generation_status == "pending"
        assert feedback.retry_count == 1

    def test_feedback_respects_max_retries(
        self, db_session, student_user, test_module, mcq_question
    ):
        """Test that feedback stops retrying after max attempts."""
        from app.models.student_answer import StudentAnswer
        from app.crud.ai_feedback import (
            create_pending_feedback, mark_feedback_failed,
            reset_feedback_for_retry, get_feedback_by_answer
        )

        answer = StudentAnswer(
            id=uuid.uuid4(),
            student_id=student_user.id,
            question_id=mcq_question.id,
            module_id=test_module.id,
            answer={"selected_option": "B"},
            attempt=1,
        )
        db_session.add(answer)
        db_session.commit()

        # Create feedback and exhaust retries
        feedback = create_pending_feedback(db_session, answer.id)
        feedback.retry_count = 3
        feedback.max_retries = 3
        feedback.can_retry = False
        feedback.generation_status = "failed"
        db_session.commit()

        # Try to retry - should fail
        result = reset_feedback_for_retry(db_session, answer.id)
        assert result is None


class TestFeedbackWithRAG:
    """Tests for feedback generation with RAG context."""

    def test_feedback_with_rag_context(
        self, db_session, student_user, test_module, short_question
    ):
        """Test feedback generation uses RAG context when available."""
        from app.models.student_answer import StudentAnswer
        from app.services.ai_feedback import AIFeedbackService

        answer = StudentAnswer(
            id=uuid.uuid4(),
            student_id=student_user.id,
            question_id=short_question.id,
            module_id=test_module.id,
            answer={"text": "My answer based on course materials."},
            attempt=1,
        )
        db_session.add(answer)
        db_session.commit()

        # Enable RAG in rubric
        test_module.feedback_rubric = {
            "rag_settings": {"enabled": True, "similarity_threshold": 0.7},
        }
        db_session.commit()

        with patch("app.services.ai_feedback.OpenAIClientWithRetry") as mock_openai, \
             patch("app.services.ai_feedback.get_context_for_feedback") as mock_rag:

            mock_rag.return_value = {
                "context": "Relevant course material here.",
                "sources": [{"title": "Lecture 1", "page": 5}],
            }

            mock_client = MagicMock()
            mock_openai.return_value = mock_client

            mock_response = MagicMock()
            mock_response.choices = [MagicMock()]
            mock_response.choices[0].message.content = TEXT_GOOD_RESPONSE
            mock_client.create_chat_completion.return_value = mock_response

            service = AIFeedbackService()
            service.openai_client = mock_client

            result = service.generate_instant_feedback(
                db=db_session,
                student_answer=answer,
                question_id=str(short_question.id),
                module_id=str(test_module.id),
            )

            # RAG should have been called
            mock_rag.assert_called()
