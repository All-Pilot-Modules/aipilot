from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional

from app.models.module_batch import ModuleBatch
from app.models.question import Question
from app.schemas.module_batch import ModuleBatchCreate, ModuleBatchUpdate


def create_batch(db: Session, module_id: UUID, payload: ModuleBatchCreate) -> ModuleBatch:
    batch = ModuleBatch(module_id=module_id, **payload.dict())
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch


def get_batch_by_id(db: Session, batch_id: UUID) -> Optional[ModuleBatch]:
    return db.query(ModuleBatch).filter(ModuleBatch.id == batch_id).first()


def get_batches_by_module(db: Session, module_id: UUID) -> List[ModuleBatch]:
    return (
        db.query(ModuleBatch)
        .filter(ModuleBatch.module_id == module_id)
        .order_by(ModuleBatch.batch_order)
        .all()
    )


def update_batch(db: Session, batch_id: UUID, payload: ModuleBatchUpdate) -> Optional[ModuleBatch]:
    batch = get_batch_by_id(db, batch_id)
    if not batch:
        return None
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(batch, field, value)
    db.commit()
    db.refresh(batch)
    return batch


def delete_batch(db: Session, batch_id: UUID) -> bool:
    batch = get_batch_by_id(db, batch_id)
    if not batch:
        return False
    # Unassign questions from this batch (set batch_id → null, keep in module pool)
    db.query(Question).filter(Question.batch_id == batch_id).update({"batch_id": None})
    db.delete(batch)
    db.commit()
    return True


def assign_questions_to_batch(db: Session, batch_id: UUID, question_ids: List[UUID]) -> int:
    updated = (
        db.query(Question)
        .filter(Question.id.in_(question_ids))
        .update({"batch_id": batch_id}, synchronize_session=False)
    )
    db.commit()
    return updated


def remove_questions_from_batch(db: Session, batch_id: UUID, question_ids: List[UUID]) -> int:
    updated = (
        db.query(Question)
        .filter(Question.id.in_(question_ids), Question.batch_id == batch_id)
        .update({"batch_id": None}, synchronize_session=False)
    )
    db.commit()
    return updated


def get_questions_for_batch(db: Session, batch_id: UUID) -> List[Question]:
    return (
        db.query(Question)
        .filter(Question.batch_id == batch_id)
        .order_by(Question.question_order.nulls_last(), Question.id)
        .all()
    )


def get_unassigned_questions(db: Session, module_id: UUID) -> List[Question]:
    """Questions in the module pool not yet assigned to any batch."""
    return (
        db.query(Question)
        .filter(Question.module_id == module_id, Question.batch_id.is_(None))
        .order_by(Question.question_order.nulls_last(), Question.id)
        .all()
    )
