"""
Feedback Worker — concurrent background workers that drain the FeedbackJob queue.

Uses ThreadPoolExecutor(max_workers=10) for concurrent OpenAI calls.
Detects fallback results and retries instead of silently marking them as done.
Jobs survive server restarts because they live in the database.
"""

import logging
import threading
import time
import traceback
import uuid as _uuid_mod
from concurrent.futures import ThreadPoolExecutor, Future
from datetime import datetime, timezone, timedelta
from typing import List
from uuid import UUID

import random
from sqlalchemy import text, or_
from sqlalchemy.exc import IntegrityError

from app.database import SessionLocal, new_lease_session
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
JOB_HEARTBEAT_SECONDS = 20
MAX_JOB_LEASE_SECONDS = 600

# Sleep between poll cycles when the queue is empty
POLL_INTERVAL_EMPTY = 1.0

# Sleep between processing consecutive batches
POLL_INTERVAL_BUSY = 0.1

# Concurrent worker threads — 10 parallel OpenAI calls.
# Leader election keeps only ONE instance running the worker, so total
# concurrent OpenAI calls = MAX_WORKERS (not MAX_WORKERS × instance_count).
MAX_WORKERS = 10

# How often the leader refreshes its heartbeat (seconds)
HEARTBEAT_INTERVAL = 30

# How stale a heartbeat must be before another instance can steal leadership
LEADER_TAKEOVER_SECONDS = 90

# How often an instance that lost the leader election retries claiming it.
# Without this, an instance that starts within LEADER_TAKEOVER_SECONDS of the
# previous leader's last heartbeat (e.g. a quick local dev restart) would give
# up on ever running the worker for its entire lifetime.
LEADERSHIP_RETRY_SECONDS = 30

# The worker loop must tick within this window for the heartbeat thread to
# renew the DB lease. A hung/deadlocked loop stops updating _last_loop_tick,
# so the heartbeat withholds renewal and another instance can take over —
# without this, a stuck-but-not-crashed process would keep the lease forever.
LOOP_HEALTH_TIMEOUT = HEARTBEAT_INTERVAL * 2

# How often the leadership-supervising loop checks that the worker/heartbeat
# threads it started are still actually alive, independent of DB-lease
# health — catches a thread that died from an uncaught exception (not a
# hang) on a single-replica deployment, where no other instance exists to
# take over via the heartbeat/election path.
WORKER_LIVENESS_CHECK_SECONDS = 5

# Exponential backoff for job retries (queue-visibility delay, not a thread
# sleep) — small jitter avoids every retrying job in a batch becoming
# claimable at the exact same instant.
RETRY_BACKOFF_BASE_SECONDS = 2
RETRY_BACKOFF_MAX_SECONDS = 60
RETRY_BACKOFF_JITTER_SECONDS = 1.0

# Sanitized error buckets, so failures can be aggregated without parsing
# free-text error_message. Maps the raw exception/error type name (as already
# produced throughout ai_feedback.py) to a small, stable category.
_ERROR_CATEGORY_MAP = {
    "JSONDecodeError": "parsing",
    "AuthenticationError": "auth",
    "APITimeoutError": "timeout",
    "RateLimitError": "rate_limit",
    "APIConnectionError": "connection",
    "data_error": "data_error",
    "generation_error": "unknown",
}


from app.core.latency import timed

def _categorize_error(error_type: str | None) -> str:
    if not error_type:
        return "unknown"
    return _ERROR_CATEGORY_MAP.get(error_type, "unknown")


def _compute_backoff_seconds(retry_count: int) -> float:
    """Exponential backoff with jitter, capped at RETRY_BACKOFF_MAX_SECONDS."""
    base = min(RETRY_BACKOFF_BASE_SECONDS ** max(retry_count, 1), RETRY_BACKOFF_MAX_SECONDS)
    return base + random.uniform(0, RETRY_BACKOFF_JITTER_SECONDS)


# Unique ID for this process/instance — generated once at import time
INSTANCE_ID = str(_uuid_mod.uuid4())

# Global flag to stop the worker thread gracefully (full process shutdown)
_stop_event = threading.Event()
# Set when this instance discovers another instance now holds the lease —
# distinct from _stop_event because it means "stop processing and try to
# reclaim leadership", not "shut down entirely".
_lost_leadership = threading.Event()
# Updated every iteration of _worker_loop — read by the heartbeat thread to
# decide whether the loop is actually alive, not just the process.
_last_loop_tick: float = 0.0
_worker_thread: threading.Thread | None = None
_heartbeat_thread: threading.Thread | None = None
_election_thread: threading.Thread | None = None


