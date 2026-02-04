"""
Unit tests for crud/ai_feedback.py - AI feedback database operations.
"""
import pytest
import uuid
from datetime import datetime, timezone


class TestAIFeedbackCRUD:
    """Tests for AI feedback CRUD operations."""

    @pytest.fixture
    def sample_feedback_data(self, student_answer_mcq):
        """Create sample feedback data."""
        return {
            "answer_id": student_answer_mcq.id,
            "is_correct": True,
            "score": 100,
            "feedback_data": {
                "explanation": "Correct answer!",
                "improvement_hint": "Keep it up!",
            },
            "points_earned": 1.0,
            "points_possible": 1.0,
            "criterion_scores": {
                "accuracy": {"score": 100, "out_of": 100},
            },
            "confidence_level": "high",
        }

    def test_create_feedback(self, db_session, student_answer_mcq, sample_feedback_data):
        """Test creating new AI feedback."""
        from app.crud.ai_feedback import create_feedback
        from app.schemas.ai_feedback import AIFeedbackCreate

        feedback_create = AIFeedbackCreate(**sample_feedback_data)
        result = create_feedback(db_session, feedback_create)

        assert result is not None
        assert result.answer_id == student_answer_mcq.id
        assert result.is_correct is True
        assert result.score == 100

    def test_create_feedback_updates_existing(self, db_session, student_answer_mcq, sample_feedback_data):
        """Test that creating feedback for same answer updates existing."""
        from app.crud.ai_feedback import create_feedback
        from app.schemas.ai_feedback import AIFeedbackCreate

        # Create first feedback
        feedback_create = AIFeedbackCreate(**sample_feedback_data)
        first = create_feedback(db_session, feedback_create)

        # Try to create again with different data
        sample_feedback_data["score"] = 85
        sample_feedback_data["is_correct"] = False
        feedback_create2 = AIFeedbackCreate(**sample_feedback_data)
        second = create_feedback(db_session, feedback_create2)

        # Should update the existing one
        assert second.id == first.id
        assert second.score == 85

    def test_get_feedback_by_answer(self, db_session, student_answer_mcq, sample_feedback_data):
        """Test getting feedback by answer ID."""
        from app.crud.ai_feedback import create_feedback, get_feedback_by_answer
        from app.schemas.ai_feedback import AIFeedbackCreate

        feedback_create = AIFeedbackCreate(**sample_feedback_data)
        created = create_feedback(db_session, feedback_create)

        result = get_feedback_by_answer(db_session, student_answer_mcq.id)

        assert result is not None
        assert result.id == created.id

    def test_get_feedback_by_answer_not_found(self, db_session):
        """Test getting feedback for non-existent answer."""
        from app.crud.ai_feedback import get_feedback_by_answer

        result = get_feedback_by_answer(db_session, uuid.uuid4())

        assert result is None

    def test_get_student_module_feedback(
        self, db_session, student_user, test_module,
        student_answer_mcq, student_answer_text, sample_feedback_data
    ):
        """Test getting all feedback for a student in a module."""
        from app.crud.ai_feedback import create_feedback, get_student_module_feedback
        from app.schemas.ai_feedback import AIFeedbackCreate

        # Create feedback for MCQ answer
        feedback_create = AIFeedbackCreate(**sample_feedback_data)
        create_feedback(db_session, feedback_create)

        # Create feedback for text answer
        sample_feedback_data["answer_id"] = student_answer_text.id
        sample_feedback_data["score"] = 75
        feedback_create2 = AIFeedbackCreate(**sample_feedback_data)
        create_feedback(db_session, feedback_create2)

        result = get_student_module_feedback(
            db_session, student_user.id, test_module.id
        )

        assert len(result) == 2

    def test_delete_feedback(self, db_session, student_answer_mcq, sample_feedback_data):
        """Test deleting feedback."""
        from app.crud.ai_feedback import create_feedback, delete_feedback, get_feedback_by_answer
        from app.schemas.ai_feedback import AIFeedbackCreate

        feedback_create = AIFeedbackCreate(**sample_feedback_data)
        created = create_feedback(db_session, feedback_create)

        result = delete_feedback(db_session, created.id)

        assert result is True
        assert get_feedback_by_answer(db_session, student_answer_mcq.id) is None

    def test_delete_feedback_not_found(self, db_session):
        """Test deleting non-existent feedback."""
        from app.crud.ai_feedback import delete_feedback

        result = delete_feedback(db_session, uuid.uuid4())

        assert result is False


