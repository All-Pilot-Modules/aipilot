from fastapi import APIRouter, Depends, HTTPException, Query, Path, UploadFile, File, Body
from sqlalchemy.orm import Session
from app.schemas.question import (
    QuestionCreate, QuestionUpdate, QuestionOut,
    BulkApproveRequest, BulkApproveResponse
)
from app.crud.question import (
    create_question,
    get_questions_by_document_id,
    get_questions_by_module_id,
    get_question_by_id,
    update_question,
    delete_question,
    approve_question,
    bulk_approve_questions,
    get_questions_by_status
)
from app.database import get_db
from app.services.storage import storage_service
from app.models.question import Question, QuestionStatus
from app.models.module import Module
from uuid import UUID
from typing import List, Optional
import os

router = APIRouter()

# ✅ Create a question
@router.post("/questions", response_model=QuestionOut)
def create_question_api(payload: QuestionCreate, db: Session = Depends(get_db)):
    try:
        print(f"📝 Creating question with data: {payload.dict()}")
        question = create_question(db, payload)
        print(f"✅ Question created with ID: {question.id}")
        return question
    except Exception as e:
        print(f"❌ Error creating question: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to create question: {str(e)}")

# ✅ Get all questions for a document
@router.get("/questions", response_model=List[QuestionOut])
def get_questions_for_document(document_id: UUID = Query(...), db: Session = Depends(get_db)):
    return get_questions_by_document_id(db, document_id)

# ✅ Get all questions for a module (with optional status filter)
@router.get("/questions/by-module", response_model=List[QuestionOut])
def get_questions_for_module(
    module_id: UUID = Query(...),
    status: Optional[str] = Query("active", description="Filter by status: unreviewed, active, archived, all"),
    db: Session = Depends(get_db)
):
    # Default to 'active' to protect students from seeing unreviewed questions
    if status == "all":
        # Teachers can explicitly request all questions
        return get_questions_by_module_id(db, module_id)
    else:
        # Get questions filtered by status (default: active)
        return get_questions_by_status(db, module_id, status)

