"""Real HTTP requests through FastAPI, with synthetic identities and data."""
from datetime import timedelta
from uuid import uuid4
import pytest
from app.core.auth import create_access_token, create_student_token


@pytest.mark.parametrize("suffix", ["feedback", "my-answers", "submission-status", "survey"])
def test_student_routes_require_session(client, test_module, suffix):
    response = client.get(f"/api/student/modules/{test_module.id}/{suffix}")
    assert response.status_code == 403, response.text


@pytest.mark.parametrize("suffix", ["feedback", "my-answers", "submission-status", "survey"])
def test_student_routes_reject_other_module(client, test_module, student_user, suffix):
    token = create_student_token(student_user.id, uuid4())
    response = client.get(f"/api/student/modules/{test_module.id}/{suffix}",
                          headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403, response.text


def test_expired_session_rejected(client, test_module, student_user):
    token = create_access_token({"sub": student_user.id, "role": "student", "module_id": str(test_module.id)},
                                expires_delta=timedelta(seconds=-1))
    response = client.get(f"/api/student/modules/{test_module.id}/feedback",
                          headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


def test_spoofed_query_cannot_change_feedback_owner(client, test_module, student_session):
    response = client.get(f"/api/student/modules/{test_module.id}/feedback?student_id=someone-else",
                          headers=student_session)
    assert response.status_code == 200, response.text
    assert response.json() == []


def test_teacher_feedback_endpoint_accepts_teacher(client, test_module, auth_headers_teacher):
    response = client.get(f"/api/ai-feedback/teacher/module/{test_module.id}/released",
                          headers=auth_headers_teacher)
    assert response.status_code == 200, response.text


@pytest.mark.parametrize("fixture_name", ["mcq_question", "short_question", "long_question",
                                         "fill_blank_question", "mcq_multiple_question", "multi_part_question"])
def test_student_question_payload_never_contains_answer_keys(client, request, test_module, fixture_name):
    question = request.getfixturevalue(fixture_name)
    response = client.get(f"/api/student/modules/{test_module.id}/questions")
    assert response.status_code == 200, response.text
    payload = next(q for q in response.json() if q["id"] == str(question.id))
    forbidden = {"correct_answer", "correct_answers", "correct_option_id", "correct_option_ids"}

    def check(value):
        if isinstance(value, dict):
            assert forbidden.isdisjoint(value), value
            for child in value.values():
                check(child)
        elif isinstance(value, list):
            for child in value:
                check(child)
    check(payload)
    assert payload["text"] == question.text
