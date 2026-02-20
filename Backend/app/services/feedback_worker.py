"""
Feedback Worker — concurrent background workers that drain the FeedbackJob queue.

Uses ThreadPoolExecutor(max_workers=10) for concurrent OpenAI calls.
Detects fallback results and retries instead of silently marking them as done.
Jobs survive server restarts because they live in the database.
"""

import json
import logging
import threading
import time
import traceback
from concurrent.futures import ThreadPoolExecutor, Future
from datetime import datetime, timezone, timedelta
from typing import List
from uuid import UUID

from app.database import SessionLocal
from app.models.feedback_job import FeedbackJob
from app.models.student_answer import StudentAnswer
from app.models.ai_feedback import AIFeedback
from app.models.question import Question
from app.models.test_submission import TestSubmission
from app.services.ai_feedback import AIFeedbackService
from app.crud.ai_feedback import mark_feedback_failed

logger = logging.getLogger(__name__)

# How long a job can sit in 'processing' before we assume the worker died
STALE_LOCK_SECONDS = 120

# Sleep between poll cycles when the queue is empty
POLL_INTERVAL_EMPTY = 1.0

# Sleep between processing consecutive batches
POLL_INTERVAL_BUSY = 0.1

# Concurrent worker threads — 10 parallel OpenAI calls
# At ~2s per call, this processes ~300 questions/minute
MAX_WORKERS = 10

# Global flag to stop the worker thread gracefully
_stop_event = threading.Event()
_worker_thread: threading.Thread | None = None


# ─── public API ───────────────────────────────────────────────


