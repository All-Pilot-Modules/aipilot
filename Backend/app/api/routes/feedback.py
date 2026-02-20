from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from uuid import UUID
import asyncio
import json
import logging
import time
from datetime import datetime, timezone

from app.database import get_db, SessionLocal
from app.models.ai_feedback import AIFeedback
from app.models.student_answer import StudentAnswer
from app.models.feedback_job import FeedbackJob
from app.crud.ai_feedback import (
    get_feedback_by_answer,
    check_and_mark_timeout,
    reset_feedback_for_retry
)
from app.services.ai_feedback import AIFeedbackService

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/stream/{module_id}")
async def stream_feedback_progress(
    module_id: UUID,
    request: Request,
    student_id: str = Query(..., description="Student ID"),
    attempt: int = Query(1, description="Attempt number", ge=1),
):
    """
    SSE endpoint for real-time feedback generation progress.
    Pushes events as feedback completes instead of requiring polling.

    Events:
    - progress: {ready, total, percentage} — when a new feedback completes
    - complete: {ready, total} — when all feedback is done
    - heartbeat: {} — keep-alive every 15s

    Max duration: 6 minutes (matches frontend timeout).
    """

    async def event_generator():
        MAX_DURATION = 6 * 60  # 6 minutes
        POLL_DB_INTERVAL = 2.0  # seconds between DB checks (light on DB for 500 students)
        HEARTBEAT_INTERVAL = 15  # seconds between heartbeats
        start_time = time.time()
        last_heartbeat = start_time
        last_ready_count = -1

        try:
            while True:
                # Check if client disconnected
                if await request.is_disconnected():
                    break

                # Check max duration
                elapsed = time.time() - start_time
                if elapsed >= MAX_DURATION:
                    yield f"event: timeout\ndata: {json.dumps({'message': 'Stream timeout after 6 minutes'})}\n\n"
                    break

                # Single efficient query: count total, completed, and failed in one pass
                db = SessionLocal()
                try:
                    from sqlalchemy import case, literal_column
                    from sqlalchemy.orm import aliased

                    # Count total answers
                    total = (
                        db.query(func.count(StudentAnswer.id))
                        .filter(
                            StudentAnswer.student_id == student_id,
                            StudentAnswer.module_id == module_id,
                            StudentAnswer.attempt == attempt,
                        )
                        .scalar()
                    ) or 0

                    # Single query: count completed + failed in one pass
                    status_counts = dict(
                        db.query(
                            AIFeedback.generation_status,
                            func.count(AIFeedback.id)
                        )
                        .join(StudentAnswer, AIFeedback.answer_id == StudentAnswer.id)
                        .filter(
                            StudentAnswer.student_id == student_id,
                            StudentAnswer.module_id == module_id,
                            StudentAnswer.attempt == attempt,
                        )
                        .group_by(AIFeedback.generation_status)
                        .all()
                    )

                    ready = status_counts.get('completed', 0)
                    failed = status_counts.get('failed', 0) + status_counts.get('timeout', 0)

                    # Check pending jobs
                    pending_jobs = (
                        db.query(func.count(FeedbackJob.id))
                        .filter(
                            FeedbackJob.student_id == student_id,
                            FeedbackJob.module_id == module_id,
                            FeedbackJob.attempt == attempt,
                            FeedbackJob.status.in_(["queued", "processing"]),
                        )
                        .scalar()
                    ) or 0

                finally:
                    db.close()

                percentage = round((ready / total * 100), 1) if total > 0 else 0
                all_complete = (ready + failed) >= total and total > 0 and pending_jobs == 0

                # Send progress event if count changed
                if ready != last_ready_count:
                    last_ready_count = ready
                    event_data = {
                        "ready": ready,
                        "total": total,
                        "failed": failed,
                        "percentage": percentage,
                        "pending_jobs": pending_jobs,
                    }
                    yield f"event: progress\ndata: {json.dumps(event_data)}\n\n"

                # Send complete event and stop
                if all_complete:
                    yield f"event: complete\ndata: {json.dumps({'ready': ready, 'total': total, 'failed': failed})}\n\n"
                    break

                # Heartbeat to keep connection alive
                now = time.time()
                if now - last_heartbeat >= HEARTBEAT_INTERVAL:
                    last_heartbeat = now
                    yield f"event: heartbeat\ndata: {json.dumps({'elapsed': int(elapsed)})}\n\n"

                await asyncio.sleep(POLL_DB_INTERVAL)

        except asyncio.CancelledError:
            logger.info(f"[SSE] Stream cancelled for module {module_id}")
        except Exception as e:
            logger.error(f"[SSE] Error in stream for module {module_id}: {e}")
            yield f"event: error\ndata: {json.dumps({'message': str(e)[:200]})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )


