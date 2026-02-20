from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.models.ai_feedback import AIFeedback
from app.models.student_answer import StudentAnswer
from app.schemas.ai_feedback import AIFeedbackCreate
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

def create_feedback(db: Session, feedback: AIFeedbackCreate) -> AIFeedback:
    """Create new AI feedback record with proper race condition handling"""
    import logging
    logger = logging.getLogger(__name__)

    logger.info(f"🔍 CRUD: create_feedback called for answer_id: {feedback.answer_id}")

    # Use a database-level lock to prevent race conditions
    # Query with FOR UPDATE to lock the row if it exists
    existing = db.query(AIFeedback).filter(
        AIFeedback.answer_id == feedback.answer_id
    ).with_for_update().first()

    if existing:
        # Update existing feedback
        logger.info(f"📝 CRUD: Updating existing feedback with ID: {existing.id}")
        existing.is_correct = feedback.is_correct
        existing.score = feedback.score
        existing.feedback_data = feedback.feedback_data
        existing.points_earned = feedback.points_earned
        existing.points_possible = feedback.points_possible
        existing.criterion_scores = feedback.criterion_scores
        existing.confidence_level = feedback.confidence_level
        db.commit()
        db.refresh(existing)
        logger.info(f"✅ CRUD: Updated feedback ID: {existing.id}")
        return existing

    # Create new feedback
    logger.info(f"➕ CRUD: Creating new feedback record")
    db_feedback = AIFeedback(
        answer_id=feedback.answer_id,
        is_correct=feedback.is_correct,
        score=feedback.score,
        feedback_data=feedback.feedback_data,
        points_earned=feedback.points_earned,
        points_possible=feedback.points_possible,
        criterion_scores=feedback.criterion_scores,
        confidence_level=feedback.confidence_level
    )

    try:
        db.add(db_feedback)
        logger.info(f"💾 CRUD: Committing new feedback to database")
        db.commit()
        db.refresh(db_feedback)
        logger.info(f"✅ CRUD: Created new feedback with ID: {db_feedback.id}")
        return db_feedback
    except IntegrityError:
        # Race condition: another transaction created the feedback
        # Rollback and fetch the existing record
        logger.warning(f"⚠️ CRUD: IntegrityError caught - feedback already exists, fetching existing record")
        db.rollback()
        existing = db.query(AIFeedback).filter(
            AIFeedback.answer_id == feedback.answer_id
        ).first()
        if existing:
            # Update the existing record with new data
            existing.is_correct = feedback.is_correct
            existing.score = feedback.score
            existing.feedback_data = feedback.feedback_data
            existing.points_earned = feedback.points_earned
            existing.points_possible = feedback.points_possible
            existing.criterion_scores = feedback.criterion_scores
            existing.confidence_level = feedback.confidence_level
            db.commit()
            db.refresh(existing)
            logger.info(f"✅ CRUD: Updated existing feedback after race condition, ID: {existing.id}")
            return existing
        else:
            # This should not happen, but raise if it does
            logger.error(f"❌ CRUD: IntegrityError but no existing record found")
            raise

def get_feedback_by_answer(db: Session, answer_id: UUID) -> Optional[AIFeedback]:
    """Get feedback for a specific answer"""
    return db.query(AIFeedback).filter(AIFeedback.answer_id == answer_id).first()

def get_student_module_feedback(
    db: Session,
    student_id: str,
    module_id: UUID
) -> List[AIFeedback]:
    """Get all feedback for a student in a module"""
    return db.query(AIFeedback).join(
        StudentAnswer, AIFeedback.answer_id == StudentAnswer.id
    ).filter(
        StudentAnswer.student_id == student_id,
        StudentAnswer.module_id == module_id
    ).order_by(AIFeedback.generated_at.desc()).all()

def delete_feedback(db: Session, feedback_id: UUID) -> bool:
    """Delete feedback"""
    db_feedback = db.query(AIFeedback).filter(AIFeedback.id == feedback_id).first()
    if db_feedback:
        db.delete(db_feedback)
        db.commit()
        return True
    return False


