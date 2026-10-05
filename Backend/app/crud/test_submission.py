from sqlalchemy.orm import Session
from app.models.test_submission import TestSubmission
from uuid import UUID
from typing import List, Optional

def create_submission(
    db: Session,
    student_id: str,
    module_id: UUID,
    attempt: int,
    questions_count: int,
    commit: bool = True,
) -> TestSubmission:
    """
    Create a test submission record.
    Pass commit=False to add it within an already-open transaction (e.g. so
    it lands atomically together with the FeedbackJob rows it triggers) —
    the caller then owns the final db.commit().
    """
    submission = TestSubmission(
        student_id=student_id,
        module_id=module_id,
        attempt=attempt,
        questions_count=questions_count
    )
    db.add(submission)
    if commit:
        db.commit()
        db.refresh(submission)
    else:
        db.flush()
    return submission

def get_submission(
    db: Session,
    student_id: str,
    module_id: UUID,
    attempt: int
) -> Optional[TestSubmission]:
    """Check if a specific attempt has been submitted"""
    return db.query(TestSubmission).filter(
        TestSubmission.student_id == student_id,
        TestSubmission.module_id == module_id,
        TestSubmission.attempt == attempt
    ).first()

def get_all_submissions(
    db: Session,
    student_id: str,
    module_id: UUID
) -> List[TestSubmission]:
    """Get all submissions for a student in a module, ordered by attempt"""
    return db.query(TestSubmission).filter(
        TestSubmission.student_id == student_id,
        TestSubmission.module_id == module_id
    ).order_by(TestSubmission.attempt).all()

def get_current_attempt_number(
    db: Session,
    student_id: str,
    module_id: UUID
) -> int:
    """
    Determine the current attempt number for a student.
    Returns 1 if no submissions, 2 if one submission, etc.
    """
    submissions = get_all_submissions(db, student_id, module_id)
    return len(submissions) + 1

def has_submitted_attempt(
    db: Session,
    student_id: str,
    module_id: UUID,
    attempt: int
) -> bool:
    """Check if a student has submitted a specific attempt"""
    return get_submission(db, student_id, module_id, attempt) is not None

def get_submission_count(
    db: Session,
    student_id: str,
    module_id: UUID
) -> int:
    """Get total number of submissions for a student in a module"""
    return db.query(TestSubmission).filter(
        TestSubmission.student_id == student_id,
        TestSubmission.module_id == module_id
    ).count()
