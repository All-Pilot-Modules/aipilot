from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional

from app.database import get_db
from app.schemas.module_batch import (
    ModuleBatchCreate, ModuleBatchUpdate, ModuleBatchOut,
    BatchStatusUpdate, AssignQuestionsPayload,
)
from app.crud.module_batch import (
    create_batch, get_batch_by_id, get_batches_by_module,
    update_batch, delete_batch,
    assign_questions_to_batch, remove_questions_from_batch,
    get_questions_for_batch, get_unassigned_questions,
)
from app.crud.module import get_module_by_id

router = APIRouter()

VALID_BATCH_TYPES = {"practice", "quiz", "exam", "review"}
VALID_STATUSES = {"draft", "active", "locked"}
VALID_GRADING_MODES = {"visible", "teacher_only", "disabled"}


# ── Teacher: manage batches ───────────────────────────────────────────────────

@router.post("/modules/{module_id}/batches", response_model=ModuleBatchOut)
def create_module_batch(
    module_id: UUID,
    payload: ModuleBatchCreate,
    db: Session = Depends(get_db),
):
    """Create a new batch (phase) inside a module."""
    if not get_module_by_id(db, module_id):
        raise HTTPException(status_code=404, detail="Module not found")
    if payload.batch_type not in VALID_BATCH_TYPES:
        raise HTTPException(status_code=400, detail=f"batch_type must be one of {VALID_BATCH_TYPES}")
    if payload.ai_grading_mode and payload.ai_grading_mode not in VALID_GRADING_MODES:
        raise HTTPException(status_code=400, detail=f"ai_grading_mode must be one of {VALID_GRADING_MODES}")
    return create_batch(db, module_id, payload)


@router.get("/modules/{module_id}/batches", response_model=List[ModuleBatchOut])
def list_module_batches(module_id: UUID, db: Session = Depends(get_db)):
    """List all batches for a module, ordered by batch_order."""
    return get_batches_by_module(db, module_id)


@router.get("/modules/{module_id}/batches/{batch_id}", response_model=ModuleBatchOut)
def get_module_batch(module_id: UUID, batch_id: UUID, db: Session = Depends(get_db)):
    batch = get_batch_by_id(db, batch_id)
    if not batch or batch.module_id != module_id:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch


@router.put("/modules/{module_id}/batches/{batch_id}", response_model=ModuleBatchOut)
def update_module_batch(
    module_id: UUID,
    batch_id: UUID,
    payload: ModuleBatchUpdate,
    db: Session = Depends(get_db),
):
    batch = get_batch_by_id(db, batch_id)
    if not batch or batch.module_id != module_id:
        raise HTTPException(status_code=404, detail="Batch not found")
    if payload.batch_type and payload.batch_type not in VALID_BATCH_TYPES:
        raise HTTPException(status_code=400, detail=f"batch_type must be one of {VALID_BATCH_TYPES}")
    if payload.ai_grading_mode and payload.ai_grading_mode not in VALID_GRADING_MODES:
        raise HTTPException(status_code=400, detail=f"ai_grading_mode must be one of {VALID_GRADING_MODES}")
    updated = update_batch(db, batch_id, payload)
    return updated


@router.delete("/modules/{module_id}/batches/{batch_id}")
def delete_module_batch(module_id: UUID, batch_id: UUID, db: Session = Depends(get_db)):
    batch = get_batch_by_id(db, batch_id)
    if not batch or batch.module_id != module_id:
        raise HTTPException(status_code=404, detail="Batch not found")
    delete_batch(db, batch_id)
    return {"detail": "Batch deleted. Questions returned to module pool."}


@router.patch("/modules/{module_id}/batches/{batch_id}/status", response_model=ModuleBatchOut)
def update_batch_status(
    module_id: UUID,
    batch_id: UUID,
    payload: BatchStatusUpdate,
    db: Session = Depends(get_db),
):
    if payload.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"status must be one of {VALID_STATUSES}")
    batch = get_batch_by_id(db, batch_id)
    if not batch or batch.module_id != module_id:
        raise HTTPException(status_code=404, detail="Batch not found")
    from app.schemas.module_batch import ModuleBatchUpdate
    return update_batch(db, batch_id, ModuleBatchUpdate(status=payload.status))


# ── Teacher: manage questions in a batch ──────────────────────────────────────

@router.get("/modules/{module_id}/batches/{batch_id}/questions")
def get_batch_questions(module_id: UUID, batch_id: UUID, db: Session = Depends(get_db)):
    """Get all questions assigned to this batch."""
    batch = get_batch_by_id(db, batch_id)
    if not batch or batch.module_id != module_id:
        raise HTTPException(status_code=404, detail="Batch not found")
    questions = get_questions_for_batch(db, batch_id)
    return {"batch_id": str(batch_id), "count": len(questions), "questions": questions}


