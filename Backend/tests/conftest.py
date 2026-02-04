"""
Root conftest.py - Test infrastructure for AI Pilot Backend
Provides: SQLite in-memory DB, TestClient, auth fixtures, mock factories
"""
import os
import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

# Set test environment variables BEFORE importing app modules
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test-secret-key-for-testing-only")
os.environ.setdefault("OPENAI_API_KEY", "sk-test-fake-key")
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-service-key")
os.environ.setdefault("ENV", "testing")
os.environ.setdefault("LLM_MODEL", "gpt-4")
os.environ.setdefault("EMBED_MODEL", "text-embedding-ada-002")

from app.database import Base, get_db
from app.models.user import User
from app.models.module import Module
from app.models.question import Question
from app.models.student_answer import StudentAnswer
from app.models.ai_feedback import AIFeedback
from app.models.document import Document
from app.models.document_chunk import DocumentChunk
from app.models.document_embedding import DocumentEmbedding
from app.models.student_enrollment import StudentEnrollment
from app.models.survey_response import SurveyResponse
from app.models.test_submission import TestSubmission
from app.models.chat_conversation import ChatConversation
from app.models.chat_message import ChatMessage
from app.core.auth import create_access_token


# ---------------------------------------------------------------------------
# SQLite Type Compatibility: Compile PostgreSQL types as SQLite equivalents
# ---------------------------------------------------------------------------
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB as PG_JSONB
from sqlalchemy import String, Text
from sqlalchemy.ext.compiler import compiles


@compiles(PG_UUID, "sqlite")
def compile_uuid_sqlite(type_, compiler, **kw):
    return "VARCHAR(36)"


