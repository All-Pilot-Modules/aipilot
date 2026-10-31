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


def test_teacher_feedback_includes_full_student_feedback(db_session, student_answer_mcq, test_module):
    from app.api.routes.feedback import get_module_feedback_for_teacher
    details = {
        "explanation": "Apply the product rule.",
        "strengths": ["Correct first derivative"],
        "weaknesses": ["Missing second term"],
        "improvement_hint": "Differentiate both factors.",
        "concept_explanation": "The derivative of a product is u'v + uv'.",
    }
    db_session.add(AIFeedback(answer_id=student_answer_mcq.id, released=True,
        generation_status="completed", feedback_data=details))
    db_session.flush()
    result = get_module_feedback_for_teacher(test_module.id, student_answer_mcq.student_id, db_session)
    assert len(result) == 1
    for field, value in details.items():
        assert result[0][field] == value


def test_between_attempts_setting_gates_all_student_feedback(client, db_session, student_answer_mcq, test_module, student_session):
    from app.models.test_submission import TestSubmission

    test_module.assignment_config = {"features": {"multiple_attempts": {
        "max_attempts": 2, "show_feedback_after_each": False,
    }}}
    feedback = AIFeedback(answer_id=student_answer_mcq.id, released=True,
        generation_status="completed", score=100, is_correct=True,
        feedback_data={"explanation": "Private until final submission", "fallback": False})
    db_session.add(feedback)
    db_session.flush()
    module_url = f"/api/student/modules/{test_module.id}/feedback"
    question_url = f"/api/student/questions/{student_answer_mcq.question_id}/feedback"
    detail_url = f"/api/ai-feedback/{feedback.id}"
    poll_url = f"/api/ai-feedback/status/answer/{student_answer_mcq.id}"

    def assert_hidden():
        assert client.get(module_url, headers=student_session).json() == []
        for url in (question_url, detail_url):
            assert client.get(url, headers=student_session).status_code == 403
        response = client.get(poll_url, headers=student_session)
        assert response.status_code == 200, response.text
        assert response.json()["feedback"] is None

    assert_hidden()
    assert client.post(f"/api/chat/feedback/{feedback.id}/discuss", headers=student_session).status_code == 403
    from app.api.routes.feedback import get_module_feedback_for_teacher
    assert len(get_module_feedback_for_teacher(test_module.id, student_answer_mcq.student_id, db_session)) == 1
    db_session.add(TestSubmission(student_id=student_answer_mcq.student_id,
        module_id=test_module.id, attempt=1, questions_count=1))
    db_session.flush()
    assert_hidden()

    # Configuration changes take effect without regenerating feedback.
    test_module.assignment_config = {"features": {"multiple_attempts": {
        "max_attempts": 2, "show_feedback_after_each": True,
    }}}
    db_session.flush()
    assert len(client.get(module_url, headers=student_session).json()) == 1
    test_module.assignment_config = {"features": {"multiple_attempts": {
        "max_attempts": 2, "show_feedback_after_each": False,
    }}}
    db_session.add(TestSubmission(student_id=student_answer_mcq.student_id,
        module_id=test_module.id, attempt=2, questions_count=1))
    db_session.flush()
    assert len(client.get(module_url, headers=student_session).json()) == 1
    for url in (question_url, detail_url):
        response = client.get(url, headers=student_session)
        assert response.status_code == 200, response.text
    assert client.get(poll_url, headers=student_session).json()["feedback"]["score"] == 100

    # Completing attempts must never bypass teacher review.
    feedback.released = False
    feedback.requires_teacher_review = True
    db_session.flush()
    assert_hidden()


import pytest


