from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from uuid import UUID
import random
from datetime import datetime

from app.models.question_queue import QuestionQueue


def initialize_queue(
    db: Session,
    student_id: str,
    module_id: UUID,
    question_ids: List[UUID],
    randomize: bool = False
) -> List[QuestionQueue]:
    """
    Initialize the mastery queue for a student in a module.
    No-op (returns existing) if queue already exists for this student+module.
    """
    existing = db.query(QuestionQueue).filter(
        QuestionQueue.student_id == student_id,
        QuestionQueue.module_id == module_id
    ).all()

    if existing:
        return existing

    ordered = list(question_ids)
    if randomize:
        random.shuffle(ordered)

    entries = []
    for position, qid in enumerate(ordered):
        entry = QuestionQueue(
            student_id=student_id,
            module_id=module_id,
            question_id=qid,
            position=position,
            attempts=0,
            is_mastered=False,
            streak_count=0,
            last_attempt_at=None,
            created_at=datetime.utcnow()
        )
        db.add(entry)
        entries.append(entry)

    db.commit()
    for e in entries:
        db.refresh(e)
    return entries


def get_queue_state(
    db: Session,
    student_id: str,
    module_id: UUID
) -> List[QuestionQueue]:
    """Return all queue entries for a student in a module, ordered by position."""
    return (
        db.query(QuestionQueue)
        .filter(
            QuestionQueue.student_id == student_id,
            QuestionQueue.module_id == module_id
        )
        .order_by(QuestionQueue.position)
        .all()
    )


def get_mastery_progress(
    db: Session,
    student_id: str,
    module_id: UUID
) -> dict:
    """Return {total, mastered, all_mastered} for a student in a module."""
    total = db.query(func.count(QuestionQueue.id)).filter(
        QuestionQueue.student_id == student_id,
        QuestionQueue.module_id == module_id
    ).scalar() or 0

    mastered = db.query(func.count(QuestionQueue.id)).filter(
        QuestionQueue.student_id == student_id,
        QuestionQueue.module_id == module_id,
        QuestionQueue.is_mastered == True
    ).scalar() or 0

    return {
        "total": total,
        "mastered": mastered,
        "all_mastered": total > 0 and mastered >= total
    }


def get_next_unmastered(
    db: Session,
    student_id: str,
    module_id: UUID
) -> Optional[QuestionQueue]:
    """Return the lowest-position unmastered queue entry."""
    return (
        db.query(QuestionQueue)
        .filter(
            QuestionQueue.student_id == student_id,
            QuestionQueue.module_id == module_id,
            QuestionQueue.is_mastered == False
        )
        .order_by(QuestionQueue.position)
        .first()
    )


def reset_queue(
    db: Session,
    student_id: str,
    module_id: UUID
) -> List[QuestionQueue]:
    """
    Reset all streak counts and mastered flags for a student in a module,
    allowing them to practice again from scratch.
    """
    entries = db.query(QuestionQueue).filter(
        QuestionQueue.student_id == student_id,
        QuestionQueue.module_id == module_id
    ).all()

    for entry in entries:
        entry.streak_count = 0
        entry.is_mastered = False
        entry.attempts = 0
        entry.last_attempt_at = None

    db.commit()
    for e in entries:
        db.refresh(e)
    return entries


def update_streak(
    db: Session,
    student_id: str,
    question_id: UUID,
    module_id: UUID,
    is_correct: bool,
    reset_on_wrong: bool,
    streak_required: int
) -> Optional[QuestionQueue]:
    """
    Update streak_count after a student answers a question.
    - Correct: increment streak. If streak >= streak_required, mark is_mastered=True.
    - Wrong: reset streak if reset_on_wrong=True, otherwise leave streak unchanged.
    Increments attempts and updates last_attempt_at.
    """
    entry = db.query(QuestionQueue).filter(
        QuestionQueue.student_id == student_id,
        QuestionQueue.question_id == question_id,
        QuestionQueue.module_id == module_id
    ).first()

    if not entry:
        return None

    entry.attempts = (entry.attempts or 0) + 1
    entry.last_attempt_at = datetime.utcnow()

    if is_correct:
        entry.streak_count = (entry.streak_count or 0) + 1
        if entry.streak_count >= streak_required:
            entry.is_mastered = True
    else:
        if reset_on_wrong:
            entry.streak_count = 0

    db.commit()
    db.refresh(entry)
    return entry