@compiles(PG_JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "TEXT"


# ---------------------------------------------------------------------------
# Database Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def engine():
    """Create SQLite in-memory engine for the test session."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )

    # Enable foreign keys in SQLite
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    return engine


@pytest.fixture(scope="session")
def tables(engine):
    """Create all tables once for the test session."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session(engine, tables) -> Session:
    """Provide a transactional database session that rolls back after each test."""
    connection = engine.connect()
    transaction = connection.begin()
    session = sessionmaker(bind=connection)()

    yield session

    session.close()
    transaction.rollback()
    connection.close()


# ---------------------------------------------------------------------------
# FastAPI TestClient
# ---------------------------------------------------------------------------
@pytest.fixture
def client(db_session) -> TestClient:
    """Create a FastAPI TestClient with DB dependency override."""
    from main import app

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# User & Auth Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture
def teacher_user(db_session) -> User:
    """Create a teacher user in the test database."""
    from app.core.auth import get_password_hash

    user = User(
        id="TEACHER001",
        username="testteacher",
        email="teacher@test.com",
        hashed_password=get_password_hash("password123"),
        role="teacher",
        is_active=True,
        is_email_verified=True,
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(user)
    db_session.flush()
    return user


@pytest.fixture
def student_user(db_session) -> User:
    """Create a student user in the test database."""
    from app.core.auth import get_password_hash

    user = User(
        id="STUDENT001",
        username="teststudent",
        email="student@test.com",
        hashed_password=get_password_hash("password123"),
        role="student",
        is_active=True,
        is_email_verified=True,
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(user)
    db_session.flush()
    return user


@pytest.fixture
def admin_user(db_session) -> User:
    """Create an admin user in the test database."""
    from app.core.auth import get_password_hash

    user = User(
        id="ADMIN001",
        username="testadmin",
        email="admin@test.com",
        hashed_password=get_password_hash("password123"),
        role="admin",
        is_active=True,
        is_email_verified=True,
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(user)
    db_session.flush()
    return user


@pytest.fixture
def teacher_token(teacher_user) -> str:
    """Generate a valid JWT token for the teacher user."""
    return create_access_token(data={"sub": teacher_user.id})


@pytest.fixture
def student_token(student_user) -> str:
    """Generate a valid JWT token for the student user."""
    return create_access_token(data={"sub": student_user.id})


@pytest.fixture
def admin_token(admin_user) -> str:
    """Generate a valid JWT token for the admin user."""
    return create_access_token(data={"sub": admin_user.id})


@pytest.fixture
def auth_headers_teacher(teacher_token) -> dict:
    """Authorization headers for teacher."""
    return {"Authorization": f"Bearer {teacher_token}"}


@pytest.fixture
def auth_headers_student(student_token) -> dict:
    """Authorization headers for student."""
    return {"Authorization": f"Bearer {student_token}"}


@pytest.fixture
def auth_headers_admin(admin_token) -> dict:
    """Authorization headers for admin."""
    return {"Authorization": f"Bearer {admin_token}"}


# ---------------------------------------------------------------------------
# Module Fixture
# ---------------------------------------------------------------------------
@pytest.fixture
def test_module(db_session, teacher_user) -> Module:
    """Create a test module."""
    module = Module(
        id=uuid.uuid4(),
        teacher_id=teacher_user.id,
        name=f"Test Module {uuid.uuid4().hex[:6]}",
        access_code=f"TEST{uuid.uuid4().hex[:6].upper()}",
        is_active=True,
        consent_required=False,
        feedback_rubric={
            "grading_criteria": {
                "accuracy": {"weight": 40, "description": "Correctness of answer"},
                "completeness": {"weight": 30, "description": "Coverage of key points"},
                "clarity": {"weight": 30, "description": "Clear expression"},
            },
            "feedback_style": {
                "tone": "encouraging",
                "detail_level": "detailed",
            },
            "rag_settings": {"enabled": False},
        },
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(module)
    db_session.flush()
    return module


# ---------------------------------------------------------------------------
# Document Fixture
# ---------------------------------------------------------------------------
@pytest.fixture
def test_document(db_session, test_module) -> Document:
    """Create a test document."""
    doc = Document(
        id=uuid.uuid4(),
        module_id=test_module.id,
        original_filename="test_document.pdf",
        file_hash="abc123hash",
        storage_path=f"modules/{test_module.id}/test_document.pdf",
        file_size=1024,
        mime_type="application/pdf",
        processing_status="completed",
        parse_status="completed",
        uploaded_at=datetime.now(timezone.utc),
    )
    db_session.add(doc)
    db_session.flush()
    return doc


# ---------------------------------------------------------------------------
# Question Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture
def mcq_question(db_session, test_module) -> Question:
    """Create an MCQ question."""
    q = Question(
        id=uuid.uuid4(),
        module_id=test_module.id,
        type="mcq",
        text="What is the capital of France?",
        options={"A": "London", "B": "Paris", "C": "Berlin", "D": "Madrid"},
        correct_option_id="B",
        points=1.0,
        status="active",
        question_order=1,
    )
    db_session.add(q)
    db_session.flush()
    return q


@pytest.fixture
def short_question(db_session, test_module) -> Question:
    """Create a short answer question."""
    q = Question(
        id=uuid.uuid4(),
        module_id=test_module.id,
        type="short",
        text="Explain the concept of polymorphism in OOP.",
        correct_answer="Polymorphism allows objects of different types to be treated as objects of a common base type.",
        points=5.0,
        status="active",
        question_order=2,
    )
    db_session.add(q)
    db_session.flush()
    return q


@pytest.fixture
def long_question(db_session, test_module) -> Question:
    """Create a long answer question."""
    q = Question(
        id=uuid.uuid4(),
        module_id=test_module.id,
        type="long",
        text="Discuss the advantages and disadvantages of microservices architecture.",
        points=10.0,
        status="active",
        question_order=3,
    )
    db_session.add(q)
    db_session.flush()
    return q


@pytest.fixture
def fill_blank_question(db_session, test_module) -> Question:
    """Create a fill-in-the-blank question."""
    q = Question(
        id=uuid.uuid4(),
        module_id=test_module.id,
        type="fill_blank",
        text="The ___ is the powerhouse of the cell. DNA is stored in the ___.",
        points=4.0,
        status="active",
        question_order=4,
        extended_config={
            "blanks": [
                {"position": 0, "correct_answers": ["mitochondria", "mitochondrion"], "points": 2.0, "case_sensitive": False},
                {"position": 1, "correct_answers": ["nucleus"], "points": 2.0, "case_sensitive": False},
            ]
        },
    )
    db_session.add(q)
    db_session.flush()
    return q


@pytest.fixture
def mcq_multiple_question(db_session, test_module) -> Question:
    """Create an MCQ with multiple correct answers."""
    q = Question(
        id=uuid.uuid4(),
        module_id=test_module.id,
        type="mcq_multiple",
        text="Which of the following are programming languages?",
        options={"A": "Python", "B": "HTML", "C": "Java", "D": "CSS"},
        points=4.0,
        status="active",
        question_order=5,
        extended_config={
            "correct_option_ids": ["A", "C"],
            "partial_credit": True,
            "penalty_for_wrong": True,
        },
    )
    db_session.add(q)
    db_session.flush()
    return q


@pytest.fixture
def multi_part_question(db_session, test_module) -> Question:
    """Create a multi-part question."""
    q = Question(
        id=uuid.uuid4(),
        module_id=test_module.id,
        type="multi_part",
        text="Answer the following questions about Python:",
        points=6.0,
        status="active",
        question_order=6,
        extended_config={
            "sub_questions": [
                {
                    "id": "1a",
                    "type": "mcq",
                    "text": "What is Python?",
                    "points": 2.0,
                    "options": {"A": "A snake", "B": "A programming language", "C": "A framework"},
                    "correct_option_id": "B",
                },
                {
                    "id": "1b",
                    "type": "short",
                    "text": "Name one advantage of Python.",
                    "points": 2.0,
                    "correct_answer": "Easy to read and write",
                },
                {
                    "id": "1c",
                    "type": "short",
                    "text": "What is a Python decorator?",
                    "points": 2.0,
                    "correct_answer": "A function that modifies another function",
                },
            ]
        },
    )
    db_session.add(q)
    db_session.flush()
    return q


# ---------------------------------------------------------------------------
# Student Answer Fixture
# ---------------------------------------------------------------------------
@pytest.fixture
def student_answer_mcq(db_session, student_user, mcq_question, test_module) -> StudentAnswer:
    """Create a student answer for the MCQ question."""
    answer = StudentAnswer(
        id=uuid.uuid4(),
        student_id=student_user.id,
        question_id=mcq_question.id,
        module_id=test_module.id,
        answer={"selected_option": "B", "selected_text": "Paris"},
        attempt=1,
        submitted_at=datetime.now(timezone.utc),
    )
    db_session.add(answer)
    db_session.flush()
    return answer


@pytest.fixture
def student_answer_text(db_session, student_user, short_question, test_module) -> StudentAnswer:
    """Create a student answer for the short question."""
    answer = StudentAnswer(
        id=uuid.uuid4(),
        student_id=student_user.id,
        question_id=short_question.id,
        module_id=test_module.id,
        answer={"text": "Polymorphism means objects can take many forms and be used interchangeably."},
        attempt=1,
        submitted_at=datetime.now(timezone.utc),
    )
    db_session.add(answer)
    db_session.flush()
    return answer


# ---------------------------------------------------------------------------
# Mock Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture
def mock_openai_client():
    """Mock OpenAI client that returns configurable responses."""
    with patch("app.services.openai_client.OpenAI") as mock_cls:
        mock_client = MagicMock()
        mock_cls.return_value = mock_client

        # Default completion response
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = '{"is_correct": true, "score": 85}'
        mock_client.chat.completions.create.return_value = mock_response

        yield mock_client


@pytest.fixture
def mock_supabase():
    """Mock Supabase storage client."""
    with patch("app.services.storage.create_client") as mock_create:
        mock_client = MagicMock()
        mock_create.return_value = mock_client
        mock_storage = MagicMock()
        mock_client.storage.from_.return_value = mock_storage
        mock_storage.upload.return_value = {"Key": "test/file.pdf"}
        mock_storage.download.return_value = b"fake file content"
        mock_storage.list.return_value = [{"name": "file.pdf"}]
        yield mock_storage
