"""Autosave, submission, student chat ownership, and survey persistence."""
import pytest
from app.models.student_answer import StudentAnswer
from app.models.feedback_job import FeedbackJob
from app.models.test_submission import TestSubmission as Submission
from app.core.auth import create_student_token


def payload(user, module, question, answer):
    return {"student_id": user.id, "module_id": str(module.id), "question_id": str(question.id),
            "attempt": 1, "answer": answer}


@pytest.mark.parametrize("name,answer", [
    ("mcq_question", {"selected_option_id": "B"}),
    ("short_question", {"text_response": "$x = 4$"}),
    ("long_question", {"text_response": "A detailed explanation in ordinary prose."}),
    ("fill_blank_question", {"blanks": {"0": "mitochondria", "1": "nucleus"}}),
    ("mcq_multiple_question", {"selected_options": ["A", "C"]}),
    ("multi_part_question", {"sub_answers": {"1a": "B", "1b": "Readable"}}),
])
def test_autosave_roundtrip(client, db_session, request, student_user, test_module, student_session, name, answer):
    question = request.getfixturevalue(name)
    body = payload(student_user, test_module, question, answer)
    for _ in range(2):
        response = client.post("/api/student/save-answer", json=body, headers=student_session)
        assert response.status_code == 200, response.text
    rows = db_session.query(StudentAnswer).filter_by(question_id=question.id).all()
    assert len(rows) == 1
    assert rows[0].answer == answer
    assert db_session.query(FeedbackJob).count() == 0


def test_save_rejects_spoofed_student(client, student_user, test_module, mcq_question, student_session):
    body = payload(student_user, test_module, mcq_question, {"selected_option_id": "B"})
    body["student_id"] = "other-student"
    response = client.post("/api/student/save-answer", json=body, headers=student_session)
    assert response.status_code == 403


def test_submission_queues_once(client, db_session, student_user, test_module, mcq_question, student_session):
    saved = client.post("/api/student/save-answer", headers=student_session,
        json=payload(student_user, test_module, mcq_question, {"selected_option_id": "B"}))
    assert saved.status_code == 200, saved.text
    url = f"/api/student/modules/{test_module.id}/submit-test?attempt=1"
    result = client.post(url, headers=student_session, json={})
    assert result.status_code == 200, result.text
    assert db_session.query(Submission).count() == 1
    assert db_session.query(FeedbackJob).count() == 1
    duplicate = client.post(url, headers=student_session, json={})
    assert duplicate.status_code == 400
    assert db_session.query(FeedbackJob).count() == 1


def test_chat_create_read_delete_and_ownership(client, student_user, test_module, student_session):
    result = client.post("/api/chat/conversations", headers=student_session,
        json={"student_id": student_user.id, "module_id": str(test_module.id), "title": "Derivative help"})
    assert result.status_code == 200, result.text
    url = f"/api/chat/conversations/{result.json()['id']}"
    assert client.get(url, headers=student_session).status_code == 200
    other = {"Authorization": "Bearer " + create_student_token("other", test_module.id)}
    assert client.get(url, headers=other).status_code == 404
    assert client.delete(url, headers=other).status_code == 404
    assert client.delete(url, headers=student_session).status_code == 200
    assert client.get(url, headers=student_session).status_code == 404


def test_survey_roundtrip(client, test_module, student_session):
    url = f"/api/student/modules/{test_module.id}/survey"
    response = client.post(url, headers=student_session, json={"responses": {"q1": "Helpful", "q3": "Good experience"}})
    assert response.status_code == 200, response.text
    response = client.get(url + "/my-response", headers=student_session)
    assert response.status_code == 200, response.text
    assert response.json()["responses"] == {"q1": "Helpful", "q3": "Good experience"}
