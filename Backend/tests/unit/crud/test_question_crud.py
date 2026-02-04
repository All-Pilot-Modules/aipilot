"""
Unit tests for crud/question.py - Question database operations.
"""
import pytest
import uuid


class TestQuestionCRUD:
    """Tests for question CRUD operations."""

    def test_create_question(self, db_session, test_module):
        """Test creating a new question."""
        from app.crud.question import create_question
        from app.schemas.question import QuestionCreate

        question_data = QuestionCreate(
            module_id=test_module.id,
            type="mcq",
            text="What is 2 + 2?",
            options={"A": "3", "B": "4", "C": "5", "D": "6"},
            correct_option_id="B",
            points=1.0,
        )

        result = create_question(db_session, question_data)

        assert result is not None
        assert result.text == "What is 2 + 2?"
        assert result.type == "mcq"
        assert result.correct_option_id == "B"

    def test_create_question_auto_order(self, db_session, test_module):
        """Test that question order is auto-assigned."""
        from app.crud.question import create_question
        from app.schemas.question import QuestionCreate

        # Create first question
        q1 = QuestionCreate(
            module_id=test_module.id,
            type="short",
            text="Question 1",
            points=1.0,
        )
        result1 = create_question(db_session, q1)

        # Create second question
        q2 = QuestionCreate(
            module_id=test_module.id,
            type="short",
            text="Question 2",
            points=1.0,
        )
        result2 = create_question(db_session, q2)

        assert result1.question_order == 1
        assert result2.question_order == 2

    def test_bulk_create_questions(self, db_session, test_module):
        """Test bulk creating questions."""
        from app.crud.question import bulk_create_questions
        from app.schemas.question import QuestionCreate

        questions = [
            QuestionCreate(
                module_id=test_module.id,
                type="mcq",
                text=f"Question {i}",
                options={"A": "Yes", "B": "No"},
                correct_option_id="A",
                points=1.0,
            )
            for i in range(5)
        ]

        result = bulk_create_questions(db_session, questions)

        assert len(result) == 5

    def test_get_question_by_id(self, db_session, mcq_question):
        """Test getting a question by ID."""
        from app.crud.question import get_question_by_id

        result = get_question_by_id(db_session, mcq_question.id)

        assert result is not None
        assert result.id == mcq_question.id

    def test_get_question_by_id_not_found(self, db_session):
        """Test getting non-existent question."""
        from app.crud.question import get_question_by_id

        result = get_question_by_id(db_session, uuid.uuid4())

        assert result is None

    def test_get_questions_by_module_id(self, db_session, test_module, mcq_question, short_question):
        """Test getting all questions for a module."""
        from app.crud.question import get_questions_by_module_id

        result = get_questions_by_module_id(db_session, test_module.id)

        assert len(result) >= 2
        assert all(q.module_id == test_module.id for q in result)

    def test_get_questions_by_module_id_ordered(self, db_session, test_module, mcq_question, short_question):
        """Test that questions are returned in order."""
        from app.crud.question import get_questions_by_module_id

        result = get_questions_by_module_id(db_session, test_module.id)

        # Should be ordered by question_order
        orders = [q.question_order for q in result if q.question_order is not None]
        assert orders == sorted(orders)

    def test_update_question(self, db_session, mcq_question):
        """Test updating a question."""
        from app.crud.question import update_question
        from app.schemas.question import QuestionUpdate

        update_data = QuestionUpdate(
            text="Updated question text",
            points=2.0,
        )

        result = update_question(db_session, mcq_question.id, update_data)

        assert result is not None
        assert result.text == "Updated question text"
        assert result.points == 2.0

    def test_update_question_not_found(self, db_session):
        """Test updating non-existent question."""
        from app.crud.question import update_question
        from app.schemas.question import QuestionUpdate

        result = update_question(db_session, uuid.uuid4(), QuestionUpdate(text="New"))

        assert result is None

    def test_delete_question(self, db_session, test_module):
        """Test deleting a question."""
        from app.crud.question import create_question, delete_question, get_question_by_id
        from app.schemas.question import QuestionCreate

        # Create a question to delete
        q = QuestionCreate(
            module_id=test_module.id,
            type="short",
            text="To be deleted",
            points=1.0,
        )
        created = create_question(db_session, q)
        question_id = created.id

        result = delete_question(db_session, question_id)

        assert result is not None
        assert get_question_by_id(db_session, question_id) is None

    def test_delete_question_not_found(self, db_session):
        """Test deleting non-existent question."""
        from app.crud.question import delete_question

        result = delete_question(db_session, uuid.uuid4())

        assert result is None


class TestQuestionStatusOperations:
    """Tests for question status operations."""

    def test_get_questions_by_status(self, db_session, test_module):
        """Test filtering questions by status."""
        from app.crud.question import create_question, get_questions_by_status
        from app.schemas.question import QuestionCreate

        # Create questions with different statuses
        active_q = QuestionCreate(
            module_id=test_module.id,
            type="short",
            text="Active question",
            points=1.0,
            status="active",
        )
        create_question(db_session, active_q)

        unreviewed_q = QuestionCreate(
            module_id=test_module.id,
            type="short",
            text="Unreviewed question",
            points=1.0,
            status="unreviewed",
        )
        create_question(db_session, unreviewed_q)

        active_result = get_questions_by_status(db_session, test_module.id, "active")
        unreviewed_result = get_questions_by_status(db_session, test_module.id, "unreviewed")

        assert all(q.status == "active" for q in active_result)
        assert all(q.status == "unreviewed" for q in unreviewed_result)

    def test_approve_question(self, db_session, test_module):
        """Test approving a question."""
        from app.crud.question import create_question, approve_question
        from app.schemas.question import QuestionCreate

        # Create unreviewed question
        q = QuestionCreate(
            module_id=test_module.id,
            type="short",
            text="Unreviewed",
            points=1.0,
            status="unreviewed",
        )
        created = create_question(db_session, q)

        result = approve_question(db_session, created.id)

        assert result is not None
        assert result.status == "active"

    def test_approve_question_not_found(self, db_session):
        """Test approving non-existent question."""
        from app.crud.question import approve_question

        result = approve_question(db_session, uuid.uuid4())

        assert result is None

    def test_bulk_approve_questions(self, db_session, test_module):
        """Test bulk approving questions."""
        from app.crud.question import create_question, bulk_approve_questions
        from app.schemas.question import QuestionCreate

        # Create multiple unreviewed questions
        questions = []
        for i in range(3):
            q = QuestionCreate(
                module_id=test_module.id,
                type="short",
                text=f"Question {i}",
                points=1.0,
                status="unreviewed",
            )
            questions.append(create_question(db_session, q))

        question_ids = [q.id for q in questions]
        result = bulk_approve_questions(db_session, question_ids)

        assert result["approved_count"] == 3
        assert result["failed_count"] == 0

    def test_bulk_approve_partial_failure(self, db_session, test_module):
        """Test bulk approve with some invalid IDs."""
        from app.crud.question import create_question, bulk_approve_questions
        from app.schemas.question import QuestionCreate

        q = QuestionCreate(
            module_id=test_module.id,
            type="short",
            text="Valid question",
            points=1.0,
            status="unreviewed",
        )
        created = create_question(db_session, q)

        # Mix valid and invalid IDs
        question_ids = [created.id, uuid.uuid4(), uuid.uuid4()]
        result = bulk_approve_questions(db_session, question_ids)

        assert result["approved_count"] == 1
        assert result["failed_count"] == 2
