"""Job state transitions tested without starting background threads."""
from datetime import datetime, timezone
from unittest.mock import MagicMock
import pytest
from app.models.feedback_job import FeedbackJob
from app.services import feedback_worker as worker


@pytest.fixture
def job(db_session, student_answer_mcq):
    answer = student_answer_mcq
    row = FeedbackJob(answer_id=answer.id, student_id=answer.student_id, module_id=answer.module_id,
                      attempt=1, status="processing", locked_at=datetime.now(timezone.utc), max_retries=2)
    db_session.add(row)
    db_session.flush()
    return row


@pytest.mark.parametrize("error,category", [("RateLimitError", "rate_limit"), ("APITimeoutError", "timeout"),
    ("JSONDecodeError", "parsing"), ("AuthenticationError", "auth")])
def test_provider_error_requeues_with_scheduled_backoff(db_session, job, monkeypatch, error, category):
    result = {"fallback": True, "_error_type": error, "_error_message": "synthetic failure"}
    monkeypatch.setattr(worker, "AIFeedbackService", lambda: MagicMock(generate_instant_feedback=MagicMock(return_value=result)))
    monkeypatch.setattr(worker, "_still_owns_job", lambda *args: True)
    scoring = MagicMock()
    monkeypatch.setattr(worker, "calculate_test_score", scoring)
    before = datetime.now(timezone.utc)
    worker._generate_feedback_for_job(db_session, job)
    db_session.refresh(job)
    assert job.status == "queued"
    assert job.retry_count == 1
    assert job.error_category == category
    assert job.available_at.replace(tzinfo=timezone.utc) > before
    assert job.locked_at is None
    scoring.assert_not_called()


def test_exhausted_job_is_failed_not_completed(db_session, job, monkeypatch):
    job.retry_count = 1
    result = {"fallback": True, "_error_type": "APITimeoutError", "_error_message": "synthetic timeout"}
    monkeypatch.setattr(worker, "AIFeedbackService", lambda: MagicMock(generate_instant_feedback=MagicMock(return_value=result)))
    monkeypatch.setattr(worker, "_still_owns_job", lambda *args: True)
    failed = MagicMock()
    monkeypatch.setattr(worker, "mark_feedback_failed", failed)
    worker._generate_feedback_for_job(db_session, job)
    db_session.refresh(job)
    assert job.status == "failed"
    failed.assert_called_once()


def test_backoff_is_bounded():
    for retry in range(1, 20):
        delay = worker._compute_backoff_seconds(retry)
        assert 2 <= delay <= worker.RETRY_BACKOFF_MAX_SECONDS + worker.RETRY_BACKOFF_JITTER_SECONDS
