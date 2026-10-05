from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock
import pytest
from app.models.ai_feedback import AIFeedback
from app.models.feedback_job import FeedbackJob
from app.services.feedback_job_state import current_jobs_by_answer
from app.services import feedback_worker as worker


def add_job(db, answer, status, age=0, retries=0):
    job = FeedbackJob(answer_id=answer.id, student_id=answer.student_id,
        module_id=answer.module_id, attempt=1, status=status,
        retry_count=retries, max_retries=5,
        created_at=datetime.now(timezone.utc) - timedelta(seconds=age),
        locked_at=datetime.now(timezone.utc) if status == 'processing' else None)
    db.add(job)
    db.flush()
    return job


@pytest.mark.parametrize('reverse', [False, True])
def test_active_job_wins_over_historical_failure(reverse):
    now = datetime.now(timezone.utc)
    active = SimpleNamespace(id='a', answer_id='answer', status='queued', created_at=now)
    failed = SimpleNamespace(id='b', answer_id='answer', status='failed', created_at=now + timedelta(seconds=1))
    jobs = [active, failed]
    assert current_jobs_by_answer(jobs[::-1] if reverse else jobs)['answer'] is active


@pytest.mark.parametrize('active_status', ['queued', 'processing'])
def test_status_does_not_stop_on_old_failure(client, db_session, student_answer_mcq, test_module, student_session, active_status):
    answer = student_answer_mcq
    add_job(db_session, answer, 'failed', age=60, retries=5)
    add_job(db_session, answer, active_status)
    db_session.add(AIFeedback(answer_id=answer.id, generation_status='failed', feedback_data={'fallback': True}))
    db_session.flush()
    result = client.get(f'/api/student/modules/{test_module.id}/feedback-status?attempt=1', headers=student_session).json()
    assert result['feedback_failed'] == 0
    assert result['feedback_retrying'] == 1
    assert result['feedback_ready'] == 0
    assert result['all_complete'] is False
    assert result['questions'][0]['job_status'] == active_status


def test_exhausted_failure_finishes_polling_without_counting_as_ready(client, db_session, student_answer_mcq, test_module, student_session):
    add_job(db_session, student_answer_mcq, 'failed', retries=5)
    db_session.add(AIFeedback(answer_id=student_answer_mcq.id, generation_status='failed'))
    db_session.flush()
    result = client.get(f'/api/student/modules/{test_module.id}/feedback-status', headers=student_session).json()
    assert result['all_complete'] is True
    assert result['feedback_ready'] == 0
    assert result['feedback_failed'] == 1


def test_cleanup_leaves_long_running_active_feedback_alone(db_session, student_answer_mcq):
    from app.crud.ai_feedback import cleanup_stale_feedback, check_and_mark_timeout
    add_job(db_session, student_answer_mcq, 'processing')
    feedback = AIFeedback(answer_id=student_answer_mcq.id, generation_status='generating',
        started_at=datetime.now(timezone.utc)-timedelta(minutes=10), timeout_seconds=150)
    db_session.add(feedback)
    db_session.flush()
    assert check_and_mark_timeout(db_session, student_answer_mcq.id) is False
    assert cleanup_stale_feedback(db_session, student_answer_mcq.module_id, student_answer_mcq.student_id) == 0
    assert feedback.generation_status == 'generating'


def test_cleanup_does_not_create_failure_for_queued_answer(client, db_session, student_answer_mcq, test_module, student_session):
    add_job(db_session, student_answer_mcq, 'queued')
    response = client.post(f'/api/student/modules/{test_module.id}/cleanup-feedback', headers=student_session)
    assert response.status_code == 200
    assert db_session.query(AIFeedback).filter_by(answer_id=student_answer_mcq.id).first() is None


def test_lease_renewal_uses_claim_token_and_cannot_revive_completed_job(db_session, student_answer_mcq, monkeypatch):
    job = add_job(db_session, student_answer_mcq, 'processing')
    old_token = job.locked_at
    monkeypatch.setattr(worker, 'new_lease_session', lambda: db_session)
    monkeypatch.setattr(db_session, 'close', lambda: None)
    renewed = worker._renew_job_lease(job.id, old_token)
    assert renewed is not None and renewed != old_token
    assert worker._renew_job_lease(job.id, old_token) is None
    assert worker._still_owns_job(db_session, job.id, renewed)
    db_session.refresh(job)
    job.status = 'done'
    db_session.commit()
    assert worker._renew_job_lease(job.id, renewed) is None


def test_lease_heartbeat_stops_when_generation_finishes(monkeypatch):
    import threading
    renewed = threading.Event()
    def renew(job_id, token):
        renewed.set()
        return token + 1
    monkeypatch.setattr(worker, '_renew_job_lease', renew)
    monkeypatch.setattr(worker, 'JOB_HEARTBEAT_SECONDS', .005)
    monkeypatch.setattr(worker, '_stop_event', threading.Event())
    monkeypatch.setattr(worker, '_lost_leadership', threading.Event())
    with worker._JobLease('job', 1) as lease:
        assert renewed.wait(1)
    assert not lease.thread.is_alive()
    assert lease.locked_at > 1


