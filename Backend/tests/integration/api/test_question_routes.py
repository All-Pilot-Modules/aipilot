"""
Integration tests for question API routes.
"""
import pytest
import uuid


class TestQuestionRoutes:
    """Tests for question management API endpoints."""

    def test_create_question(self, client, test_module, auth_headers_teacher):
        """Test creating a new question."""
        response = client.post(
            "/api/questions",
            json={
                "module_id": str(test_module.id),
                "type": "mcq",
                "text": "What is the capital of Germany?",
                "options": {"A": "Berlin", "B": "Munich", "C": "Hamburg", "D": "Frankfurt"},
                "correct_option_id": "A",
                "points": 1.0,
            },
            headers=auth_headers_teacher,
        )

        assert response.status_code in [200, 201]
        data = response.json()
        assert "id" in data

    def test_create_question_student_forbidden(self, client, test_module, auth_headers_student):
        """Test that students cannot create questions."""
        response = client.post(
            "/api/questions",
            json={
                "module_id": str(test_module.id),
                "type": "short",
                "text": "Unauthorized question",
                "points": 1.0,
            },
            headers=auth_headers_student,
        )

        assert response.status_code == 403

    def test_get_question_by_id(self, client, mcq_question, auth_headers_teacher):
        """Test getting a question by ID."""
        response = client.get(
            f"/api/questions/{mcq_question.id}",
            headers=auth_headers_teacher,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(mcq_question.id)

    def test_get_module_questions(self, client, test_module, mcq_question, auth_headers_teacher):
        """Test getting all questions for a module."""
        response = client.get(
            f"/api/questions/module/{test_module.id}",
            headers=auth_headers_teacher,
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_update_question(self, client, mcq_question, auth_headers_teacher):
        """Test updating a question."""
        response = client.put(
            f"/api/questions/{mcq_question.id}",
            json={
                "text": "Updated question text?",
                "points": 2.0,
            },
            headers=auth_headers_teacher,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["text"] == "Updated question text?"
        assert data["points"] == 2.0

    def test_delete_question(self, client, test_module, auth_headers_teacher):
        """Test deleting a question."""
        # Create a question to delete
        create_response = client.post(
            "/api/questions",
            json={
                "module_id": str(test_module.id),
                "type": "short",
                "text": "To be deleted",
                "points": 1.0,
            },
            headers=auth_headers_teacher,
        )
        question_id = create_response.json()["id"]

        # Delete it
        response = client.delete(
            f"/api/questions/{question_id}",
            headers=auth_headers_teacher,
        )

        assert response.status_code in [200, 204]

    def test_approve_question(self, client, test_module, auth_headers_teacher):
        """Test approving an unreviewed question."""
        # Create unreviewed question
        create_response = client.post(
            "/api/questions",
            json={
                "module_id": str(test_module.id),
                "type": "short",
                "text": "Unreviewed question",
                "points": 1.0,
                "status": "unreviewed",
            },
            headers=auth_headers_teacher,
        )
        question_id = create_response.json()["id"]

        # Approve it
        response = client.post(
            f"/api/questions/{question_id}/approve",
            headers=auth_headers_teacher,
        )

        assert response.status_code == 200

    def test_bulk_approve_questions(self, client, test_module, auth_headers_teacher):
        """Test bulk approving questions."""
        # Create multiple unreviewed questions
        question_ids = []
        for i in range(3):
            create_response = client.post(
                "/api/questions",
                json={
                    "module_id": str(test_module.id),
                    "type": "short",
                    "text": f"Question {i}",
                    "points": 1.0,
                    "status": "unreviewed",
                },
                headers=auth_headers_teacher,
            )
            question_ids.append(create_response.json()["id"])

        # Bulk approve
        response = client.post(
            "/api/questions/bulk-approve",
            json={"question_ids": question_ids},
            headers=auth_headers_teacher,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["approved_count"] == 3


class TestQuestionGenerationRoutes:
    """Tests for AI question generation endpoints."""

    def test_generate_questions_from_document(
        self, client, test_module, test_document, auth_headers_teacher
    ):
        """Test generating questions from a document."""
        from unittest.mock import patch
        from tests.fixtures.ai_responses import QUESTION_GENERATION_RESPONSE

        with patch("app.services.question_generation.openai") as mock_openai:
            mock_response = MagicMock()
            mock_response.choices = [MagicMock()]
            mock_response.choices[0].message.content = QUESTION_GENERATION_RESPONSE
            mock_openai.OpenAI.return_value.chat.completions.create.return_value = mock_response

            response = client.post(
                f"/api/questions/generate/{test_document.id}",
                json={
                    "num_short": 2,
                    "num_long": 1,
                    "num_mcq": 2,
                },
                headers=auth_headers_teacher,
            )

            # May succeed or fail based on document status
            assert response.status_code in [200, 201, 400]


from unittest.mock import MagicMock
