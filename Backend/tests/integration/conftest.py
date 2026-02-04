"""
Integration test fixtures - extends root conftest with integration-specific setup.
"""
import pytest
import uuid
from datetime import datetime, timezone


@pytest.fixture
def enrolled_student(db_session, student_user, test_module):
    """Create a student enrolled in the test module."""
    from app.models.student_enrollment import StudentEnrollment

    enrollment = StudentEnrollment(
        id=uuid.uuid4(),
        student_id=student_user.id,
        module_id=test_module.id,
        consent_given=True,
        consent_timestamp=datetime.now(timezone.utc),
        enrolled_at=datetime.now(timezone.utc),
    )
    db_session.add(enrollment)
    db_session.flush()
    return enrollment


@pytest.fixture
def document_with_chunks(db_session, test_module, test_document):
    """Create a document with chunks for RAG testing."""
    from app.models.document_chunk import DocumentChunk

    chunks = []
    for i in range(5):
        chunk = DocumentChunk(
            id=uuid.uuid4(),
            document_id=test_document.id,
            text=f"This is chunk {i} with some content about topic {i}.",
            chunk_index=i,
            metadata={"page": i + 1},
        )
        db_session.add(chunk)
        chunks.append(chunk)

    db_session.flush()
    test_document.chunks = chunks
    return test_document


@pytest.fixture
def complete_test_setup(
    db_session, teacher_user, student_user, test_module,
    mcq_question, short_question, enrolled_student
):
    """Complete test setup with teacher, student, module, questions, and enrollment."""
    return {
        "teacher": teacher_user,
        "student": student_user,
        "module": test_module,
        "mcq_question": mcq_question,
        "short_question": short_question,
        "enrollment": enrolled_student,
    }