@router.get("/{feedback_id}")
def get_ai_feedback_by_id(
    feedback_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Get AI feedback by ID.
    Returns the feedback details including feedback text, score, question_id, and metadata.
    Used by the feedback critiques page to display feedback details.
    """
    feedback = db.query(AIFeedback).filter(AIFeedback.id == feedback_id).first()

    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")

    # Get the associated answer to include question_id
    answer = db.query(StudentAnswer).filter(StudentAnswer.id == feedback.answer_id).first()

    if not answer:
        raise HTTPException(status_code=404, detail="Associated answer not found")

    # Build response with all necessary fields
    data = feedback.feedback_data or {}

    return {
        "id": str(feedback.id),
        "answer_id": str(feedback.answer_id),
        "question_id": str(answer.question_id),
        "feedback_text": data.get("explanation", "") or data.get("feedback", ""),
        "is_correct": feedback.is_correct,
        "score": feedback.score,
        "correctness_score": feedback.score,
        "points_earned": feedback.points_earned,
        "points_possible": feedback.points_possible,
        "criterion_scores": feedback.criterion_scores,
        "explanation": data.get("explanation", ""),
        "improvement_hint": data.get("improvement_hint"),
        "concept_explanation": data.get("concept_explanation"),
        "strengths": data.get("strengths"),
        "weaknesses": data.get("weaknesses"),
        "selected_option": data.get("selected_option"),
        "correct_option": data.get("correct_option"),
        "available_options": data.get("available_options"),
        "grading_details": data.get("grading_details"),
        "selected_options": data.get("selected_options"),
        "sub_results": data.get("sub_results"),
        "has_course_materials": data.get("used_rag", False),
        "generated_at": feedback.generated_at.isoformat() if feedback.generated_at else None,

        # Status tracking (NEW)
        "generation_status": feedback.generation_status,
        "generation_progress": feedback.generation_progress,
        "error_message": feedback.error_message,
        "error_type": feedback.error_type,
        "can_retry": feedback.can_retry,
        "retry_count": feedback.retry_count,
        "started_at": feedback.started_at.isoformat() if feedback.started_at else None,
        "completed_at": feedback.completed_at.isoformat() if feedback.completed_at else None,
        "generation_duration": feedback.generation_duration
    }


@router.get("/status/answer/{answer_id}")
def get_feedback_status_by_answer(
    answer_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Poll feedback generation status by answer ID.
    Frontend can call this endpoint every 2-3 seconds to check progress.

    Returns:
        Feedback status with progress percentage and error info if failed
    """
    # Check if feedback exists
    feedback = get_feedback_by_answer(db, answer_id)

    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found - generation may not have started")

    # Check for timeout
    check_and_mark_timeout(db, answer_id)

    # Refresh to get latest status
    db.refresh(feedback)

    # Get associated answer for question_id
    answer = db.query(StudentAnswer).filter(StudentAnswer.id == feedback.answer_id).first()

    return {
        "status": feedback.generation_status,
        "progress": feedback.generation_progress,
        "error_message": feedback.error_message,
        "error_type": feedback.error_type,
        "can_retry": feedback.can_retry,
        "retry_count": feedback.retry_count,
        "max_retries": feedback.max_retries,
        "started_at": feedback.started_at.isoformat() if feedback.started_at else None,
        "completed_at": feedback.completed_at.isoformat() if feedback.completed_at else None,
        "generation_duration": feedback.generation_duration,
        "answer_id": str(feedback.answer_id),
        "question_id": str(answer.question_id) if answer else None,

        # Include feedback data if completed
        "feedback": {
            "explanation": feedback.feedback_data.get("explanation") if feedback.feedback_data else None,
            "score": feedback.score,
            "is_correct": feedback.is_correct
        } if feedback.generation_status == 'completed' and feedback.feedback_data else None
    }


@router.post("/retry/answer/{answer_id}")
def retry_feedback_generation(
    answer_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Retry failed feedback generation for a single answer.

    Use this endpoint when:
    - generation_status is 'failed' or 'timeout'
    - can_retry is True
    - User clicks retry button

    Returns:
        New feedback status after retry is queued
    """
    feedback = get_feedback_by_answer(db, answer_id)

    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")

    # Check if retry is allowed
    if not feedback.can_retry:
        logger.warning(f"❌ Retry blocked for answer {answer_id}: Maximum retries ({feedback.max_retries}) exceeded")
        raise HTTPException(
            status_code=400,
            detail=f"Maximum retries ({feedback.max_retries}) exceeded. Cannot retry."
        )

    if feedback.generation_status not in ['failed', 'timeout']:
        logger.warning(f"❌ Retry blocked for answer {answer_id}: Invalid status '{feedback.generation_status}'")
        raise HTTPException(
            status_code=400,
            detail=f"Can only retry failed or timeout statuses. Current status: {feedback.generation_status}"
        )

    # Reset for retry
    logger.info(f"🔄 Initiating retry for answer {answer_id} (previous status: {feedback.generation_status})")
    feedback = reset_feedback_for_retry(db, answer_id)

    if not feedback:
        logger.error(f"❌ Failed to reset feedback for answer {answer_id}")
        raise HTTPException(status_code=500, detail="Failed to reset feedback for retry")

    # Get answer and question info
    answer = db.query(StudentAnswer).filter(StudentAnswer.id == answer_id).first()
    if not answer:
        logger.error(f"❌ Answer {answer_id} not found for retry")
        raise HTTPException(status_code=404, detail="Student answer not found")

    # Get module to check if this attempt should have AI feedback
    from app.crud.module import get_module_by_id
    module = get_module_by_id(db, str(answer.module_id))
    if not module:
        logger.error(f"❌ Module not found for answer {answer_id}")
        raise HTTPException(status_code=404, detail="Module not found")

    # Get max attempts from module settings (default to 2)
    max_attempts = 2
    if module.assignment_config:
        multiple_attempts_config = module.assignment_config.get("features", {}).get("multiple_attempts", {})
        max_attempts = multiple_attempts_config.get("max_attempts", 2)

    # IMPORTANT: Only allow retry for attempts that should have AI feedback
    # Final attempt (attempt >= max_attempts) is for teacher manual grading
    if answer.attempt >= max_attempts:
        logger.warning(f"❌ Retry blocked for answer {answer_id}: Attempt {answer.attempt} is the final attempt reserved for teacher grading (max_attempts={max_attempts})")
        raise HTTPException(
            status_code=400,
            detail=f"Cannot retry AI feedback for attempt {answer.attempt}. This is the final attempt reserved for teacher manual grading. AI feedback is only available for attempts 1-{max_attempts - 1}."
        )

    logger.info(f"📊 Retry attempt {feedback.retry_count}/{feedback.max_retries} for answer {answer_id}")

    # Trigger re-generation
    feedback_service = AIFeedbackService()
    try:
        result = feedback_service.generate_instant_feedback(
            db=db,
            student_answer=answer,
            question_id=str(answer.question_id),
            module_id=str(answer.module_id)
        )

        logger.info(f"✅ Retry successfully queued for answer {answer_id}")

        return {
            "success": True,
            "message": f"Retry initiated (attempt {feedback.retry_count}/{feedback.max_retries})",
            "status": result.get("generation_status", "pending"),
            "answer_id": str(answer_id),
            "retry_count": feedback.retry_count,
            "max_retries": feedback.max_retries,
            "poll_url": f"/api/feedback/status/answer/{answer_id}"
        }

    except Exception as e:
        logger.error(f"Failed to retry feedback generation: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retry feedback generation: {str(e)}"
        )


@router.post("/retry/module/{module_id}")
def retry_all_failed_feedback(
    module_id: UUID,
    student_id: str = Query(..., description="Student ID"),
    attempt: int = Query(1, description="Attempt number", ge=1),
    db: Session = Depends(get_db)
):
    """
    Retry feedback generation for ALL failed questions in a module/attempt.
    This works exactly like the initial submission - it regenerates feedback
    for all failed/timeout questions in parallel.

    Use this endpoint when:
    - One or more questions have failed/timeout feedback
    - User clicks "Regenerate All Feedback" button
    - You want to retry ALL failed questions at once (not one-by-one)

    Args:
        module_id: Module UUID
        student_id: Student ID
        attempt: Attempt number

    Returns:
        Status of the bulk retry operation with answer IDs being retried
    """
    from app.models.student_answer import StudentAnswer

    logger.info(f"🔄 ============ BULK RETRY REQUESTED ============")
    logger.info(f"🔄 Module: {module_id}, Student: {student_id}, Attempt: {attempt}")

    # Get module to validate
    from app.crud.module import get_module_by_id
    module = get_module_by_id(db, str(module_id))
    if not module:
        logger.error(f"❌ Module not found: {module_id}")
        raise HTTPException(status_code=404, detail="Module not found")

    # Get max attempts from module settings (default to 2)
    max_attempts = 2
    if module.assignment_config:
        multiple_attempts_config = module.assignment_config.get("features", {}).get("multiple_attempts", {})
        max_attempts = multiple_attempts_config.get("max_attempts", 2)

    # Validate attempt number
    if attempt >= max_attempts:
        logger.warning(f"❌ Bulk retry blocked: Attempt {attempt} is final attempt (max={max_attempts})")
        raise HTTPException(
            status_code=400,
            detail=f"Cannot retry AI feedback for attempt {attempt}. This is the final attempt reserved for teacher manual grading."
        )

    # Get all answers for this module/student/attempt
    answers = db.query(StudentAnswer).filter(
        StudentAnswer.student_id == student_id,
        StudentAnswer.module_id == module_id,
        StudentAnswer.attempt == attempt
    ).all()

    logger.info(f"📊 Found {len(answers) if answers else 0} total answers for this attempt")
    if not answers:
        logger.warning(f"⚠️ No answers found for student {student_id}, module {module_id}, attempt {attempt}")
        raise HTTPException(status_code=404, detail="No answers found for this attempt")

    # Filter answers that have failed/timeout feedback or no feedback at all
    # IMPORTANT: Also handle old feedback records from before status tracking was added
    # This is a TEMPORARY feature to fix previously failed feedback
    failed_answer_ids = []

    logger.info(f"🔍 Checking each answer for failed/incomplete feedback...")
    for idx, answer in enumerate(answers, 1):
        feedback = get_feedback_by_answer(db, answer.id)
        logger.info(f"📝 [{idx}/{len(answers)}] Answer {answer.id}: feedback_exists={feedback is not None}, status={feedback.generation_status if feedback else 'N/A'}, data_exists={feedback.feedback_data is not None if feedback else 'N/A'}")

        # Include if:
        # 1. No feedback exists at all (initial generation crashed before creating record)
        # 2. Feedback exists but generation_status is NULL (old record from before status tracking)
        # 3. Feedback exists but feedback_data is NULL or empty (generation never completed)
        # 4. Feedback exists with status='completed' BUT data is missing (data inconsistency)
        # 5. Feedback exists and is in failed/timeout status with can_retry=True

        if not feedback:
            logger.info(f"📝 Including answer {answer.id} - no feedback exists, creating pending record")
            # Create pending feedback record so background task can work properly
            from app.crud.ai_feedback import create_pending_feedback
            create_pending_feedback(db=db, answer_id=answer.id, timeout_seconds=45)
            failed_answer_ids.append(str(answer.id))

        elif feedback.generation_status is None:
            # Old feedback record without status tracking - treat as failed
            logger.info(f"🔧 Including answer {answer.id} - old record without generation_status (NULL)")
            # Reset retry count and mark for retry
            feedback.generation_status = 'failed'
            feedback.can_retry = True
            feedback.retry_count = 0
            feedback.max_retries = 3
            db.commit()
            failed_answer_ids.append(str(answer.id))

        elif feedback.generation_status not in ['pending', 'generating']:
            # Check if feedback data is actually usable (not NULL, not empty, has content)
            is_data_missing = False

            if feedback.feedback_data is None:
                # Case 1: feedback_data is NULL
                is_data_missing = True
                logger.info(f"🔧 Including answer {answer.id} - feedback_data is NULL")
            elif not feedback.feedback_data:
                # Case 2: feedback_data is empty dict {}
                is_data_missing = True
                logger.info(f"🔧 Including answer {answer.id} - feedback_data is empty dict")
            elif not feedback.feedback_data.get("explanation") and not feedback.feedback_data.get("feedback"):
                # Case 3: feedback_data exists but missing essential fields
                is_data_missing = True
                logger.info(f"🔧 Including answer {answer.id} - feedback_data missing explanation/feedback fields")
            elif feedback.score is None and feedback.is_correct is None:
                # Case 4: Status says 'completed' but score/correctness never set (data inconsistency)
                is_data_missing = True
                logger.info(f"🔧 Including answer {answer.id} - score and is_correct are NULL (data inconsistency)")

            if is_data_missing:
                # Mark as failed and retry
                feedback.generation_status = 'failed'
                feedback.can_retry = True
                if feedback.retry_count is None:
                    feedback.retry_count = 0
                if feedback.max_retries is None:
                    feedback.max_retries = 3
                db.commit()
                failed_answer_ids.append(str(answer.id))

        if feedback and feedback.generation_status in ['failed', 'timeout']:
            if feedback.can_retry:
                logger.info(f"🔄 Including answer {answer.id} - status: {feedback.generation_status}, can_retry: {feedback.can_retry}")
                # Reset for retry
                reset_feedback_for_retry(db, answer.id)
                # Only add if not already added
                if str(answer.id) not in failed_answer_ids:
                    failed_answer_ids.append(str(answer.id))
            else:
                logger.warning(f"⚠️ Skipping answer {answer.id} - max retries exceeded (retry_count: {feedback.retry_count}/{feedback.max_retries})")

        if feedback and str(answer.id) not in failed_answer_ids:
            logger.debug(f"⏭️  Skipping answer {answer.id} - status: {feedback.generation_status}, has_data: {feedback.feedback_data is not None}")

    if not failed_answer_ids:
        logger.warning(f"⚠️ ============ NO FAILED FEEDBACK FOUND ============")
        logger.warning(f"⚠️ Checked {len(answers)} answers, found 0 needing retry")
        logger.warning(f"⚠️ This might mean all feedback is complete OR the detection logic missed something")
        return {
            "success": True,
            "message": "No failed feedback found to retry. All feedback is already completed or pending.",
            "answers_retried": 0,
            "answer_ids": []
        }

    logger.info(f"Retrying {len(failed_answer_ids)} failed questions via job queue")

    # Enqueue retry jobs — the worker picks them up automatically
    from app.services.feedback_worker import create_feedback_job
    for answer_id_str in failed_answer_ids:
        create_feedback_job(
            db=db,
            answer_id=answer_id_str,
            student_id=student_id,
            module_id=str(module_id),
            attempt=attempt,
            priority=1,
        )

    return {
        "success": True,
        "message": f"Enqueued {len(failed_answer_ids)} feedback retries. The worker will process them shortly.",
        "answers_retried": len(failed_answer_ids),
        "answer_ids": failed_answer_ids,
        "total_answers": len(answers),
        "retry_count": len(failed_answer_ids),
        "poll_url": f"/api/student/modules/{module_id}/feedback-status?student_id={student_id}&attempt={attempt}"
    }