# ─── public API ───────────────────────────────────────────────


def create_feedback_job(
    db,
    answer_id,
    student_id: str,
    module_id: str,
    attempt: int,
    priority: int = 1,
    previous_feedback_context=None,
    is_final_attempt: bool = False,
    content_hash: str | None = None,
    commit: bool = True,
):
    """
    Insert a FeedbackJob row.  Called from the submit-test endpoint
    (and, for speculative background grading, from the save-answer endpoint).

    Pass commit=False to add the job within an already-open transaction
    (e.g. so it lands atomically with the answer/submission that triggered
    it) — the caller then owns the final db.commit().

    A partial unique index (answer_id WHERE status IN ('queued','processing'))
    allows at most one active job per answer. If one already exists, the
    insert is rolled back to a SAVEPOINT (not the caller's whole transaction)
    and the existing active job is returned instead — a benign duplicate
    create race must never abort unrelated pending work in the same session.
    """
    job = FeedbackJob(
        answer_id=answer_id if isinstance(answer_id, UUID) else UUID(str(answer_id)),
        student_id=student_id,
        module_id=module_id if isinstance(module_id, UUID) else UUID(str(module_id)),
        attempt=attempt,
        priority=priority,
        previous_feedback_json=previous_feedback_context,  # JSONB — no json.dumps needed
        is_final_attempt=is_final_attempt,
        content_hash=content_hash,
    )
    try:
        with db.begin_nested():
            db.add(job)
            db.flush()
    except IntegrityError:
        logger.info(f"[worker] Answer {answer_id} already has an active job — skipping duplicate create")
        job = (
            db.query(FeedbackJob)
            .filter(
                FeedbackJob.answer_id == (answer_id if isinstance(answer_id, UUID) else UUID(str(answer_id))),
                FeedbackJob.status.in_(["queued", "processing"]),
            )
            .first()
        )
        if commit:
            db.commit()
        return job

    if commit:
        db.commit()
        db.refresh(job)
    logger.info(f"[worker] Created job {job.id} for answer {answer_id} (priority={priority})")
    return job


def create_feedback_jobs_batch(
    db,
    answer_ids: list,
    student_id: str,
    module_id: str,
    attempt: int,
    priority: int = 1,
    previous_feedback_context=None,
    is_final_attempt: bool = False,
    content_hashes: dict | None = None,
    commit: bool = True,
):
    """
    Insert multiple FeedbackJob rows, one per answer.
    Pass commit=False to land them atomically with other pending changes in
    the same transaction (caller owns the final db.commit()).

    content_hashes: optional {answer_id: content_hash} map, since each answer
    in the batch has its own content and therefore its own fingerprint.

    Each insert is wrapped in its own SAVEPOINT so one answer that already
    has an active job (duplicate-create race) is skipped without aborting
    the rest of the batch or any other pending work in this transaction.
    """
    mid = module_id if isinstance(module_id, UUID) else UUID(str(module_id))
    content_hashes = content_hashes or {}
    jobs = []
    skipped = 0
    for answer_id in answer_ids:
        aid = answer_id if isinstance(answer_id, UUID) else UUID(str(answer_id))
        job = FeedbackJob(
            answer_id=aid,
            student_id=student_id,
            module_id=mid,
            attempt=attempt,
            priority=priority,
            previous_feedback_json=previous_feedback_context,  # JSONB — no json.dumps needed
            is_final_attempt=is_final_attempt,
            content_hash=content_hashes.get(answer_id) or content_hashes.get(str(answer_id)),
        )
        try:
            with db.begin_nested():
                db.add(job)
                db.flush()
            jobs.append(job)
        except IntegrityError:
            skipped += 1
            logger.info(f"[worker] Answer {aid} already has an active job — skipping duplicate create")

    if commit:
        db.commit()
    logger.info(
        f"[worker] Created {len(jobs)} jobs in batch for student {student_id} attempt {attempt}"
        + (f" ({skipped} skipped as duplicates)" if skipped else "")
    )
    return jobs