@pytest.mark.parametrize("show_feedback", [True, False])
@pytest.mark.parametrize("grading_mode", ["auto", "manual"])
def test_submission_keeps_grading_when_feedback_withheld(
    client, db_session, student_answer_mcq, test_module, student_session,
    monkeypatch, show_feedback, grading_mode,
):
    from unittest.mock import Mock
    from app.api.routes import student

    test_module.assignment_config = {"features": {"multiple_attempts": {
        "max_attempts": 2, "show_feedback_after_each": show_feedback,
    }}}
    test_module.ai_grading_mode = grading_mode
    db_session.flush()
    enqueue = Mock()
    monkeypatch.setattr(student, "create_feedback_jobs_batch", enqueue)
    response = client.post(
        f"/api/student/modules/{test_module.id}/submit-test?attempt=1",
        headers=student_session,
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["feedback_available"] is show_feedback
    assert data["can_retry"] is True
    assert data["feedback_status"] == ("pending_review" if grading_mode == "manual" else "generating")
    enqueue.assert_called_once()


# ---------------------------------------------------------------------------
# Between-attempt feedback conditions
#
# The four arms the research pilot varies, each asserted at every student-facing
# exit so no endpoint becomes a side door around the teacher's setting.
# ---------------------------------------------------------------------------

FULL_FEEDBACK = {
    "explanation": "You applied the product rule correctly.",
    "improvement_hint": "Try differentiating both factors next time.",
    "concept_explanation": "The derivative of a product is u'v + uv'.",
    "strengths": ["Correct setup"],
    "weaknesses": ["Dropped a term"],
    "correct_option": "A",
    "selected_option": "B",
    "fallback": False,
}

ARMS = {
    "nothing": {"show_correct_answer_to_student": True,
                "show_explanation_to_student": True, "show_hints_to_student": True},
    "correct_answer_only": {"show_correct_answer_to_student": True,
                            "show_explanation_to_student": False, "show_hints_to_student": False},
    "ai_feedback_only": {"show_correct_answer_to_student": False,
                         "show_explanation_to_student": True, "show_hints_to_student": True},
    "both": {"show_correct_answer_to_student": True,
             "show_explanation_to_student": True, "show_hints_to_student": True},
}


def _graded(db_session, answer, module, **grading):
    """Attach released feedback and set the module's grading policy."""
    module.ai_config = {"grading": {"mode": "auto", **grading}}
    module.assignment_config = {"features": {"multiple_attempts": {
        "max_attempts": 2, "show_feedback_after_each": True,
    }}}
    feedback = AIFeedback(answer_id=answer.id, released=True, generation_status="completed",
                          score=80, is_correct=False, feedback_data=dict(FULL_FEEDBACK))
    db_session.add(feedback)
    db_session.flush()
    return feedback


@pytest.mark.parametrize("arm", ["correct_answer_only", "ai_feedback_only", "both"])
def test_between_attempt_arm_applies_to_every_student_exit(
    client, db_session, student_answer_mcq, test_module, student_session, arm,
):
    flags = ARMS[arm]
    feedback = _graded(db_session, student_answer_mcq, test_module, **flags)

    wants_answer = flags["show_correct_answer_to_student"]
    wants_prose = flags["show_explanation_to_student"]

    listed = client.get(f"/api/student/modules/{test_module.id}/feedback",
                        headers=student_session).json()
    assert len(listed) == 1
    per_question = client.get(
        f"/api/student/questions/{student_answer_mcq.question_id}/feedback",
        headers=student_session).json()
    detail = client.get(f"/api/ai-feedback/{feedback.id}", headers=student_session).json()

    for payload in (listed[0], per_question, detail):
        assert bool(payload["correct_option"]) is wants_answer, payload
        assert bool(payload["explanation"]) is wants_prose, payload
        assert bool(payload["improvement_hint"]) is flags["show_hints_to_student"], payload
        assert bool(payload["concept_explanation"]) is wants_prose, payload
        # The student's own answer is never redacted — only the key.
        assert payload["selected_option"] == "B"

    poll = client.get(f"/api/ai-feedback/status/answer/{student_answer_mcq.id}",
                      headers=student_session).json()
    assert bool(poll["feedback"]["explanation"]) is wants_prose

    # The tutor is the fifth exit: it must not hand back prose the arm hides.
    discuss = client.post(f"/api/chat/feedback/{feedback.id}/discuss", headers=student_session)
    assert discuss.status_code == (403 if not wants_prose else 200), discuss.text


@pytest.mark.parametrize("arm,expect_key", [("both", True), ("ai_feedback_only", False)])
def test_text_question_reference_answer_follows_correct_answer_flag(
    client, db_session, student_answer_text, short_question, test_module, student_session, arm, expect_key,
):
    """With AI feedback on, a text question's authored answer was never sent at all."""
    short_question.correct_answer = "The derivative is 2x."
    _graded(db_session, student_answer_text, test_module, **ARMS[arm])

    listed = client.get(f"/api/student/modules/{test_module.id}/feedback", headers=student_session).json()
    item = next(entry for entry in listed if entry["answer_id"] == str(student_answer_text.id))
    if expect_key:
        assert item["answer_key"] == [{"label": "Reference answer", "text": "The derivative is 2x."}]
        assert item["explanation"] == FULL_FEEDBACK["explanation"]
    else:
        assert not item.get("answer_key")


@pytest.mark.parametrize("arm,expect_ai", [("correct_answer_only", False), ("both", True)])
def test_correct_answer_only_arm_scores_mcq_without_openai(
    db_session, student_answer_mcq, test_module, monkeypatch, arm, expect_ai,
):
    """With all AI prose hidden from the student, the OpenAI call is pure latency."""
    from unittest.mock import Mock
    from app.services.ai_feedback import AIFeedbackService
    from app.crud.ai_feedback import get_feedback_by_answer

    test_module.ai_config = {"grading": {"mode": "auto", **ARMS[arm]}}
    db_session.flush()
    service = AIFeedbackService()
    service.client = Mock()
    service.client.create_chat_completion.side_effect = RuntimeError("OpenAI called")

    service.generate_instant_feedback(
        db=db_session, student_answer=student_answer_mcq,
        question_id=str(student_answer_mcq.question_id), module_id=str(test_module.id),
        previous_feedback_context=[{"attempt": 1, "ai_feedback": "x"}],  # bypass MCQ cache
    )

    assert service.client.create_chat_completion.called is expect_ai
    if not expect_ai:
        stored = get_feedback_by_answer(db_session, student_answer_mcq.id)
        assert stored.generation_status == "completed"
        assert stored.feedback_data["model_used"] == "rule-based"
        assert stored.is_correct is not None and stored.score in (0, 100)
        assert stored.feedback_data["correct_option"]
        assert not stored.feedback_data["fallback"]


def test_hiding_score_applies_beyond_the_module_feedback_list(
    client, db_session, student_answer_mcq, test_module, student_session,
):
    """show_score_to_student previously leaked through three sibling endpoints."""
    feedback = _graded(db_session, student_answer_mcq, test_module,
                       show_score_to_student=False)

    detail = client.get(f"/api/ai-feedback/{feedback.id}", headers=student_session).json()
    per_question = client.get(
        f"/api/student/questions/{student_answer_mcq.question_id}/feedback",
        headers=student_session).json()
    poll = client.get(f"/api/ai-feedback/status/answer/{student_answer_mcq.id}",
                      headers=student_session).json()

    for payload in (detail, per_question):
        assert payload["score"] is None
        assert payload["is_correct"] is None
        assert payload["points_earned"] is None
    assert poll["feedback"]["score"] is None
    assert poll["feedback"]["is_correct"] is None
    # Explanation is a separate axis and stays visible.
    assert detail["explanation"] == FULL_FEEDBACK["explanation"]


# ---------------------------------------------------------------------------
# Final attempt: submission only, or also a learning step
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("mode,expect_feedback", [("submit_only", False), ("learn", True)])
def test_final_attempt_mode_controls_feedback_on_last_attempt(
    client, db_session, student_answer_mcq, test_module, student_session,
    monkeypatch, mode, expect_feedback,
):
    from unittest.mock import Mock
    from app.services import ai_feedback as ai_feedback_service

    test_module.ai_config = {"grading": {"mode": "auto", "final_attempt_mode": mode}}
    test_module.assignment_config = {"features": {"multiple_attempts": {
        "max_attempts": 2, "show_feedback_after_each": True,
    }}}
    db_session.flush()

    generate = Mock(return_value={"explanation": "x", "score": 50})
    monkeypatch.setattr(ai_feedback_service.AIFeedbackService, "generate_feedback", generate,
                        raising=False)

    response = client.post("/api/student/submit-answer", headers=student_session, json={
        "student_id": student_answer_mcq.student_id,
        "module_id": str(test_module.id),
        "question_id": str(student_answer_mcq.question_id),
        "answer": {"selected_option": "A"},
        "attempt": 2,
    })
    assert response.status_code in (200, 201), response.text
    body = response.json()
    # attempt 2 of 2 is the final attempt: "submit_only" short-circuits to a
    # bare final_submission, "learn" queues a grading job like any other attempt.
    assert ("feedback_status" in body) is expect_feedback, body
    assert body.get("final_submission", False) is not expect_feedback, body


@pytest.mark.parametrize("mode,expect_ai", [("submit_only", False), ("learn", True)])
def test_final_attempt_mode_controls_ai_on_submit_test(
    client, db_session, student_answer_mcq, test_module, student_session,
    monkeypatch, mode, expect_ai,
):
    """submit-test is what the test page calls; it must honour submit_only too,
    and drop autosave jobs already queued for the final attempt."""
    from unittest.mock import Mock
    from app.api.routes import student
    from app.models.feedback_job import FeedbackJob
    from app.services.feedback_worker import create_feedback_job

    test_module.ai_config = {"grading": {"mode": "auto", "final_attempt_mode": mode}}
    test_module.assignment_config = {"features": {"multiple_attempts": {
        "max_attempts": 2, "show_feedback_after_each": True,
    }}}
    student_answer_mcq.attempt = 2
    db_session.flush()
    create_feedback_job(db=db_session, answer_id=student_answer_mcq.id,
                        student_id=student_answer_mcq.student_id, module_id=str(test_module.id),
                        attempt=2, priority=3, content_hash="stale", commit=False)
    db_session.flush()

    enqueue = Mock()
    monkeypatch.setattr(student, "create_feedback_jobs_batch", enqueue)
    response = client.post(
        f"/api/student/modules/{test_module.id}/submit-test?attempt=2",
        headers=student_session,
    )
    assert response.status_code == 200, response.text
    assert response.json()["can_retry"] is False
    # "learn" bumps the queued job in place instead of enqueueing a duplicate;
    # "submit_only" removes it so the worker never makes the OpenAI call.
    enqueue.assert_not_called()
    jobs = db_session.query(FeedbackJob).filter(
        FeedbackJob.answer_id == student_answer_mcq.id).all()
    if expect_ai:
        assert len(jobs) == 1 and jobs[0].priority == 1
    else:
        assert jobs == []


@pytest.mark.parametrize("mode,expect_ai", [("submit_only", False), ("learn", True)])
def test_final_attempt_mode_controls_speculative_grading(
    client, db_session, mcq_question, test_module, student_session,
    student_user, monkeypatch, mode, expect_ai,
):
    from unittest.mock import Mock
    from app.api.routes import student

    test_module.ai_config = {"grading": {"mode": "auto", "final_attempt_mode": mode}}
    test_module.assignment_config = {"features": {"multiple_attempts": {"max_attempts": 2}}}
    db_session.flush()

    enqueue = Mock()
    monkeypatch.setattr(student, "create_feedback_job", enqueue)
    response = client.post("/api/student/save-answer?speculative=true", headers=student_session, json={
        "student_id": student_user.id,
        "module_id": str(test_module.id),
        "question_id": str(mcq_question.id),
        "answer": {"selected_option": "A"},
        "attempt": 2,
    })
    assert response.status_code == 200, response.text
    assert enqueue.called is expect_ai


@pytest.mark.parametrize("mode,allowed", [("submit_only", False), ("learn", True)])
def test_final_attempt_mode_gates_feedback_regeneration(
    db_session, test_module, mode, allowed,
):
    from app.services.feedback_visibility import ai_feedback_allowed_for_attempt

    test_module.ai_config = {"grading": {"final_attempt_mode": mode}}
    test_module.assignment_config = {"features": {"multiple_attempts": {"max_attempts": 5}}}
    db_session.flush()

    # Every attempt before the last is always allowed, regardless of mode.
    for attempt in (1, 2, 3, 4):
        assert ai_feedback_allowed_for_attempt(test_module, attempt) is True
    assert ai_feedback_allowed_for_attempt(test_module, 5) is allowed


def test_final_attempt_mode_rejects_unknown_value(client, test_module, teacher_token):
    response = client.patch(f"/api/modules/{test_module.id}/grading-settings",
                            headers={"Authorization": f"Bearer {teacher_token}"},
                            json={"final_attempt_mode": "whenever"})
    assert response.status_code == 400, response.text