class TestFeedbackStatusTracking:
    """Tests for feedback status tracking functions."""

    def test_create_pending_feedback(self, db_session, student_answer_mcq):
        """Test creating pending feedback placeholder."""
        from app.crud.ai_feedback import create_pending_feedback

        result = create_pending_feedback(db_session, student_answer_mcq.id)

        assert result is not None
        assert result.generation_status == "pending"
        assert result.feedback_data is None
        assert result.generation_progress == 0

    def test_create_pending_feedback_returns_existing(self, db_session, student_answer_mcq):
        """Test creating pending feedback returns existing if present."""
        from app.crud.ai_feedback import create_pending_feedback

        first = create_pending_feedback(db_session, student_answer_mcq.id)
        second = create_pending_feedback(db_session, student_answer_mcq.id)

        assert first.id == second.id

    def test_update_feedback_status(self, db_session, student_answer_mcq):
        """Test updating feedback generation status."""
        from app.crud.ai_feedback import create_pending_feedback, update_feedback_status

        create_pending_feedback(db_session, student_answer_mcq.id)

        result = update_feedback_status(
            db_session,
            student_answer_mcq.id,
            status="generating",
            progress=50
        )

        assert result is not None
        assert result.generation_status == "generating"
        assert result.generation_progress == 50

    def test_complete_feedback_generation(self, db_session, student_answer_mcq):
        """Test marking feedback as completed."""
        from app.crud.ai_feedback import create_pending_feedback, complete_feedback_generation

        create_pending_feedback(db_session, student_answer_mcq.id)

        result = complete_feedback_generation(
            db_session,
            answer_id=student_answer_mcq.id,
            feedback_data={"explanation": "Good job!"},
            is_correct=True,
            score=100,
            points_earned=1.0,
            points_possible=1.0,
            criterion_scores={"accuracy": {"score": 100}},
            confidence_level="high",
            ai_model="gpt-4"
        )

        assert result is not None
        assert result.generation_status == "completed"
        assert result.feedback_data is not None
        assert result.generation_progress == 100

    def test_mark_feedback_failed(self, db_session, student_answer_mcq):
        """Test marking feedback as failed."""
        from app.crud.ai_feedback import create_pending_feedback, mark_feedback_failed

        create_pending_feedback(db_session, student_answer_mcq.id)

        result = mark_feedback_failed(
            db_session,
            student_answer_mcq.id,
            error_message="API timeout",
            error_type="timeout"
        )

        assert result is not None
        assert result.generation_status == "failed"
        assert result.error_message == "API timeout"
        assert result.error_type == "timeout"

    def test_check_and_mark_timeout(self, db_session, student_answer_mcq):
        """Test timeout detection and marking."""
        from app.crud.ai_feedback import create_pending_feedback, check_and_mark_timeout
        from app.models.ai_feedback import AIFeedback
        from datetime import timedelta

        feedback = create_pending_feedback(db_session, student_answer_mcq.id, timeout_seconds=1)

        # Manually set started_at to past
        feedback.started_at = datetime.now(timezone.utc) - timedelta(seconds=10)
        feedback.generation_status = "generating"
        db_session.commit()

        result = check_and_mark_timeout(db_session, student_answer_mcq.id)

        assert result is True
        db_session.refresh(feedback)
        assert feedback.generation_status == "timeout"

    def test_reset_feedback_for_retry(self, db_session, student_answer_mcq):
        """Test resetting feedback for retry."""
        from app.crud.ai_feedback import (
            create_pending_feedback, mark_feedback_failed, reset_feedback_for_retry
        )

        feedback = create_pending_feedback(db_session, student_answer_mcq.id)
        mark_feedback_failed(db_session, student_answer_mcq.id, "Error", "api_error")

        result = reset_feedback_for_retry(db_session, student_answer_mcq.id)

        assert result is not None
        assert result.generation_status == "pending"
        assert result.retry_count == 1
        assert result.error_message is None

    def test_reset_feedback_max_retries_exceeded(self, db_session, student_answer_mcq):
        """Test reset fails when max retries exceeded."""
        from app.crud.ai_feedback import (
            create_pending_feedback, mark_feedback_failed, reset_feedback_for_retry
        )
        from app.models.ai_feedback import AIFeedback

        feedback = create_pending_feedback(db_session, student_answer_mcq.id)
        feedback.retry_count = 3
        feedback.max_retries = 3
        feedback.can_retry = False
        feedback.generation_status = "failed"
        db_session.commit()

        result = reset_feedback_for_retry(db_session, student_answer_mcq.id)

        assert result is None