def recover_stale_jobs():
    """
    Called once at startup — on EVERY instance, not just the leader — so this
    must only reset jobs that are actually stale by time, never every
    'processing' row unconditionally. A blanket reset would let a
    freshly-booting replica yank a job out from under another instance that
    is the current leader and is genuinely, recently processing it: exactly
    the double-processing this queue design exists to prevent.
    """
    db = SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(seconds=STALE_LOCK_SECONDS)
        stuck = (
            db.query(FeedbackJob)
            .filter(
                FeedbackJob.status.in_(["processing", "retry"]),
                or_(FeedbackJob.locked_at.is_(None), FeedbackJob.locked_at < cutoff),
            )
            .with_for_update(skip_locked=True)
            .all()
        )
        for job in stuck:
            previous_status = job.status
            job.status = "queued"
            job.locked_at = None
            job.available_at = None
            if not job.error_message:
                job.error_message = f"Reset on startup (was {previous_status})"
            logger.info(f"[worker] Recovered stale job {job.id} (answer {job.answer_id})")
        if stuck:
            db.commit()
            logger.info(f"[worker] Recovered {len(stuck)} stale jobs on startup")
    except Exception as e:
        logger.error(f"[worker] Error recovering stale jobs: {e}")
        db.rollback()
    finally:
        db.close()


def _try_claim_leadership(db) -> bool:
    """
    Atomically try to become the feedback worker leader.
    Uses a singleton row in worker_lock (id=1).
    Returns True if this instance is now the leader.
    """
    try:
        stale_interval = f"{LEADER_TAKEOVER_SECONDS} seconds"
        db.execute(text(f"""
            INSERT INTO worker_lock (id, instance_id, heartbeat, acquired_at)
            VALUES (1, :iid, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE
                SET instance_id = :iid,
                    heartbeat   = NOW(),
                    acquired_at = NOW()
                WHERE worker_lock.heartbeat < NOW() - INTERVAL '{stale_interval}'
                   OR worker_lock.instance_id = :iid
                   OR worker_lock.instance_id IS NULL
        """), {"iid": INSTANCE_ID})
        db.commit()

        row = db.execute(
            text("SELECT instance_id FROM worker_lock WHERE id = 1")
        ).fetchone()
        return row is not None and row[0] == INSTANCE_ID
    except Exception as e:
        logger.error(f"[worker] Leader election query failed: {e}")
        db.rollback()
        return False


def _release_leadership():
    """
    Give up the DB lock immediately (instance_id -> NULL) so a clean shutdown
    doesn't leave a fresh-looking heartbeat behind — without this, the next
    leader has to wait out the full LEADER_TAKEOVER_SECONDS window even though
    the old leader is actually gone.
    """
    db = SessionLocal()
    try:
        result = db.execute(
            text("UPDATE worker_lock SET instance_id = NULL WHERE id = 1 AND instance_id = :iid"),
            {"iid": INSTANCE_ID}
        )
        db.commit()
        if result.rowcount:
            logger.info(f"[worker] Instance {INSTANCE_ID[:8]} released leadership")
    except Exception as e:
        logger.warning(f"[worker] Failed to release leadership cleanly: {e}")
        db.rollback()
    finally:
        db.close()


def _update_heartbeat():
    """
    Background thread: keep the leader heartbeat alive every 30s — but only
    while the worker loop is actually healthy. Also detects losing the lease
    to another instance (e.g. because this one WAS unhealthy for long enough
    that someone else took over) and signals the worker loop to stop.
    """
    while not _stop_event.is_set():
        _stop_event.wait(timeout=HEARTBEAT_INTERVAL)
        if _stop_event.is_set():
            break

        loop_age = time.monotonic() - _last_loop_tick
        if loop_age > LOOP_HEALTH_TIMEOUT:
            logger.error(
                f"[worker] Processing loop unhealthy (no tick for {loop_age:.0f}s) — "
                f"withholding heartbeat renewal so another instance can take over"
            )
            continue

        db = SessionLocal()
        try:
            result = db.execute(
                text("UPDATE worker_lock SET heartbeat = NOW() WHERE id = 1 AND instance_id = :iid"),
                {"iid": INSTANCE_ID}
            )
            db.commit()
            if result.rowcount == 0:
                logger.warning(
                    f"[worker] Instance {INSTANCE_ID[:8]} no longer owns the worker lock "
                    f"— another instance took over leadership"
                )
                _lost_leadership.set()
        except Exception as e:
            logger.warning(f"[worker] Heartbeat update failed: {e}")
            db.rollback()
        finally:
            db.close()