# ==================== NEW: STATUS TRACKING FUNCTIONS ====================

def create_pending_feedback(
    db: Session,
    answer_id: UUID,
    timeout_seconds: int = 45
) -> AIFeedback:
    """
    Create a placeholder feedback row BEFORE generation starts.
    This allows frontend to poll status immediately.

    Args:
        db: Database session
        answer_id: UUID of the student answer
        timeout_seconds: Maximum time allowed for generation (default 45s)

    Returns:
        AIFeedback object with status='pending' and feedback_data=None
    """
    logger.info(f"📝 Creating pending feedback for answer {answer_id}")

    # Check if feedback already exists
    existing = db.query(AIFeedback).filter(
        AIFeedback.answer_id == answer_id
    ).first()

    if existing:
        logger.info(f"✅ Feedback already exists for answer {answer_id}, returning existing")
        return existing

    # Create new placeholder
    db_feedback = AIFeedback(
        answer_id=answer_id,
        generation_status='pending',
        generation_progress=0,
        feedback_data=None,  # Will be populated after generation
        is_correct=None,
        score=None,
        points_earned=None,
        points_possible=None,
        timeout_seconds=timeout_seconds,
        can_retry=True,
        retry_count=0,
        started_at=datetime.now(timezone.utc)
    )

    try:
        db.add(db_feedback)
        db.commit()
        db.refresh(db_feedback)
        logger.info(f"✅ Created pending feedback with ID: {db_feedback.id}")
        return db_feedback
    except IntegrityError:
        # Race condition - another process created it
        db.rollback()
        existing = db.query(AIFeedback).filter(
            AIFeedback.answer_id == answer_id
        ).first()
        logger.warning(f"⚠️ Race condition: feedback already created, returning existing")
        return existing


def update_feedback_status(
    db: Session,
    answer_id: UUID,
    status: str,
    progress: Optional[int] = None,
    error_message: Optional[str] = None,
    error_type: Optional[str] = None,
    ai_model: Optional[str] = None
) -> Optional[AIFeedback]:
    """
    Update feedback generation status.

    Args:
        db: Database session
        answer_id: Answer UUID
        status: New status ('pending', 'generating', 'completed', 'failed', 'timeout')
        progress: Progress percentage (0-100)
        error_message: Error message if failed
        error_type: Type of error ('timeout', 'api_error', 'parse_error', 'network_error')
        ai_model: AI model used

    Returns:
        Updated AIFeedback object
    """
    feedback = get_feedback_by_answer(db, answer_id)
    if not feedback:
        logger.error(f"❌ Feedback not found for answer {answer_id}")
        return None

    # Update status
    feedback.generation_status = status
    if progress is not None:
        feedback.generation_progress = progress
    if error_message:
        feedback.error_message = error_message
    if error_type:
        feedback.error_type = error_type
    if ai_model:
        feedback.ai_model_used = ai_model

    # Set completed_at if terminal status
    if status in ['completed', 'failed', 'timeout'] and not feedback.completed_at:
        feedback.completed_at = datetime.now(timezone.utc)

        # Calculate generation duration
        if feedback.started_at:
            # Handle timezone mismatch (old data might be naive, new data is aware)
            started_at = feedback.started_at
            if started_at.tzinfo is None:
                started_at = started_at.replace(tzinfo=timezone.utc)
            duration = (feedback.completed_at - started_at).total_seconds()
            feedback.generation_duration = int(duration)

    # Update can_retry flag
    if status in ['failed', 'timeout']:
        feedback.can_retry = feedback.retry_count < feedback.max_retries

    db.commit()
    db.refresh(feedback)
    logger.info(f"📊 Updated feedback status for answer {answer_id}: {status} ({progress}%)")
    return feedback


