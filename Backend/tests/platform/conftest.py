"""Fixtures for the platform acceptance suite; all providers are offline."""
import pytest
from app.core.auth import create_student_token
from app.models.student_enrollment import StudentEnrollment


@pytest.fixture
def student_session(db_session, student_user, test_module):
    db_session.add(StudentEnrollment(student_id=student_user.id,
        module_id=test_module.id, access_code_used=test_module.access_code))
    db_session.flush()
    return {"Authorization": "Bearer " + create_student_token(student_user.id, test_module.id)}


@pytest.fixture(autouse=True)
def offline_email(monkeypatch):
    from app.api.routes import auth
    for name in ("send_verification_email", "send_welcome_email", "send_reset_password_email"):
        monkeypatch.setattr(auth, name, lambda *args, **kwargs: True)