def _launch_worker_threads():
    """Start the heartbeat and worker-loop threads. Caller must already hold leadership."""
    global _worker_thread, _heartbeat_thread, _last_loop_tick

    logger.info(f"[worker] Instance {INSTANCE_ID[:8]} is the leader — starting feedback worker")

    # Seed the tick so the heartbeat thread doesn't see a stale (zero) value
    # and immediately withhold renewal before the worker loop gets to run.
    _last_loop_tick = time.monotonic()
    _lost_leadership.clear()

    _heartbeat_thread = threading.Thread(
        target=_update_heartbeat, daemon=True, name="worker-heartbeat"
    )
    _heartbeat_thread.start()

    _worker_thread = threading.Thread(
        target=_worker_loop, daemon=True, name="feedback-worker"
    )
    _worker_thread.start()
    logger.info(f"[worker] Feedback worker started (max_workers={MAX_WORKERS})")


def _stop_local_worker_threads():
    """Join this instance's worker + heartbeat threads (they exit on _stop_event or _lost_leadership)."""
    global _worker_thread, _heartbeat_thread
    if _worker_thread is not None:
        _worker_thread.join(timeout=15)
        _worker_thread = None
    if _heartbeat_thread is not None:
        _heartbeat_thread.join(timeout=5)
        _heartbeat_thread = None


def _threads_alive() -> bool:
    """True only if both the worker loop and heartbeat threads are actually running."""
    return (
        _worker_thread is not None and _worker_thread.is_alive()
        and _heartbeat_thread is not None and _heartbeat_thread.is_alive()
    )


def _leadership_election_loop():
    """
    Keep attempting to claim leadership until this instance wins, then start
    the worker and supervise it. Runs as its own daemon thread so a process
    that loses the initial election (e.g. it started less than
    LEADER_TAKEOVER_SECONDS after the previous leader's last heartbeat)
    doesn't give up forever — it just keeps retrying every
    LEADERSHIP_RETRY_SECONDS, same as any other replica would once the old
    leader's heartbeat actually goes stale.

    If this instance later loses leadership (detected by the heartbeat
    thread), it stops its local worker and immediately tries to reclaim
    rather than exiting — mirrors the original one-shot behavior for the
    common "I'm still healthy, just lost a race" case while still protecting
    against split-brain (the worker loop is fully stopped before we retry).

    Also acts as a liveness watchdog: if the worker or heartbeat thread dies
    from an uncaught exception (not a hang — the loop health check handles
    that) while we still believe we're leader, nothing else would ever
    restart it on a single-replica deployment, since there's no other
    instance to take over via the election path. So we notice within
    WORKER_LIVENESS_CHECK_SECONDS and relaunch both threads ourselves —
    this is "ensure a healthy worker always claims queued jobs" even when
    there's only one process in the fleet.
    """
    while not _stop_event.is_set():
        db = SessionLocal()
        try:
            i_am_leader = _try_claim_leadership(db)
        finally:
            db.close()

        if i_am_leader:
            _launch_worker_threads()

            while not _stop_event.is_set() and not _lost_leadership.is_set():
                _stop_event.wait(timeout=WORKER_LIVENESS_CHECK_SECONDS)
                if _stop_event.is_set() or _lost_leadership.is_set():
                    break
                if not _threads_alive():
                    logger.error(
                        f"[worker] Instance {INSTANCE_ID[:8]} worker/heartbeat thread "
                        f"died unexpectedly while still leader — restarting it"
                    )
                    _stop_local_worker_threads()
                    _launch_worker_threads()

            if _stop_event.is_set():
                return

            logger.warning(
                f"[worker] Instance {INSTANCE_ID[:8]} lost leadership — "
                f"stopping local worker and re-entering election"
            )
            _stop_local_worker_threads()
            _lost_leadership.clear()
            continue

        logger.info(
            f"[worker] Instance {INSTANCE_ID[:8]} lost leader election — "
            f"retrying in {LEADERSHIP_RETRY_SECONDS}s"
        )
        _stop_event.wait(timeout=LEADERSHIP_RETRY_SECONDS)