def complete_feedback_generation(
    db: Session,
    answer_id: UUID,
    feedback_data: dict,
    is_correct: Optional[bool],
    score: Optional[int],
    points_earned: Optional[float],
    points_possible: Optional[float],
    criterion_scores: Optional[dict],
    confidence_level: Optional[str],
    ai_model: Optional[str]
) -> Optional[AIFeedback]:
    """
    Mark feedback as completed and save the generated data.

    Args:
        db: Database session
        answer_id: Answer UUID
        feedback_data: Generated feedback content
        is_correct: Whether answer is correct
        score: Score (0-100)
        points_earned: Points earned
        points_possible: Points possible
        criterion_scores: Rubric criterion scores
        confidence_level: Confidence level
        ai_model: AI model used

    Returns:
        Updated AIFeedback object
    """
    feedback = get_feedback_by_answer(db, answer_id)
    if not feedback:
        logger.error(f"❌ Feedback not found for answer {answer_id}")
        return None

    # Update with generated data
    feedback.generation_status = 'completed'
    feedback.generation_progress = 100
    feedback.feedback_data = feedback_data
    feedback.is_correct = is_correct
    feedback.score = score
    feedback.points_earned = points_earned
    feedback.points_possible = points_possible
    feedback.criterion_scores = criterion_scores
    feedback.confidence_level = confidence_level
    feedback.ai_model_used = ai_model
    feedback.completed_at = datetime.now(timezone.utc)

    # Calculate duration
    if feedback.started_at:
        # Handle timezone mismatch (old data might be naive, new data is aware)
        started_at = feedback.started_at
        if started_at.tzinfo is None:
            started_at = started_at.replace(tzinfo=timezone.utc)
        duration = (feedback.completed_at - started_at).total_seconds()
        feedback.generation_duration = int(duration)

    db.commit()
    db.refresh(feedback)
    logger.info(f"✅ Completed feedback generation for answer {answer_id} (took {feedback.generation_duration}s)")
    return feedback


def mark_feedback_failed(
    db: Session,
    answer_id: UUID,
    error_message: str,
    error_type: str = 'api_error'
) -> Optional[AIFeedback]:
    """
    Mark feedback generation as failed.

    Args:
        db: Database session
        answer_id: Answer UUID
        error_message: Error description
        error_type: Type of error

    Returns:
        Updated AIFeedback object
    """
    feedback = get_feedback_by_answer(db, answer_id)
    if not feedback:
        logger.error(f"❌ Feedback not found for answer {answer_id}")
        return None

    feedback.generation_status = 'failed'
    feedback.error_message = error_message
    feedback.error_type = error_type
    feedback.completed_at = datetime.now(timezone.utc)
    feedback.can_retry = feedback.retry_count < feedback.max_retries

    # Calculate duration
    if feedback.started_at:
        # Handle timezone mismatch (old data might be naive, new data is aware)
        started_at = feedback.started_at
        if started_at.tzinfo is None:
            started_at = started_at.replace(tzinfo=timezone.utc)
        duration = (feedback.completed_at - started_at).total_seconds()
        feedback.generation_duration = int(duration)

    db.commit()
    db.refresh(feedback)
    logger.error(f"❌ Marked feedback as failed for answer {answer_id}: {error_message}")
    return feedback


def check_and_mark_timeout(db: Session, answer_id: UUID) -> Optional[bool]:
    """
    Check if feedback generation has timed out and mark it if so.

    Args:
        db: Database session
        answer_id: Answer UUID

    Returns:
        True if timed out, False if still within timeout, None if feedback not found
    """
    feedback = get_feedback_by_answer(db, answer_id)
    if not feedback:
        return None

    # Only check timeout for 'generating' or 'pending' status
    if feedback.generation_status not in ['generating', 'pending']:
        return False

    # Calculate elapsed time
    if not feedback.started_at:
        return False

    # Handle both timezone-aware and timezone-naive datetimes
    started_at = feedback.started_at
    if started_at.tzinfo is None:
        # Make timezone-naive datetime UTC-aware
        started_at = started_at.replace(tzinfo=timezone.utc)

    elapsed = (datetime.now(timezone.utc) - started_at).total_seconds()

    if elapsed > feedback.timeout_seconds:
        # Mark as timed out
        feedback.generation_status = 'timeout'
        feedback.error_message = f"Generation exceeded {feedback.timeout_seconds}s timeout"
        feedback.error_type = 'timeout'
        feedback.completed_at = datetime.now(timezone.utc)
        feedback.generation_duration = int(elapsed)
        feedback.can_retry = feedback.retry_count < feedback.max_retries

        db.commit()
        db.refresh(feedback)
        logger.warning(f"⏱️ Feedback generation timed out for answer {answer_id} after {elapsed}s")
        return True

    return False


