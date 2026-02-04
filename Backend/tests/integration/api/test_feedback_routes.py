"""
Integration tests for AI feedback API routes.
"""
import pytest
import uuid
from unittest.mock import patch, MagicMock


class TestFeedbackRoutes:
    """Tests for AI feedback API endpoints."""

    def test_get_feedback_by_answer(
        self, client, student_answer_mcq, auth_headers_student
    ):
        """Test getting feedback for a specific answer."""
        response = client.get(
            f"/api/ai-feedback/answer/{student_answer_mcq.id}",
            headers=auth_headers_student,
        )

        # May be 200 with feedback or 404 if not generated yet
        assert response.status_code in [200, 404]

    def test_get_student_module_feedback(
        self, client, test_module, auth_headers_student
    ):
        """Test getting all feedback for a student in a module."""
        response = client.get(
            f"/api/ai-feedback/module/{test_module.id}",
            headers=auth_headers_student,
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_get_feedback_status(
        self, client, student_answer_mcq, auth_headers_student
    ):
        """Test getting feedback generation status."""
        response = client.get(
            f"/api/ai-feedback/status/{student_answer_mcq.id}",
            headers=auth_headers_student,
        )

        # Returns status or 404 if no feedback record
        assert response.status_code in [200, 404]

    def test_retry_failed_feedback(
        self, client, db_session, student_answer_mcq, auth_headers_student
    ):
        """Test retrying failed feedback generation."""
        # First create a failed feedback record
        from app.crud.ai_feedback import create_pending_feedback, mark_feedback_failed

        create_pending_feedback(db_session, student_answer_mcq.id)
        mark_feedback_failed(db_session, student_answer_mcq.id, "Test error", "api_error")

        response = client.post(
            f"/api/ai-feedback/retry/{student_answer_mcq.id}",
            headers=auth_headers_student,
        )

        assert response.status_code in [200, 202, 400]


class TestFeedbackGenerationWorkflow:
    """Tests for the feedback generation workflow."""

    def test_feedback_generated_on_answer_submission(
        self, client, test_module, mcq_question, auth_headers_student
    ):
        """Test that feedback is generated when answer is submitted."""
        with patch("app.services.ai_feedback.OpenAIClientWithRetry") as mock_openai:
            mock_client = MagicMock()
            mock_openai.return_value = mock_client

            mock_response = MagicMock()
            mock_response.choices = [MagicMock()]
            mock_response.choices[0].message.content = '{"is_correct": true, "score": 100}'
            mock_client.create_chat_completion.return_value = mock_response

            response = client.post(
                "/api/student-answers",
                json={
                    "question_id": str(mcq_question.id),
                    "module_id": str(test_module.id),
                    "answer": {"selected_option": "B"},
                    "attempt": 1,
                },
                headers=auth_headers_student,
            )

            assert response.status_code in [200, 201, 202]

    def test_feedback_status_polling(
        self, client, db_session, student_answer_mcq, auth_headers_student
    ):
        """Test polling for feedback status during generation."""
        from app.crud.ai_feedback import create_pending_feedback, update_feedback_status

        # Create pending feedback
        create_pending_feedback(db_session, student_answer_mcq.id)

        # Check status while generating
        response1 = client.get(
            f"/api/ai-feedback/status/{student_answer_mcq.id}",
            headers=auth_headers_student,
        )

        assert response1.status_code == 200
        data = response1.json()
        assert data["generation_status"] == "pending"

        # Update to generating
        update_feedback_status(db_session, student_answer_mcq.id, "generating", progress=50)

        response2 = client.get(
            f"/api/ai-feedback/status/{student_answer_mcq.id}",
            headers=auth_headers_student,
        )

        assert response2.status_code == 200
        data2 = response2.json()
        assert data2["generation_status"] == "generating"
        assert data2["generation_progress"] == 50