def start_worker():
    """
    Try to become the feedback worker leader, then start the worker loop.
    Only one instance across all Cloud Run replicas will win the election.
    If this instance loses initially, it keeps retrying in the background
    rather than giving up for its whole lifetime. Idempotent — safe to call
    multiple times.
    """
    global _election_thread

    if _worker_thread is not None and _worker_thread.is_alive():
        logger.info("[worker] Worker already running on this instance")
        return

    if _election_thread is not None and _election_thread.is_alive():
        logger.info("[worker] Leader election already in progress on this instance")
        return

    _stop_event.clear()
    _lost_leadership.clear()
    _election_thread = threading.Thread(
        target=_leadership_election_loop, daemon=True, name="worker-leader-election"
    )
    _election_thread.start()


def stop_worker():
    """
    Signal the election, worker, and heartbeat threads to stop, then release
    the DB lock if we hold it — so the next leader (e.g. after a deploy)
    doesn't have to wait out LEADER_TAKEOVER_SECONDS for a heartbeat that
    will never come again.
    """
    _stop_event.set()
    _lost_leadership.set()  # wake the election loop's wait immediately
    if _election_thread is not None:
        _election_thread.join(timeout=LEADERSHIP_RETRY_SECONDS + 5)
    _stop_local_worker_threads()
    _release_leadership()
    logger.info("[worker] Feedback worker stopped")


def get_queue_stats():
    """
    Return job queue statistics for the diagnostics endpoint: counts by
    status, plus (over the last 24h of completed jobs) average/max queue
    wait and generation time, and a breakdown of failures by sanitized
    error_category — lets worker delays, model latency, and parsing
    failures be told apart instead of lumped into one "it's slow" signal.
    """
    db = SessionLocal()
    try:
        from sqlalchemy import func

        by_status = dict(
            db.query(FeedbackJob.status, func.count())
            .group_by(FeedbackJob.status)
            .all()
        )

        window_start = datetime.now(timezone.utc) - timedelta(hours=24)

        avg_queue_wait, max_queue_wait, avg_generation, max_generation = (
            db.query(
                func.avg(func.extract('epoch', FeedbackJob.generation_started_at - FeedbackJob.created_at)),
                func.max(func.extract('epoch', FeedbackJob.generation_started_at - FeedbackJob.created_at)),
                func.avg(func.extract('epoch', FeedbackJob.completed_at - FeedbackJob.generation_started_at)),
                func.max(func.extract('epoch', FeedbackJob.completed_at - FeedbackJob.generation_started_at)),
            )
            .filter(
                FeedbackJob.generation_started_at.isnot(None),
                FeedbackJob.completed_at.isnot(None),
                FeedbackJob.completed_at >= window_start,
            )
            .one()
        )

        error_categories = dict(
            db.query(FeedbackJob.error_category, func.count())
            .filter(
                FeedbackJob.error_category.isnot(None),
                FeedbackJob.completed_at >= window_start,
            )
            .group_by(FeedbackJob.error_category)
            .all()
        )

        return {
            "by_status": by_status,
            "timing_last_24h": {
                "avg_queue_wait_seconds": round(avg_queue_wait, 2) if avg_queue_wait is not None else None,
                "max_queue_wait_seconds": round(max_queue_wait, 2) if max_queue_wait is not None else None,
                "avg_generation_seconds": round(avg_generation, 2) if avg_generation is not None else None,
                "max_generation_seconds": round(max_generation, 2) if max_generation is not None else None,
            },
            "error_categories_last_24h": error_categories,
        }
    except Exception as e:
        logger.error(f"[worker] Error getting queue stats: {e}")
        return {}
    finally:
        db.close()


# ─── internal loop (concurrent) ───────────────────────────────


