from fastapi import APIRouter, Form, UploadFile, File, HTTPException, Depends, Query, Body
from uuid import UUID
from sqlalchemy.orm import Session
from urllib.parse import quote
from app.schemas.document import DocumentOut, DocumentUpdate
from app.schemas.question import QuestionGenerationRequest, QuestionGenerationResponse, QuestionCreate
from app.services.document import handle_document_upload
from app.crud.document import (
    get_document_by_id as fetch_document_by_id,
    get_documents_by_teacher,
    get_documents_by_module,
    delete_document,
    update_document
)
from app.crud.question import create_question
from app.database import get_db
from app.services.question_generation import question_generation_service
from app.models.module import Module
from app.services.document_access import authorize_document_request
from app.core.auth import get_current_active_user
from app.models.user import User
router = APIRouter(dependencies=[Depends(authorize_document_request)])

@router.post("/upload", response_model=DocumentOut, status_code=202)
def upload_document(
    file: UploadFile = File(...),
    module_name: str = Form(...),
    teacher_id: str = Form(...),
    title: str = Form(None),
    is_testbank: bool | None = Form(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    from app.services.document_validation import MAX_UPLOAD_BYTES
    if teacher_id != current_user.id:
        raise HTTPException(403, "Cannot upload for another user")
    try:
        file_bytes = file.file.read(MAX_UPLOAD_BYTES + 1)
        return handle_document_upload(db, file_bytes, file.filename, current_user.id,
                                      title, module_name, is_testbank=is_testbank, enqueue_only=True)
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise HTTPException(500, "Upload failed. Please retry.")
    finally:
        file.file.close()

# 📄 List all documents for a teacher, optionally filtered by module
@router.get("/documents", response_model=list[DocumentOut])
def list_documents(
    teacher_id: str = Query(..., description="Teacher ID to get documents for"),
    module_id: str = Query(None, description="Optional module ID to filter documents"),
    db: Session = Depends(get_db)
):
    if module_id:
        return get_documents_by_module(db, module_id)
    else:
        return get_documents_by_teacher(db, teacher_id)

# 📄 Fetch single document by ID
@router.get("/documents/{doc_id}", response_model=DocumentOut)
def get_document(
    doc_id: str, 
    db: Session = Depends(get_db)
):
    doc = fetch_document_by_id(db, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc

# ❌ Delete document
@router.delete("/documents/{doc_id}")
def delete_document_by_id(
    doc_id: str,
    delete_questions: bool = Query(False, description="If true, also delete generated questions (for testbanks)"),
    db: Session = Depends(get_db)
):
    deleted_doc = delete_document(db, doc_id, delete_questions=delete_questions)
    if not deleted_doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"detail": "Document deleted successfully."}

# ✏️ Update document (e.g., title/module)
@router.put("/documents/{doc_id}", response_model=DocumentOut)
def update_document_by_id(
    doc_id: str, 
    payload: DocumentUpdate, 
    db: Session = Depends(get_db)
):
    updated_doc = update_document(db, doc_id, payload)
    if not updated_doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return updated_doc

def signed_download(db, doc_id):
    from app.services.document_storage import document_storage
    doc = fetch_document_by_id(db, str(doc_id))
    try:
        return document_storage.signed_url(doc.storage_path)
    except Exception:
        raise HTTPException(503, "Download temporarily unavailable")


@router.get("/documents/{doc_id}/download-url")
def download_url(doc_id: UUID, db: Session = Depends(get_db)):
    return {"url": signed_download(db, doc_id)}


@router.get("/documents/{doc_id}/download")
def download_document(doc_id: UUID, db: Session = Depends(get_db)):
    from fastapi.responses import RedirectResponse
    return RedirectResponse(signed_download(db, doc_id))


@router.post("/documents/{doc_id}/reparse")
def reparse_document(
    doc_id: UUID,
    db: Session = Depends(get_db)
):
    doc = fetch_document_by_id(db, str(doc_id))
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    from app.services.document import queue_document
    return queue_document(db, doc_id, testbank=True)


@router.post("/documents/{doc_id}/reprocess")
def reprocess_document_endpoint(
    doc_id: UUID,
    db: Session = Depends(get_db)
):
    """Re-trigger text extraction, chunking, and embedding for a stuck document."""
    doc = fetch_document_by_id(db, str(doc_id))
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.processing_status in ["embedded", "indexed"]:
        raise HTTPException(status_code=400, detail="Document is already fully processed")

    from app.services.document import queue_document
    return queue_document(db, doc_id, testbank=False)


@router.post("/documents/{doc_id}/generate-questions", response_model=QuestionGenerationResponse)
def generate_questions_from_document(
    doc_id: UUID,
    request: QuestionGenerationRequest = Body(...),
    db: Session = Depends(get_db)
):
    """
    Generate AI questions from a RAG-indexed document

    This endpoint:
    1. Validates the document is RAG-indexed
    2. Uses OpenAI to generate questions from document chunks
    3. Saves questions to database with status='unreviewed'
    4. Returns a response with review URL

    Args:
        doc_id: UUID of the document to generate questions from
        request: Question generation parameters (num_short, num_long, num_mcq)
        db: Database session

    Returns:
        QuestionGenerationResponse with generated count and review URL

    Raises:
        404: Document not found
        400: Document not RAG-indexed or invalid request
        500: OpenAI API error or generation failure
    """
    # Validate document exists
    doc = fetch_document_by_id(db, str(doc_id))
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Validate document is RAG-indexed
    if doc.processing_status not in ["embedded", "indexed"]:
        raise HTTPException(
            status_code=400,
            detail=f"Document '{doc.title}' is not RAG-indexed. "
                   f"Current status: {doc.processing_status}. "
                   f"Please wait for the document to be fully processed before generating questions."
        )

    try:
        # Generate questions using the service
        generated_questions = question_generation_service.generate_questions_from_document(
            db=db,
            document_id=doc_id,
            num_short=request.num_short,
            num_long=request.num_long,
            num_mcq=request.num_mcq,
            instructions=request.instructions
        )

        # Get module to check ownership and for review URL
        module = db.query(Module).filter(Module.id == doc.module_id).first()

        # Auto-approve questions when the module owner is a student (self-learning flow)
        from app.models.user import User
        from app.models.question import QuestionStatus
        owner = db.query(User).filter(User.id == module.teacher_id).first() if module else None
        auto_approve = owner is not None and owner.role == "student"

        saved_count = 0
        for question_data in generated_questions:
            try:
                if auto_approve:
                    question_data["status"] = QuestionStatus.ACTIVE
                question_create = QuestionCreate(**question_data)
                create_question(db, question_create)
                saved_count += 1
            except Exception as e:
                print(f"Warning: Failed to save question: {str(e)}")
                db.rollback()
                continue

        if saved_count == 0:
            raise HTTPException(
                status_code=500,
                detail="Failed to save any generated questions to database"
            )

        # Count questions by type
        num_short_generated = sum(1 for q in generated_questions if q["type"] == "short")
        num_long_generated = sum(1 for q in generated_questions if q["type"] == "long")
        num_mcq_generated = sum(1 for q in generated_questions if q["type"] == "mcq")

        module_name = module.name if module else ""

        # Construct review URL with module name for proper browser back button support
        review_url = f"/dashboard/questions/review?module_id={doc.module_id}&module_name={quote(module_name)}&status=unreviewed"

        return QuestionGenerationResponse(
            generated_count=saved_count,
            num_short=num_short_generated,
            num_long=num_long_generated,
            num_mcq=num_mcq_generated,
            document_id=doc_id,
            module_id=doc.module_id,
            review_url=review_url,
            message=f"Successfully generated {saved_count} questions from '{doc.title}'. "
                   f"Please review them before making them available to students."
        )

    except HTTPException:
        raise
    except ValueError as e:
        # Handle validation errors from service
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # Handle unexpected errors
        print(f"Error generating questions: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Question generation failed. Please retry."
        )