def test_untagged_fallback_is_retried_not_marked_done(db_session, student_answer_mcq, monkeypatch):
    job = add_job(db_session, student_answer_mcq, 'processing')
    monkeypatch.setattr(worker, 'AIFeedbackService', lambda: MagicMock(
        generate_instant_feedback=MagicMock(return_value={'fallback': True})))
    worker._generate_feedback_for_job(db_session, job)
    db_session.refresh(job)
    assert job.status == 'queued'
    assert job.retry_count == 1


def test_unsaved_provider_result_is_retried(db_session, student_answer_mcq, monkeypatch):
    job = add_job(db_session, student_answer_mcq, 'processing')
    monkeypatch.setattr(worker, 'AIFeedbackService', lambda: MagicMock(
        generate_instant_feedback=MagicMock(return_value={'explanation': 'Real result'})))
    worker._generate_feedback_for_job(db_session, job)
    db_session.refresh(job)
    assert job.status == 'queued'
    assert 'not persisted' in job.error_message


def test_latest_terminal_job_selected():
    now = datetime.now(timezone.utc)
    old = SimpleNamespace(id='a', answer_id='answer', status='failed', created_at=now)
    new = SimpleNamespace(id='b', answer_id='answer', status='done', created_at=now + timedelta(seconds=1))
    assert current_jobs_by_answer([new, old])['answer'] is new


@pytest.mark.asyncio
async def test_stream_reports_active_retry_instead_of_completed_fallback(db_session, student_answer_mcq, monkeypatch):
    from contextlib import nullcontext
    from unittest.mock import AsyncMock
    import json
    from app.api.routes import feedback as route
    answer = student_answer_mcq
    add_job(db_session, answer, 'failed', age=60, retries=5)
    add_job(db_session, answer, 'queued')
    db_session.add(AIFeedback(answer_id=answer.id, generation_status='completed', feedback_data={'fallback': True}))
    db_session.flush()
    monkeypatch.setattr(route, 'SessionLocal', lambda: nullcontext(db_session))
    response = await route.stream_feedback_progress(answer.module_id,
        SimpleNamespace(is_disconnected=AsyncMock(return_value=False)), 1, answer.student_id)
    stream = response.body_iterator
    event = await anext(stream)
    assert event.startswith('event: progress')
    data = json.loads(event.split('data: ', 1)[1])
    assert data['ready'] == 0
    assert data['failed'] == 0
    assert data['feedback_retrying'] == 1
    assert data['all_complete'] is False
    await stream.aclose()


def test_successful_persisted_feedback_finishes_job(db_session, student_answer_mcq, monkeypatch):
    job = add_job(db_session, student_answer_mcq, 'processing')
    db_session.add(AIFeedback(answer_id=student_answer_mcq.id, generation_status='completed',
        feedback_data={'explanation': 'Use the product rule.', 'fallback': False}))
    db_session.flush()
    monkeypatch.setattr(worker, 'AIFeedbackService', lambda: MagicMock(
        generate_instant_feedback=MagicMock(return_value={'explanation': 'Use the product rule.'})))
    monkeypatch.setattr(worker, 'calculate_test_score', MagicMock())
    worker._generate_feedback_for_job(db_session, job)
    db_session.refresh(job)
    assert job.status == 'done'
    assert job.locked_at is None


def test_expired_lease_budget_does_not_renew_forever(monkeypatch):
    import threading
    lease = worker._JobLease('job', 1)
    lease.done = MagicMock(wait=MagicMock(return_value=False))
    monkeypatch.setattr(worker, '_stop_event', threading.Event())
    monkeypatch.setattr(worker, '_lost_leadership', threading.Event())
    monkeypatch.setattr(worker.time, 'monotonic', MagicMock(side_effect=[0, worker.MAX_JOB_LEASE_SECONDS]))
    renew = MagicMock()
    monkeypatch.setattr(worker, '_renew_job_lease', renew)
    lease._run()
    renew.assert_not_called()


def test_openai_retry_preserves_timeout_error(monkeypatch):
    import httpx
    import openai
    from tenacity import wait_none
    from app.services.openai_client import OpenAIClientWithRetry
    client = OpenAIClientWithRetry(api_key='sk-test-offline')
    error = openai.APITimeoutError(request=httpx.Request('POST', 'https://api.openai.com/v1/chat/completions'))
    create = MagicMock(side_effect=error)
    monkeypatch.setattr(client, '_next_client', lambda: SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create))))
    call = OpenAIClientWithRetry.create_chat_completion.retry_with(wait=wait_none())
    with pytest.raises(openai.APITimeoutError):
        call(client, messages=[{'role': 'user', 'content': 'Test'}])
    assert create.call_count == 2


def test_legacy_exhausted_done_fallback_does_not_enqueue_forever(client, db_session, student_answer_mcq, test_module, student_session):
    add_job(db_session, student_answer_mcq, 'done', retries=5)
    db_session.add(AIFeedback(answer_id=student_answer_mcq.id, generation_status='completed', feedback_data={'fallback':True,'explanation':'Unavailable'}))
    db_session.flush()
    for _ in range(2):
        result = client.get(f'/api/student/modules/{test_module.id}/feedback-status', headers=student_session).json()
        assert result['all_complete'] is True
        assert result['feedback_failed'] == 1
        assert result['feedback_ready'] == 0
        assert result['auto_retried'] == 0
    assert db_session.query(FeedbackJob).filter_by(answer_id=student_answer_mcq.id).count() == 1