def _worker_loop():
    """Main loop: claim batches of jobs, process concurrently with ThreadPoolExecutor."""
    global _last_loop_tick
    logger.info(f"[worker] Worker loop starting (max_workers={MAX_WORKERS})")

    executor = ThreadPoolExecutor(max_workers=MAX_WORKERS, thread_name_prefix="fb-worker")
    active_futures: dict[Future, UUID] = {}  # future -> job_id
    _stale_check_counter = 0
    _consecutive_db_failures = 0  # track repeated connection errors to apply backoff

    try:
        while not _stop_event.is_set() and not _lost_leadership.is_set():
            # Prove to the heartbeat thread that this loop is actually alive —
            # a hang here (not a crash) is exactly the case the heartbeat's
            # health check exists to catch.
            _last_loop_tick = time.monotonic()
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

                    if jobs is None:
                        # None signals a DB connection error (distinct from empty queue)
                        _consecutive_db_failures += 1
                        backoff = min(2 ** _consecutive_db_failures, 60)
                        logger.warning(f"[worker] DB unreachable — backing off {backoff}s (failure #{_consecutive_db_failures})")
                        _stop_event.wait(timeout=backoff)
                    elif jobs:
                        _consecutive_db_failures = 0
                        for job_id in jobs:
                            future = executor.submit(_process_single_job, job_id)
                            active_futures[future] = job_id
                        time.sleep(POLL_INTERVAL_BUSY)
                    else:
                        _consecutive_db_failures = 0
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


@timed("_claim_next_jobs")
def _claim_next_jobs(limit: int):
    """
    Atomically claim up to `limit` queued jobs by setting them to 'processing'.
    Uses FOR UPDATE SKIP LOCKED for safe concurrency. Jobs with available_at
    in the future (scheduled retry backoff) are not yet claimable.
    Returns list of job IDs claimed, empty list if queue is empty,
    or None if a DB connection error occurred (caller applies backoff).
    """
    db = SessionLocal()
    claimed_ids = []
    try:
        now = datetime.now(timezone.utc)
        jobs = (
            db.query(FeedbackJob)
            .filter(
                FeedbackJob.status == "queued",
                or_(FeedbackJob.available_at.is_(None), FeedbackJob.available_at <= now),
            )
            .order_by(FeedbackJob.priority, FeedbackJob.created_at)
            .with_for_update(skip_locked=True)
            .limit(limit)
            .all()
        )
        if not jobs:
            return []

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
        return None  # signals connection error, not empty queue
    finally:
        db.close()


@timed("_process_single_job")
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
            .with_for_update(skip_locked=True)
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


def _renew_job_lease(job_id, locked_at):
    """Compare-and-swap: a stale worker cannot renew another claim's lease."""
    db = new_lease_session()
    try:
        if db.bind.dialect.name == 'postgresql':
            db.execute(text("SET LOCAL statement_timeout = '5s'"))
            db.execute(text("SET LOCAL lock_timeout = '2s'"))
        renewed_at = datetime.now(timezone.utc)
        changed = (db.query(FeedbackJob)
            .filter(FeedbackJob.id == job_id, FeedbackJob.status == 'processing',
                    FeedbackJob.locked_at == locked_at)
            .update({FeedbackJob.locked_at: renewed_at}, synchronize_session=False))
        db.commit()
        return renewed_at if changed else None
    except Exception as exc:
        db.rollback()
        logger.warning("[worker] Job %s lease renewal failed (%s)", job_id, type(exc).__name__)
        return locked_at  # retry next tick; stale recovery remains the safety net
    finally:
        db.close()


class _JobLease:
    """Renew only while this generation is running, with a bounded lifetime."""
    def __init__(self, job_id, locked_at):
        self.job_id = job_id
        self.locked_at = locked_at
        self.done = threading.Event()
        self.thread = threading.Thread(target=self._run, daemon=True, name='feedback-job-lease')

    def __enter__(self):
        self.thread.start()
        return self

    def __exit__(self, *exc):
        self.done.set()
        # Finish any in-flight renewal before the caller checks claim ownership.
        self.thread.join()

    def _run(self):
        deadline = time.monotonic() + MAX_JOB_LEASE_SECONDS
        while not self.done.wait(JOB_HEARTBEAT_SECONDS):
            if _stop_event.is_set() or _lost_leadership.is_set():
                return
            if time.monotonic() >= deadline:
                logger.warning('[worker] Job %s exceeded lease budget; allowing recovery', self.job_id)
                return
            renewed_at = _renew_job_lease(self.job_id, self.locked_at)
            if renewed_at is None:
                logger.warning('[worker] Job %s no longer owns its lease', self.job_id)
                return
            self.locked_at = renewed_at


