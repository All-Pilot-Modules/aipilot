"""Teacher login/refresh and question generation contracts."""
import json
from uuid import uuid4
import pytest
from app.core.auth import create_access_token
from app.services.question_generation import QuestionGenerationService


def test_teacher_login_and_refresh(client, teacher_user):
    login = client.post("/api/auth/login", json={"identifier": teacher_user.email, "password": "password123"})
    assert login.status_code == 200, login.text
    tokens = login.json()
    assert tokens["access_token"] and tokens["refresh_token"]
    refresh = client.post("/api/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert refresh.status_code == 200, refresh.text
    me = client.get("/api/auth/me", headers={"Authorization": "Bearer " + refresh.json()["access_token"]})
    assert me.status_code == 200, me.text
    assert me.json()["id"] == teacher_user.id


def test_wrong_password_rejected(client, teacher_user):
    response = client.post("/api/auth/login", json={"identifier": teacher_user.email, "password": "wrong"})
    assert response.status_code == 401


def test_access_token_cannot_be_used_as_refresh(client, teacher_user):
    token = create_access_token({"sub": teacher_user.id})
    response = client.post("/api/auth/refresh", json={"refresh_token": token})
    assert response.status_code == 401


@pytest.mark.parametrize("kind", ["mcq", "short", "long"])
def test_generated_questions_require_teacher_review(kind):
    source = {"questions": [{"type": kind, "text": "Differentiate $x^2$.",
        "options": {"A": "$2x$", "B": "$x$"}, "correct_option_id": "A", "correct_answer": "$2x$"}]}
    result = QuestionGenerationService()._parse_openai_response(json.dumps(source), uuid4(), uuid4())
    assert len(result) == 1
    assert result[0]["status"] == "unreviewed"
    assert result[0]["is_ai_generated"] is True
    assert result[0]["text"] == source["questions"][0]["text"]


@pytest.mark.parametrize("content", ["not JSON", '{"questions": []}'])
def test_bad_generation_response_is_rejected(content):
    with pytest.raises(ValueError):
        QuestionGenerationService()._parse_openai_response(content, uuid4(), uuid4())
