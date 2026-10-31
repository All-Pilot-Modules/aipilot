"""Answer-only learning must not wait for AI, or bypass release boundaries."""
import pytest
from app.models.ai_feedback import AIFeedback
from app.models.test_submission import TestSubmission as Submission


def configure(module):
    module.ai_grading_mode = "auto"
    module.ai_config = {"grading": {
        "show_correct_answer_to_student": True,
        "show_explanation_to_student": False, "show_hints_to_student": False,
        "show_score_to_student": False, "require_teacher_approval": True,
    }}
    module.assignment_config = {"features": {"multiple_attempts": {
        "max_attempts": 5, "show_feedback_after_each": True,
    }}}


def submit(db, module, answer):
    db.add(Submission(module_id=module.id, student_id=answer.student_id,
                          attempt=answer.attempt, questions_count=1))
    db.flush()


@pytest.mark.parametrize("status", [None, "pending", "generating", "failed", "completed"])
def test_key_is_ready_independent_of_ai(client, db_session, test_module,
                                      student_answer_mcq, student_session, status, monkeypatch):
    from app.api.routes import student
    configure(test_module)
    submit(db_session, test_module, student_answer_mcq)
    if status:
        db_session.add(AIFeedback(answer_id=student_answer_mcq.id, released=True,
                                 generation_status=status, score=100,
                                 feedback_data={"explanation": "AI text must not appear"}))
    db_session.flush()
    monkeypatch.setattr(student, "create_feedback_job", lambda **kwargs: pytest.fail("Student key polling must not queue AI"))
    response = client.get(f"/api/student/modules/{test_module.id}/feedback", headers=student_session)
    assert response.status_code == 200
    item, = response.json()
    assert item["answer_key"] == [{"label": "Correct answer", "text": "B. Paris"}]
    assert item["student_answer"] == student_answer_mcq.answer
    assert item["available_options"] == {"A": "London", "B": "Paris", "C": "Berlin", "D": "Madrid"}
    assert item["correct_option"] == "B"
    assert item["generation_status"] == "completed"
    assert item["score"] is None
    assert item["explanation"] == ""
    status_response = client.get(f"/api/student/modules/{test_module.id}/feedback-status?attempt=1", headers=student_session)
    assert status_response.status_code == 200
    state = status_response.json()
    assert state["all_complete"] is True
    assert state["feedback_ready"] == 1
    assert state["feedback_failed"] == state["feedback_pending"] == 0


def test_teacher_edit_stays_hidden_until_release(client, db_session, test_module,
                                                student_answer_mcq, student_session):
    from app.models.teacher_grade import TeacherGrade
    configure(test_module)
    student_answer_mcq.attempt = 5
    submit(db_session, test_module, student_answer_mcq)
    feedback = AIFeedback(answer_id=student_answer_mcq.id, released=False,
                          requires_teacher_review=True, generation_status="completed",
                          feedback_data={"explanation": "AI draft"})
    db_session.add(feedback)
    db_session.add(TeacherGrade(answer_id=student_answer_mcq.id,
                               student_id=student_answer_mcq.student_id,
                               question_id=student_answer_mcq.question_id,
                               module_id=test_module.id, points_awarded=1,
                               feedback_text="Teacher draft", graded_by=test_module.teacher_id))
    db_session.flush()
    url = f"/api/student/modules/{test_module.id}/feedback"
    assert client.get(url, headers=student_session).json() == []
    feedback.released = True
    db_session.flush()
    item, = client.get(url, headers=student_session).json()
    assert item["teacher_grade"]["feedback_text"] == "Teacher draft"


@pytest.mark.parametrize("boundary", ["draft", "final", "manual", "withheld", "unreleased", "ai_content", "mastery"])
def test_key_does_not_bypass_policy(client, db_session, test_module,
                                   student_answer_mcq, student_session, boundary):
    configure(test_module)
    if boundary == "final":
        student_answer_mcq.attempt = 5
    if boundary == "manual":
        test_module.ai_grading_mode = "manual"
    if boundary == "withheld":
        test_module.assignment_config = {"features": {"multiple_attempts": {
            "max_attempts": 5, "show_feedback_after_each": False,
        }}}
    if boundary == "ai_content":
        test_module.ai_config = {"grading": {"show_correct_answer_to_student": True,
                                             "show_explanation_to_student": True}}
    if boundary == "mastery":
        student_answer_mcq.is_mastery = True
    if boundary == "unreleased":
        db_session.add(AIFeedback(answer_id=student_answer_mcq.id, released=False,
                                 generation_status="completed", feedback_data={}))
    if boundary != "draft":
        submit(db_session, test_module, student_answer_mcq)
    db_session.flush()
    response = client.get(f"/api/student/modules/{test_module.id}/feedback", headers=student_session)
    assert response.status_code == 200
    assert response.json() == []


def test_open_answer_key_and_missing_key(client, db_session, test_module,
                                        student_answer_mcq, student_session, mcq_question):
    configure(test_module)
    mcq_question.type = "short"
    mcq_question.correct_answer = "Teacher-authored reference answer"
    submit(db_session, test_module, student_answer_mcq)
    url = f"/api/student/modules/{test_module.id}/feedback"
    item, = client.get(url, headers=student_session).json()
    assert item["answer_key"] == [{"label": "Reference answer", "text": mcq_question.correct_answer}]
    mcq_question.correct_answer = None
    db_session.flush()
    item, = client.get(url, headers=student_session).json()
    assert item["answer_key"] == []
    assert item["generation_status"] == "completed"


def test_final_ai_draft_keeps_rationale_for_teacher(db_session, test_module,
                                                  student_answer_mcq, monkeypatch):
    from app.services.ai_feedback import AIFeedbackService
    from unittest.mock import Mock
    configure(test_module)
    student_answer_mcq.attempt = 5
    db_session.flush()
    service = AIFeedbackService()
    monkeypatch.setattr(service, "_grade_without_prose", lambda *args: pytest.fail("Final teacher draft needs rationale"))
    analyze = Mock(return_value={"correctness_score": 100, "is_correct": True,
                                 "explanation": "Rationale for teacher", "points_earned": 1,
                                 "points_possible": 1, "criterion_scores": {}})
    monkeypatch.setattr(service, "_analyze_mcq_answer", analyze)
    service.generate_instant_feedback(db=db_session, student_answer=student_answer_mcq,
                                      question_id=str(student_answer_mcq.question_id),
                                      module_id=str(test_module.id))
    analyze.assert_called_once()
