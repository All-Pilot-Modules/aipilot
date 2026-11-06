"""Deterministic latency protections: no live providers or machine-speed thresholds."""
from copy import deepcopy
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import Session
from sqlalchemy.pool import QueuePool

from app.database import Base
from app.models.ai_feedback import AIFeedback
from app.models.feedback_job import FeedbackJob
from app.models.question import Question
from app.models.student_answer import StudentAnswer
from app.models.user import User
from app.services import ai_feedback, feedback_worker
from app.utils.answer_hash import compute_answer_hash


def seed_quiz(db, module, student, count, ready=False):
    answers = []
    for index in range(count):
        question = Question(id=uuid4(), module_id=module.id, type='mcq',
            text=f'Question {index}', options={'A': 'Yes', 'B': 'No'},
            correct_option_id='A', points=1, status='active', question_order=index)
        db.add(question)
        db.flush()
        answer = StudentAnswer(id=uuid4(), student_id=student.id, module_id=module.id,
            question_id=question.id, answer={'selected_option_id': 'A'}, attempt=1)
        db.add(answer)
        db.flush()
        if ready:
            db.add(AIFeedback(answer_id=answer.id, generation_status='completed',
                content_hash=compute_answer_hash(answer.answer), score=100,
                feedback_data={'explanation': 'Correct.', 'fallback': False}))
        answers.append(answer)
    db.commit()
    return answers


@pytest.mark.parametrize('changed', [False, True])
def test_ten_pregraded_answers_only_queue_changed_content(client, db_session,
        test_module, student_user, student_session, monkeypatch, changed):
    answers = seed_quiz(db_session, test_module, student_user, 10, ready=True)
    if changed:
        answers[-1].answer = {'selected_option_id': 'B'}
        db_session.commit()
    provider = MagicMock(side_effect=AssertionError('Submission must not call AI synchronously'))
    monkeypatch.setattr(ai_feedback.AIFeedbackService, 'generate_instant_feedback', provider)
    # Scoring has its own session; isolate it from the fixture's outer transaction.
    monkeypatch.setattr(feedback_worker, 'calculate_test_score', lambda *args: None)
    result = client.post(f'/api/student/modules/{test_module.id}/submit-test?attempt=1',
        headers=student_session, json={})
    assert result.status_code == 200, result.text
    jobs = db_session.query(FeedbackJob).all()
    assert len(jobs) == int(changed)
    if changed:
        assert jobs[0].answer_id == answers[-1].id
    provider.assert_not_called()


def test_repeated_speculative_autosave_reuses_one_job(client, db_session,
        test_module, student_user, student_session, mcq_question, monkeypatch):
    provider = MagicMock(side_effect=AssertionError('Autosave must not call AI synchronously'))
    monkeypatch.setattr(ai_feedback.AIFeedbackService, 'generate_instant_feedback', provider)
    body = dict(student_id=student_user.id, module_id=str(test_module.id),
        question_id=str(mcq_question.id), attempt=1, answer={'selected_option_id': 'A'})
    for selected in ['A', 'A', 'B', 'B']:
        body['answer'] = {'selected_option_id': selected}
        result = client.post('/api/student/save-answer?speculative=true', headers=student_session, json=body)
        assert result.status_code == 200, result.text
    jobs = db_session.query(FeedbackJob).all()
    assert len(jobs) == 1
    assert jobs[0].content_hash == compute_answer_hash(body['answer'])
    assert jobs[0].priority == 3
    provider.assert_not_called()


@pytest.mark.parametrize('count', [1, 10])
def test_pregraded_submission_has_bounded_select_queries(client, db_session,
        test_module, student_user, student_session, monkeypatch, count):
    seed_quiz(db_session, test_module, student_user, count, ready=True)
    monkeypatch.setattr(feedback_worker, 'calculate_test_score', lambda *args: None)
    url = f'/api/student/modules/{test_module.id}/submit-test?attempt=1'
    queries = []
    def capture(conn, cursor, statement, parameters, context, executemany):
        if statement.lstrip().upper().startswith('SELECT'):
            queries.append(statement)
    connection = db_session.connection()
    event.listen(connection, 'before_cursor_execute', capture)
    try:
        result = client.post(url, headers=student_session, json={})
    finally:
        event.remove(connection, 'before_cursor_execute', capture)
    assert result.status_code == 200, result.text
    # Fixed allowance for auth/module/submission/answer/result lookups, not one
    # lookup per answer. Inspect SQL before changing this budget.
    assert len(queries) <= 12, f'{len(queries)} SELECTs for {count} answers: {queries}'


def test_ai_call_leaves_single_connection_available_to_other_requests(
        tmp_path, db_session, student_answer_mcq, test_module, mcq_question, monkeypatch):
    # Unlike the standard fixture, this session owns real pool checkouts. A
    # one-connection pool reproduces contention without needing a load generator.
    rows = db_session.query(User).filter(User.id.in_([
        test_module.teacher_id, student_answer_mcq.student_id])).all()
    rows += [test_module, mcq_question, student_answer_mcq]
    snapshots = [(type(row), {col.key: deepcopy(getattr(row, col.key))
                            for col in row.__table__.columns}) for row in rows]
    question_id, module_id, answer_id = mcq_question.id, test_module.id, student_answer_mcq.id
    engine = create_engine(f'sqlite:///{tmp_path / "pool.db"}', poolclass=QueuePool,
                           pool_size=1, max_overflow=0, pool_timeout=0.05)
    Base.metadata.create_all(engine)
    try:
        with Session(engine) as db:
            for model, values in snapshots:
                db.add(model(**values))
                db.commit()
            answer = db.get(StudentAnswer, answer_id)
            monkeypatch.setattr(ai_feedback.AIFeedbackService, '__init__',
                lambda self: setattr(self, 'default_model', 'test'))
            monkeypatch.setattr(ai_feedback, 'should_include_context', lambda *args: False)
            borrowed = []
            def slow_provider(self, **kwargs):
                assert engine.pool.checkedout() == 0
                # Another request can obtain the sole connection while the AI
                # request is in flight. A retained connection fails in 50 ms.
                with engine.connect() as other:
                    borrowed.append(other.execute(text('SELECT 1')).scalar())
                return {'explanation': 'Correct.', 'is_correct': True,
                        'correctness_score': 100, 'points_earned': 1, 'points_possible': 1}
            monkeypatch.setattr(ai_feedback.AIFeedbackService, '_analyze_mcq_answer', slow_provider)
            result = ai_feedback.AIFeedbackService().generate_instant_feedback(
                db, answer, str(question_id), str(module_id))
            assert borrowed == [1], result
            assert not result.get('fallback'), result
    finally:
        engine.dispose()