def create_feedback_job(
    db,
    answer_id,
    student_id: str,
    module_id: str,
    attempt: int,
    priority: int = 1,
    previous_feedback_context=None,
):
    """
    Insert a FeedbackJob row.  Called from the submit-test endpoint.
    """
    previous_json = None
    if previous_feedback_context:
        try:
            previous_json = json.dumps(previous_feedback_context)
        except Exception:
            previous_json = None

    job = FeedbackJob(
        answer_id=answer_id if isinstance(answer_id, UUID) else UUID(str(answer_id)),
        student_id=student_id,
        module_id=module_id if isinstance(module_id, UUID) else UUID(str(module_id)),
        attempt=attempt,
        priority=priority,
        previous_feedback_json=previous_json,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    logger.info(f"[worker] Created job {job.id} for answer {answer_id} (priority={priority})")
    return job


def recover_stale_jobs():
    """
    Called once at startup.
    1. Any job stuck in 'processing' gets reset to 'queued' (server crashed mid-work).
    2. Any job in 'retry' gets reset to 'queued'.
    """
    db = SessionLocal()
    try:
        stuck = (
            db.query(FeedbackJob)
            .filter(FeedbackJob.status.in_(["processing", "retry"]))
            .all()
        )
        for job in stuck:
            job.status = "queued"
            job.locked_at = None
            job.error_message = (
                f"Reset on startup (was {job.status})"
                if not job.error_message
                else job.error_message
            )
            logger.info(f"[worker] Recovered stale job {job.id} (answer {job.answer_id})")
        if stuck:
            db.commit()
            logger.info(f"[worker] Recovered {len(stuck)} stale jobs on startup")
    except Exception as e:
        logger.error(f"[worker] Error recovering stale jobs: {e}")
        db.rollback()
    finally:
        db.close()


def start_worker():
    """Start the background worker thread (idempotent)."""
    global _worker_thread
    if _worker_thread is not None and _worker_thread.is_alive():
        logger.info("[worker] Worker already running")
        return
    _stop_event.clear()
    _worker_thread = threading.Thread(target=_worker_loop, daemon=True, name="feedback-worker")
    _worker_thread.start()
    logger.info(f"[worker] Feedback worker started (max_workers={MAX_WORKERS})")


def stop_worker():
    """Signal the worker to stop (used in tests / shutdown)."""
    _stop_event.set()
    if _worker_thread is not None:
        _worker_thread.join(timeout=15)
    logger.info("[worker] Feedback worker stopped")


def get_queue_stats():
    """Return job queue statistics for the diagnostics endpoint."""
    db = SessionLocal()
    try:
        from sqlalchemy import func
        stats = dict(
            db.query(FeedbackJob.status, func.count())
            .group_by(FeedbackJob.status)
            .all()
        )
        return stats
    except Exception as e:
        logger.error(f"[worker] Error getting queue stats: {e}")
        return {}
    finally:
        db.close()


# ─── internal loop (concurrent) ───────────────────────────────


def _worker_loop():
    """Main loop: claim batches of jobs, process concurrently with ThreadPoolExecutor."""
    logger.info(f"[worker] Worker loop starting (max_workers={MAX_WORKERS})")

    executor = ThreadPoolExecutor(max_workers=MAX_WORKERS, thread_name_prefix="fb-worker")
    active_futures: dict[Future, UUID] = {}  # future -> job_id
    _stale_check_counter = 0

    try:
        while not _stop_event.is_set():
            try:
                # Only check stale jobs every 30 iterations (~30s) to reduce DB load
                _stale_check_counter += 1
                if _stale_check_counter >= 30:
                    _stale_check_counter = 0
                    _unlock_stale_jobs()

                # Clean up completed futures
                done_futures = [f for f in active_futures if f.done()]
                for f in done_futures:
                    job_id = active_futures.pop(f)
                    try:
                        f.result()  # raise any exception from the thread
                    except Exception as e:
                        logger.error(f"[worker] Future for job {job_id} raised: {e}")

                # How many slots are free?
                available_slots = MAX_WORKERS - len(active_futures)

                if available_slots > 0:
                    jobs = _claim_next_jobs(limit=available_slots)

                    if jobs:
                        for job_id in jobs:
                            future = executor.submit(_process_single_job, job_id)
                            active_futures[future] = job_id
                        time.sleep(POLL_INTERVAL_BUSY)
                    else:
                        # No jobs available — sleep longer
                        _stop_event.wait(timeout=POLL_INTERVAL_EMPTY)
                else:
                    # All slots busy — wait briefly for one to finish
                    time.sleep(POLL_INTERVAL_BUSY)

            except Exception as e:
                logger.error(f"[worker] Unexpected error in worker loop: {e}")
                traceback.print_exc()
                time.sleep(5)
    finally:
        logger.info("[worker] Shutting down executor...")
        executor.shutdown(wait=True, cancel_futures=False)
        logger.info("[worker] Worker loop exited")


def _claim_next_jobs(limit: int) -> List[UUID]:
    """
    Atomically claim up to `limit` queued jobs by setting them to 'processing'.
    Uses FOR UPDATE SKIP LOCKED for safe concurrency.
    Returns list of job IDs that were claimed.
    """
    db = SessionLocal()
    claimed_ids = []
    try:
        jobs = (
            db.query(FeedbackJob)
            .filter(FeedbackJob.status == "queued")
            .order_by(FeedbackJob.priority, FeedbackJob.created_at)
            .with_for_update(skip_locked=True)
            .limit(limit)
            .all()
        )
        if not jobs:
            return []

        now = datetime.now(timezone.utc)
        for job in jobs:
            job.status = "processing"
            job.locked_at = now
            claimed_ids.append(job.id)

        db.commit()

        if claimed_ids:
            logger.info(f"[worker] Claimed {len(claimed_ids)} jobs: {[str(jid)[:8] for jid in claimed_ids]}")

        return claimed_ids

    except Exception as e:
        logger.error(f"[worker] Error claiming jobs: {e}")
        db.rollback()
        return []
    finally:
        db.close()


def _process_single_job(job_id: UUID):
    """
    Process a single job in its own DB session (thread-safe).
    Each worker thread gets its own session.
    """
    db = SessionLocal()
    try:
        job = db.query(FeedbackJob).filter(FeedbackJob.id == job_id).first()
        if not job:
            logger.error(f"[worker] Job {job_id} not found after claiming")
            return

        logger.info(
            f"[worker] Processing job {job.id} | answer={job.answer_id} | "
            f"retry={job.retry_count}/{job.max_retries}"
        )

        _generate_feedback_for_job(db, job)

    except Exception as e:
        logger.error(f"[worker] Error in _process_single_job({job_id}): {e}")
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


def _unlock_stale_jobs():
    """Reset jobs stuck in 'processing' for too long (worker died)."""
    db = SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(seconds=STALE_LOCK_SECONDS)
        stale = (
            db.query(FeedbackJob)
            .filter(
                FeedbackJob.status == "processing",
                FeedbackJob.locked_at.isnot(None),
                FeedbackJob.locked_at < cutoff,
            )
            .all()
        )
        for job in stale:
            job.status = "queued"
            job.locked_at = None
            job.error_message = f"Stale lock reset after {STALE_LOCK_SECONDS}s"
            logger.warning(f"[worker] Unlocked stale job {job.id}")
        if stale:
            db.commit()
    except Exception as e:
        logger.error(f"[worker] Error unlocking stale jobs: {e}")
        db.rollback()
    finally:
        db.close()


def _generate_feedback_for_job(db, job: FeedbackJob):
    """Run AIFeedbackService for a single job, then update status.
    KEY FIX: Detect fallback results and retry instead of silently accepting them."""
    try:
        answer = db.query(StudentAnswer).filter(StudentAnswer.id == job.answer_id).first()
        if not answer:
            job.status = "failed"
            job.error_message = "Answer not found"
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
            logger.error(f"[worker] Answer {job.answer_id} not found — marking job failed")
            mark_feedback_failed(db, job.answer_id, "Answer not found", "data_error")
            return

        # Reset existing ai_feedback row so generate_instant_feedback
        # doesn't short-circuit on stale completed/fallback data
        existing_fb = db.query(AIFeedback).filter(AIFeedback.answer_id == job.answer_id).first()
        if existing_fb:
            is_fallback = (existing_fb.feedback_data or {}).get('fallback', False)
            needs_reset = (
                existing_fb.generation_status in ('failed', 'timeout')
                or is_fallback
                or existing_fb.feedback_data is None
            )
            if needs_reset:
                existing_fb.generation_status = 'pending'
                existing_fb.generation_progress = 0
                existing_fb.feedback_data = None
                existing_fb.error_message = None
                existing_fb.error_type = None
                existing_fb.completed_at = None
                existing_fb.started_at = datetime.now(timezone.utc)
                db.commit()
                logger.info(f"[worker] Reset ai_feedback row for answer {job.answer_id} (was {'fallback' if is_fallback else existing_fb.generation_status})")

        # Deserialize previous feedback context if present
        previous_feedback_context = None
        if job.previous_feedback_json:
            try:
                all_attempts_context = json.loads(job.previous_feedback_json)
                # Extract per-question feedback from the context list
                question_id_str = str(answer.question_id)
                question_previous_feedback = []
                for attempt_ctx in all_attempts_context:
                    for fb in attempt_ctx.get("feedback", []):
                        if fb.get("question_id") == question_id_str:
                            question_previous_feedback.append({
                                "attempt": attempt_ctx.get("attempt"),
                                "ai_feedback": fb.get("ai_feedback"),
                                "score": fb.get("score"),
                                "student_answer": fb.get("student_answer"),
                            })
                if question_previous_feedback:
                    previous_feedback_context = question_previous_feedback
            except Exception as ctx_err:
                logger.warning(f"[worker] Could not parse previous_feedback_json: {ctx_err}")

        feedback_service = AIFeedbackService()
        result = feedback_service.generate_instant_feedback(
            db=db,
            student_answer=answer,
            question_id=str(answer.question_id),
            module_id=str(job.module_id),
            previous_feedback_context=previous_feedback_context,
        )

        # ── KEY FIX: Check if the result is a fallback ──
        is_fallback = result.get("fallback", False) if isinstance(result, dict) else False
        error_type = result.get("_error_type") or (result.get("error_type") if isinstance(result, dict) else None)

        if is_fallback and error_type:
            # Fallback due to an actual error (OpenAI failure, JSON parse, etc.)
            job.retry_count += 1
            error_msg = result.get("_error_message") or result.get("error_message") or "Unknown error"
            job.error_message = f"{error_type}: {error_msg}"

            if job.retry_count >= job.max_retries:
                # Exhausted retries — accept the fallback
                job.status = "done"
                job.completed_at = datetime.now(timezone.utc)
                job.locked_at = None
                db.commit()
                logger.warning(
                    f"[worker] Job {job.id} accepting fallback after {job.retry_count} retries "
                    f"({error_type}: {error_msg[:100]})"
                )
            else:
                # Re-queue for retry
                job.status = "queued"
                job.locked_at = None
                db.commit()
                logger.info(
                    f"[worker] Job {job.id} got fallback ({error_type}) — "
                    f"re-queuing (retry {job.retry_count}/{job.max_retries})"
                )
                # Brief backoff before retry becomes available
                time.sleep(min(2 ** job.retry_count, 10))
                return  # Don't calculate score yet — job will be retried
        else:
            # Real AI feedback OR fallback without error (e.g., missing question data)
            job.status = "done"
            job.completed_at = datetime.now(timezone.utc)
            job.locked_at = None
            db.commit()
            if is_fallback:
                logger.info(f"[worker] Job {job.id} completed with fallback (no retryable error)")
            else:
                logger.info(f"[worker] Job {job.id} completed with real AI feedback")

        # Check if all jobs for this attempt are done and calculate score
        calculate_test_score(job.student_id, str(job.module_id), job.attempt)

    except Exception as e:
        logger.error(f"[worker] Job {job.id} failed: {e}")
        traceback.print_exc()

        db.rollback()
        # Re-fetch job after rollback
        job = db.query(FeedbackJob).filter(FeedbackJob.id == job.id).first()
        if not job:
            return

        job.retry_count += 1
        job.error_message = str(e)[:500]
        job.locked_at = None

        if job.retry_count >= job.max_retries:
            job.status = "failed"
            job.completed_at = datetime.now(timezone.utc)
            logger.error(f"[worker] Job {job.id} exhausted retries ({job.max_retries})")
            # Mark the ai_feedback row as failed too
            try:
                mark_feedback_failed(db, job.answer_id, f"Exhausted {job.max_retries} retries: {str(e)[:200]}", "generation_error")
            except Exception:
                pass
        else:
            job.status = "queued"  # re-queue for retry
            logger.info(f"[worker] Job {job.id} re-queued (retry {job.retry_count}/{job.max_retries})")

        db.commit()


def calculate_test_score(student_id: str, module_id: str, attempt: int):
    """
    After all jobs for an attempt are done, calculate and save the total test score.
    Called from the worker after confirming all jobs are complete.
    """
    db = SessionLocal()
    try:
        # Check if ALL jobs for this student/module/attempt are done
        pending = (
            db.query(FeedbackJob)
            .filter(
                FeedbackJob.student_id == student_id,
                FeedbackJob.module_id == UUID(module_id) if isinstance(module_id, str) else module_id,
                FeedbackJob.attempt == attempt,
                FeedbackJob.status.in_(["queued", "processing", "retry"]),
            )
            .count()
        )
        if pending > 0:
            return  # Not all jobs done yet

        logger.info(f"[worker] All jobs done for {student_id} attempt {attempt} — calculating score")

        mid = UUID(module_id) if isinstance(module_id, str) else module_id

        answers = (
            db.query(StudentAnswer)
            .filter(
                StudentAnswer.student_id == student_id,
                StudentAnswer.module_id == mid,
                StudentAnswer.attempt == attempt,
            )
            .all()
        )

        total_points_possible = 0.0
        total_points_earned = 0.0

        for answer in answers:
            question = db.query(Question).filter(Question.id == answer.question_id).first()
            if question:
                total_points_possible += question.points

                feedback = db.query(AIFeedback).filter(AIFeedback.answer_id == answer.id).first()
                if feedback and feedback.points_earned is not None:
                    total_points_earned += feedback.points_earned

        percentage_score = (
            (total_points_earned / total_points_possible * 100) if total_points_possible > 0 else 0
        )

        submission = (
            db.query(TestSubmission)
            .filter(
                TestSubmission.student_id == student_id,
                TestSubmission.module_id == mid,
                TestSubmission.attempt == attempt,
            )
            .first()
        )

        if submission:
            submission.total_points_possible = total_points_possible
            submission.total_points_earned = total_points_earned
            submission.percentage_score = percentage_score
            db.commit()
            logger.info(
                f"[worker] Test score updated: {total_points_earned}/{total_points_possible} "
                f"({percentage_score:.1f}%)"
            )
        else:
            logger.warning(f"[worker] TestSubmission not found for attempt {attempt}")

    except Exception as e:
        logger.error(f"[worker] Error calculating test score: {e}")
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()
