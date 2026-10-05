"""Pending teacher review and release behavior at the student boundary."""
from app.models.ai_feedback import AIFeedback


def test_unreleased_feedback_hidden_then_visible(client, db_session, student_answer_mcq, test_module, student_session):
    feedback = AIFeedback(answer_id=student_answer_mcq.id, released=False, requires_teacher_review=True,
        generation_status="completed", score=100, is_correct=True,
        feedback_data={"explanation": "Use the product rule.", "fallback": False})
    db_session.add(feedback)
    db_session.flush()
    url = f"/api/student/modules/{test_module.id}/feedback"
    hidden = client.get(url, headers=student_session)
    assert hidden.status_code == 200, hidden.text
    assert hidden.json() == []
    feedback.released = True
    db_session.flush()
    visible = client.get(url, headers=student_session)
    assert visible.status_code == 200, visible.text
    assert len(visible.json()) == 1
    assert visible.json()[0]["explanation"] == "Use the product rule."


def test_feedback_for_other_student_not_returned(client, db_session, student_answer_mcq, test_module):
    from app.core.auth import create_student_token
    db_session.add(AIFeedback(answer_id=student_answer_mcq.id, released=True,
        generation_status="completed", feedback_data={"explanation": "Private feedback"}))
    db_session.flush()
    headers = {"Authorization": "Bearer " + create_student_token("other-student", test_module.id)}
    response = client.get(f"/api/student/modules/{test_module.id}/feedback", headers=headers)
    assert response.status_code == 200
    assert response.json() == []