# ✅ Get a single question
@router.get("/questions/{question_id}", response_model=QuestionOut)
def get_question_by_id_api(
    question_id: UUID,
    include_unreviewed: bool = Query(False, description="Allow fetching unreviewed questions (teacher only)"),
    db: Session = Depends(get_db)
):
    question = get_question_by_id(db, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    # Protect students from accessing unreviewed questions directly
    if not include_unreviewed and question.status != QuestionStatus.ACTIVE:
        raise HTTPException(
            status_code=403,
            detail="This question is not yet available. Please contact your teacher."
        )

    return question

# ✅ Update a question
@router.put("/questions/{question_id}", response_model=QuestionOut)
def update_question_api(question_id: UUID, payload: QuestionUpdate, db: Session = Depends(get_db)):
    updated = update_question(db, question_id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Question not found")
    return updated

# ✅ Delete a question
@router.delete("/questions/{question_id}")
def delete_question_api(question_id: UUID, db: Session = Depends(get_db)):
    deleted = delete_question(db, question_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Question not found")
    return {"detail": "Question deleted successfully."}

# 📷 Upload image for a question
from app.core.auth import get_current_active_user
from app.models.user import User


def locked_image_question(db, question_id, user):
    question = db.get(Question, question_id)
    if not question:
        raise HTTPException(404, "Question not found")
    module = db.query(Module).filter(Module.id == question.module_id).with_for_update().first()
    if not module or module.teacher_id != user.id:
        raise HTTPException(403, "Only the module owner can change question images")
    if module.status == 'deleting':
        raise HTTPException(409, "Module deletion is in progress")
    return question, module


@router.post("/questions/{question_id}/upload-image")
def upload_question_image(question_id: UUID, file: UploadFile = File(...),
                          db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    from io import BytesIO
    from PIL import Image
    from uuid import uuid4
    from app.services.storage import SupabaseStorageService
    question, module = locked_image_question(db, question_id, user)
    content = file.file.read(5 * 1024 * 1024 + 1)
    file.file.close()
    if not content or len(content) > 5 * 1024 * 1024:
        raise HTTPException(413, "Choose a non-empty image up to 5 MB")
    try:
        with Image.open(BytesIO(content)) as img:
            extension = {'JPEG':'jpg','PNG':'png','GIF':'gif','WEBP':'webp'}.get(img.format)
            if not extension or img.width * img.height > 25_000_000:
                raise ValueError('Unsupported image')
            img.verify()
    except Exception:
        raise HTTPException(422, "Upload a valid JPG, PNG, GIF or WebP image")
    key = f'{user.id}/{module.id}/question_images/{question.id}/{uuid4()}.{extension}'
    reserved = f'supabase://question-images/{key}'
    config = dict(module.ai_config or {})
    config['pending_storage_cleanup'] = list(config.get('pending_storage_cleanup', [])) + [reserved]
    module.ai_config = config
    db.commit()  # Keep a cleanup reference even if the process dies during upload.
    question, module = locked_image_question(db, question_id, user)
    try:
        url = SupabaseStorageService(bucket_name='question-images').upload_file(content, key)
        previous = question.image_url
        question.image_url = url
        config = dict(module.ai_config or {})
        pending = [ref for ref in config.get('pending_storage_cleanup', []) if ref != reserved]
        if previous:
            from app.services.document_storage import document_storage
            try:
                document_storage.resolve(previous)
                pending.append(previous)
            except ValueError:
                pass
        config['pending_storage_cleanup'] = pending
        module.ai_config = config
        db.commit()
        return {'message':'Image uploaded successfully', 'image_url':url}
    except Exception:
        db.rollback()
        raise HTTPException(503, 'Image upload failed; the previous image has been preserved')


@router.delete("/questions/{question_id}/image")
def delete_question_image(question_id: UUID, db: Session = Depends(get_db),
                          user: User = Depends(get_current_active_user)):
    from app.services.document_cleanup import remove_references
    question, module = locked_image_question(db, question_id, user)
    if not question.image_url:
        raise HTTPException(404, 'Question has no image')
    remove_references([question.image_url])
    question.image_url = None
    db.commit()
    return {'message':'Image deleted successfully'}


# ✅ Approve a single question (change status from unreviewed to active)
@router.put("/questions/{question_id}/approve", response_model=QuestionOut)
def approve_question_api(question_id: UUID, db: Session = Depends(get_db)):
    """
    Approve a question by changing its status from 'unreviewed' to 'active'.
    This makes the question visible to students.

    Args:
        question_id: UUID of the question to approve
        db: Database session

    Returns:
        Updated question with status='active'

    Raises:
        404: Question not found
        500: Database error
    """
    approved_question = approve_question(db, question_id)
    if not approved_question:
        raise HTTPException(status_code=404, detail="Question not found")
    return approved_question


# ✅ Bulk approve multiple questions
@router.post("/questions/bulk-approve", response_model=BulkApproveResponse)
def bulk_approve_questions_api(
    request: BulkApproveRequest = Body(...),
    db: Session = Depends(get_db)
):
    """
    Approve multiple questions at once by changing their status to 'active'.
    Useful for batch approving AI-generated questions after review.

    Args:
        request: BulkApproveRequest with list of question IDs
        db: Database session

    Returns:
        BulkApproveResponse with count of approved and failed questions

    Raises:
        400: Invalid request (empty list, too many questions)
        500: Database error
    """
    result = bulk_approve_questions(db, request.question_ids)

    return BulkApproveResponse(
        approved_count=result["approved_count"],
        failed_count=result["failed_count"],
        message=f"Successfully approved {result['approved_count']} question(s). "
               f"{result['failed_count']} failed." if result['failed_count'] > 0
               else f"Successfully approved {result['approved_count']} question(s)."
    )


# ✅ Get questions by status (for review page)
@router.get("/questions/status/{status}", response_model=List[QuestionOut])
def get_questions_by_status_api(
    status: str = Path(..., description="Status to filter by: unreviewed, active, or archived"),
    module_id: Optional[UUID] = Query(None, description="Optional module ID to filter by"),
    db: Session = Depends(get_db)
):
    """
    Get all questions with a specific status, optionally filtered by module.

    Args:
        status: Question status (unreviewed, active, archived)
        module_id: Optional module ID to filter results
        db: Database session

    Returns:
        List of questions matching the status filter

    Raises:
        400: Invalid status value
    """
    # Validate status
    valid_statuses = [QuestionStatus.UNREVIEWED, QuestionStatus.ACTIVE, QuestionStatus.ARCHIVED]
    if status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{status}'. Must be one of: {', '.join(valid_statuses)}"
        )

    if module_id:
        return get_questions_by_status(db, module_id, status)
    else:
        # Get all questions with this status across all modules
        questions = db.query(Question).filter(Question.status == status).all()
        return questions