def _still_owns_job(db, job_id: UUID, claimed_locked_at) -> bool:
    """
    True only if this job's locked_at is still exactly what we observed when
    we claimed it. If a job's attempt runs long enough to get reclaimed by
    _unlock_stale_jobs (worker presumed dead) and then claimed by another
    worker, this instance's eventually-arriving result must not clobber
    whatever the new claimant writes — locked_at changes on every claim and
    every stale-reset, so a mismatch here means ownership moved on.
    """
    if claimed_locked_at is None:
        return False
    return db.query(FeedbackJob.id).filter(
        FeedbackJob.id == job_id, FeedbackJob.status == 'processing',
        FeedbackJob.locked_at == claimed_locked_at,
    ).with_for_update().scalar() is not None



def _generate_feedback_for_job(db, job: FeedbackJob):
    """Run AIFeedbackService for a single job, then update status.
    KEY FIX: Detect fallback results and retry instead of silently accepting them."""
    job_id = job.id
    claimed_locked_at = job.locked_at
    try:
        answer = db.query(StudentAnswer).filter(StudentAnswer.id == job.answer_id).first()
        if not answer:
            job.status = "failed"
            job.error_message = "Answer not found"
            job.error_category = "data_error"
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
                all_attempts_context = job.previous_feedback_json  # JSONB already deserialized by SQLAlchemy
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

        # Stamp right before the AI call so (generation_started_at - created_at)
        # is pure queue wait and (completed_at - generation_started_at) is pure
        # generation time — the reset dance above is queue-side overhead, not
        # model latency.
        job.generation_started_at = datetime.now(timezone.utc)
        db.commit()

        feedback_service = AIFeedbackService()
        lease = _JobLease(job_id, claimed_locked_at)
        try:
            with lease:
                result = feedback_service.generate_instant_feedback(
                    db=db,
                    student_answer=answer,
                    question_id=str(answer.question_id),
                    module_id=str(job.module_id),
                    previous_feedback_context=previous_feedback_context,
                )
        finally:
            claimed_locked_at = lease.locked_at


        # The OpenAI call above can run long enough for _unlock_stale_jobs to
        # have reclaimed this job and another worker to have already claimed
        # and possibly finished it. Writing our (now stale) result over
        # theirs would silently regress a newer result — bail out instead.
        if not _still_owns_job(db, job_id, claimed_locked_at):
            logger.warning(
                f"[worker] Job {job_id} was reclaimed by another worker while this "
                f"attempt was in flight — discarding this result instead of overwriting"
            )
            return

        # ── KEY FIX: Check if the result is a fallback ──
        if not isinstance(result, dict):
            raise ValueError("Feedback generation returned an invalid result")
        is_fallback = bool(result.get("fallback", False))
        error_type = result.get("_error_type") or result.get("error_type") or "generation_error"

        if is_fallback:
            # Fallback due to an actual error (OpenAI failure, JSON parse, etc.)
            job.retry_count += 1
            error_msg = result.get("_error_message") or result.get("error_message") or "Unknown error"
            job.error_message = f"{error_type}: {error_msg}"
            job.error_category = _categorize_error(error_type)

            if job.retry_count >= job.max_retries:
                # Exhausted retries on an actual error — this must surface as
                # failed/retryable, never as a silently-"done" job whose
                # canned fallback text stands in for real feedback.
                job.status = "failed"
                job.completed_at = datetime.now(timezone.utc)
                job.locked_at = None
                db.commit()
                logger.warning(
                    f"[worker] Job {job.id} failed after {job.retry_count} retries "
                    f"({error_type}: {error_msg[:100]}) — marking feedback failed/retryable"
                )
                try:
                    mark_feedback_failed(db, job.answer_id, f"{error_type}: {error_msg}", _categorize_error(error_type))
                except Exception:
                    pass
                return  # Don't calculate score — needs a human-triggered retry
            else:
                # Re-queue, but not claimable again until the backoff window
                # elapses — a real scheduled delay via available_at, not a
                # thread-blocking sleep that stalls this worker thread while
                # leaving the job immediately reclaimable by another one.
                backoff = _compute_backoff_seconds(job.retry_count)
                job.status = "queued"
                job.locked_at = None
                job.available_at = datetime.now(timezone.utc) + timedelta(seconds=backoff)
                db.commit()
                logger.info(
                    f"[worker] Job {job.id} got fallback ({error_type}) — "
                    f"re-queuing in {backoff:.1f}s (retry {job.retry_count}/{job.max_retries})"
                )
                return  # Don't calculate score yet — job will be retried
        else:
            # The service may return generated text even if both persistence
            # attempts failed. Never finish a job until its result is saved.
            saved = db.query(AIFeedback).filter(AIFeedback.answer_id == job.answer_id).populate_existing().first()
            if (not saved or saved.generation_status != 'completed'
                    or not (saved.feedback_data or {}).get('explanation')
                    or (saved.feedback_data or {}).get('fallback')):
                raise RuntimeError("Generated feedback was not persisted as completed")
            job.status = "done"
            job.completed_at = datetime.now(timezone.utc)
            job.locked_at = None
            job.error_category = None  # clear any category from an earlier failed retry
            db.commit()
            if is_fallback:
                logger.info(f"[worker] Job {job.id} completed with fallback (no retryable error)")
            else:
                logger.info(f"[worker] Job {job.id} completed with real AI feedback")

        # Stamp the fingerprint of the answer content this result was generated for.
        # submit-test compares this against the answer's current hash to decide
        # whether the result can be reused or the answer changed since grading.
        # Recomputed from the content actually graded above (not job.content_hash,
        # which was captured at enqueue time and can be stale if the student edited
        # the answer again while this job was queued/processing) so a race between
        # two jobs for the same answer can never stamp the wrong hash.
        from app.utils.answer_hash import compute_answer_hash
        fb_row = db.query(AIFeedback).filter(AIFeedback.answer_id == job.answer_id).first()
        if fb_row:
            fb_row.content_hash = compute_answer_hash(answer.answer)
            db.commit()

        # Lock feedback from students according to the module's grading mode:
        #   - "manual": AI still grades, but nothing reaches the student until a
        #               teacher reviews and releases it — always gated (every attempt)
        #   - "auto":   shown immediately, unless the module explicitly opted into
        #               require_teacher_approval as a final-attempt safety net
        from app.models.module import Module
        module_obj = db.query(Module).filter(Module.id == job.module_id).first()
        ai_grading_mode = getattr(module_obj, "ai_grading_mode", "auto") or "auto"
        require_teacher_approval = bool(
            ((module_obj.ai_config or {}).get("grading", {}) if module_obj else {}).get(
                "require_teacher_approval", False
            )
        )

        gate_reason = None
        if ai_grading_mode == "manual":
            gate_reason = "manual grading mode (pending instructor review)"
        elif ai_grading_mode == "auto" and job.is_final_attempt and require_teacher_approval:
            gate_reason = "final attempt requires teacher approval"

        if gate_reason:
            fb = db.query(AIFeedback).filter(
                AIFeedback.answer_id == job.answer_id,
                AIFeedback.generation_status == 'completed',
            ).first()
            if fb:
                fb.released = False
                fb.requires_teacher_review = True
                db.commit()
                logger.info(
                    f"[worker] Feedback {fb.id} marked as unreleased ({gate_reason})"
                )

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

        # Same reclaim check as the success path — don't let a stale attempt's
        # exception handling (retry bump / failed mark) clobber whatever the
        # new claimant has already done with this job.
        if not _still_owns_job(db, job_id, claimed_locked_at):
            logger.warning(
                f"[worker] Job {job_id} was reclaimed by another worker — "
                f"not touching its retry/failure state from this stale attempt"
            )
            return

        job.retry_count += 1
        job.error_message = str(e)[:500]
        job.error_category = _categorize_error(type(e).__name__)
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
            backoff = _compute_backoff_seconds(job.retry_count)
            job.status = "queued"  # re-queue for retry
            job.available_at = datetime.now(timezone.utc) + timedelta(seconds=backoff)
            logger.info(f"[worker] Job {job.id} re-queued in {backoff:.1f}s (retry {job.retry_count}/{job.max_retries})")

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

        # Single JOIN: answers + questions + feedback in one query (not N+1)
        rows = (
            db.query(
                Question.points,
                AIFeedback.points_earned,
            )
            .join(StudentAnswer, StudentAnswer.question_id == Question.id)
            .outerjoin(AIFeedback, AIFeedback.answer_id == StudentAnswer.id)
            .filter(
                StudentAnswer.student_id == student_id,
                StudentAnswer.module_id == mid,
                StudentAnswer.attempt == attempt,
            )
            .all()
        )

        total_points_possible = 0.0
        total_points_earned = 0.0

        for q_points, fb_points_earned in rows:
            if q_points is not None:
                total_points_possible += q_points
            if fb_points_earned is not None:
                total_points_earned += fb_points_earned

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