def cleanup_stale_feedback(
    db: Session,
    module_id: UUID,
    student_id: str
) -> int:
    """
    Cleanup stale feedback that has been stuck in 'pending' or 'generating' status.
    This catches silent failures where the background task crashed.

    Args:
        db: Database session
        module_id: Module UUID
        student_id: Student ID

    Returns:
        Number of feedback rows marked as failed
    """
    from app.models.student_answer import StudentAnswer

    # Find all feedback in pending/generating status
    stale_feedback = db.query(AIFeedback).join(
        StudentAnswer, AIFeedback.answer_id == StudentAnswer.id
    ).filter(
        StudentAnswer.student_id == student_id,
        StudentAnswer.module_id == module_id,
        AIFeedback.generation_status.in_(['pending', 'generating'])
    ).all()

    marked_failed = 0
    current_time = datetime.now(timezone.utc)

    for feedback in stale_feedback:
        should_mark_failed = False
        error_msg = ""

        if not feedback.started_at:
            # Feedback was created but never started - background task crashed before starting
            should_mark_failed = True
            error_msg = "Generation never started (background task may have crashed)"
            elapsed = 0
        else:
            # Check if timeout exceeded
            # Handle both timezone-aware and timezone-naive datetimes
            started_at = feedback.started_at
            if started_at.tzinfo is None:
                # Make timezone-naive datetime UTC-aware
                started_at = started_at.replace(tzinfo=timezone.utc)

            elapsed = (current_time - started_at).total_seconds()
            if elapsed > feedback.timeout_seconds:
                should_mark_failed = True
                error_msg = f"Generation exceeded {feedback.timeout_seconds}s timeout (background task may have crashed)"

        if should_mark_failed:
            feedback.generation_status = 'timeout'
            feedback.error_message = error_msg
            feedback.error_type = 'timeout'
            feedback.completed_at = current_time
            feedback.generation_duration = int(elapsed) if feedback.started_at else 0
            feedback.can_retry = feedback.retry_count < feedback.max_retries
            marked_failed += 1
            logger.warning(f"⚠️ Marked stale feedback as timeout for answer {feedback.answer_id} (elapsed: {elapsed}s)")

    if marked_failed > 0:
        db.commit()
        logger.info(f"🧹 Cleanup: Marked {marked_failed} stale feedback rows as failed")

    return marked_failed


def reset_feedback_for_retry(db: Session, answer_id: UUID) -> Optional[AIFeedback]:
    """
    Reset feedback status for retry attempt.

    Args:
        db: Database session
        answer_id: Answer UUID

    Returns:
        Updated AIFeedback object ready for retry
    """
    feedback = get_feedback_by_answer(db, answer_id)
    if not feedback:
        logger.error(f"❌ Feedback not found for answer {answer_id}")
        return None

    # Check if retry is allowed
    if not feedback.can_retry:
        logger.warning(f"⚠️ Cannot retry feedback for answer {answer_id}: max retries exceeded")
        return None

    if feedback.generation_status not in ['failed', 'timeout']:
        logger.warning(f"⚠️ Cannot retry feedback for answer {answer_id}: status is {feedback.generation_status}")
        return None

    # Reset for retry
    feedback.generation_status = 'pending'
    feedback.generation_progress = 0
    feedback.error_message = None
    feedback.error_type = None
    feedback.started_at = datetime.now(timezone.utc)
    feedback.completed_at = None
    feedback.generation_duration = None
    feedback.retry_count += 1
    feedback.can_retry = feedback.retry_count < feedback.max_retries

    db.commit()
    db.refresh(feedback)
    logger.info(f"🔄 Reset feedback for retry: answer {answer_id}, attempt {feedback.retry_count}/{feedback.max_retries}")
    return feedback