@router.post("/modules/{module_id}/batches/{batch_id}/assign-questions")
def assign_questions(
    module_id: UUID,
    batch_id: UUID,
    payload: AssignQuestionsPayload,
    db: Session = Depends(get_db),
):
    """Assign questions from the module pool to this batch."""
    batch = get_batch_by_id(db, batch_id)
    if not batch or batch.module_id != module_id:
        raise HTTPException(status_code=404, detail="Batch not found")
    count = assign_questions_to_batch(db, batch_id, payload.question_ids)
    return {"assigned": count, "batch_id": str(batch_id)}


@router.post("/modules/{module_id}/batches/{batch_id}/remove-questions")
def remove_questions(
    module_id: UUID,
    batch_id: UUID,
    payload: AssignQuestionsPayload,
    db: Session = Depends(get_db),
):
    """Remove questions from this batch back to the module pool."""
    batch = get_batch_by_id(db, batch_id)
    if not batch or batch.module_id != module_id:
        raise HTTPException(status_code=404, detail="Batch not found")
    count = remove_questions_from_batch(db, batch_id, payload.question_ids)
    return {"removed": count, "batch_id": str(batch_id)}


@router.get("/modules/{module_id}/pool-questions")
def get_pool_questions(module_id: UUID, db: Session = Depends(get_db)):
    """Get questions not yet assigned to any batch (module pool)."""
    if not get_module_by_id(db, module_id):
        raise HTTPException(status_code=404, detail="Module not found")
    questions = get_unassigned_questions(db, module_id)
    return {"module_id": str(module_id), "count": len(questions), "questions": questions}


# ── Effective config helper ───────────────────────────────────────────────────

@router.get("/modules/{module_id}/batches/{batch_id}/effective-config")
def get_effective_config(module_id: UUID, batch_id: UUID, db: Session = Depends(get_db)):
    """
    Returns the resolved config for a batch — batch overrides merged on top of
    module defaults. This is what the frontend should use to drive behaviour.
    """
    from app.crud.module import get_module_by_id

    module = get_module_by_id(db, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    batch = get_batch_by_id(db, batch_id)
    if not batch or batch.module_id != module_id:
        raise HTTPException(status_code=404, detail="Batch not found")

    # Resolve module-level attempt defaults
    module_max_attempts = 2
    module_show_feedback = True
    if module.assignment_config:
        ma = module.assignment_config.get("features", {}).get("multiple_attempts", {})
        module_max_attempts = ma.get("max_attempts", 2)
        module_show_feedback = ma.get("show_feedback_after_each", True)

    return {
        "batch_id": str(batch.id),
        "batch_type": batch.batch_type,
        "ai_grading_mode": batch.ai_grading_mode or module.ai_grading_mode or "visible",
        "max_attempts": batch.max_attempts if batch.max_attempts is not None else module_max_attempts,
        "show_feedback_after_each": (
            batch.show_feedback_after_each
            if batch.show_feedback_after_each is not None
            else module_show_feedback
        ),
        "due_date": batch.due_date.isoformat() if batch.due_date else None,
        "unlock_after_batch_id": str(batch.unlock_after_batch_id) if batch.unlock_after_batch_id else None,
    }


# ── Student: discover available batches ──────────────────────────────────────

@router.get("/student/modules/{module_id}/batches")
def get_student_batches(
    module_id: UUID,
    student_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """
    Return batches available to this student.
    A batch is available when:
      - status == "active"
      - its unlock_after_batch_id is null OR the student has submitted that prerequisite batch
    """
    from app.models.test_submission import TestSubmission

    all_batches = get_batches_by_module(db, module_id)

    # Collect batch IDs the student has already submitted
    submitted_batch_ids = {
        row.batch_id
        for row in db.query(TestSubmission.batch_id).filter(
            TestSubmission.student_id == student_id,
            TestSubmission.module_id == module_id,
            TestSubmission.batch_id.isnot(None),
        ).all()
    }

    result = []
    for batch in all_batches:
        if batch.status != "active":
            continue
        prerequisite_met = (
            batch.unlock_after_batch_id is None
            or batch.unlock_after_batch_id in submitted_batch_ids
        )
        result.append({
            "id": str(batch.id),
            "name": batch.name,
            "batch_type": batch.batch_type,
            "batch_order": batch.batch_order,
            "due_date": batch.due_date.isoformat() if batch.due_date else None,
            "unlock_after_batch_id": str(batch.unlock_after_batch_id) if batch.unlock_after_batch_id else None,
            "available": prerequisite_met,
            "already_submitted": batch.id in submitted_batch_ids,
        })

    return result
