from fastapi import APIRouter, Form, UploadFile, File, HTTPException, Depends, Query, Body
from fastapi.responses import FileResponse
from uuid import UUID
from sqlalchemy.orm import Session
from urllib.parse import quote
from app.schemas.document import DocumentOut, DocumentUpdate
from app.schemas.question import QuestionGenerationRequest, QuestionGenerationResponse, QuestionCreate
from app.services.document import handle_document_upload, reparse_testbank_document, reprocess_document
from app.crud.document import (
    create_document,
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
router = APIRouter()

@router.post("/upload", response_model=DocumentOut)
async def upload_document(
    file: UploadFile = File(...),
    module_name: str = Form(..., description="Name of the module (used as subfolder)"),
    teacher_id: str = Form(..., description="Teacher ID who owns this document"),
    title: str = Form(None),  # ✅ Optional custom title override
    db: Session = Depends(get_db)
):
    try:
        file_bytes = await file.read()
        document = handle_document_upload(
            db=db,
            file_bytes=file_bytes,
            filename=file.filename,
            teacher_id=teacher_id,
            title=title,
            module_name=module_name
        )
        return document
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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

# 📥 Download document by ID
@router.get("/documents/{doc_id}/download")
def download_document(
    doc_id: str,
    db: Session = Depends(get_db)
):
    from fastapi.responses import RedirectResponse
    from app.services.storage import storage_service
    import re

    doc = fetch_document_by_id(db, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Check if storage_path is a URL (Supabase) or local path
    if doc.storage_path.startswith('http://') or doc.storage_path.startswith('https://'):
        # Extract the file path from the Supabase URL
        # URL format: https://xxx.supabase.co/storage/v1/object/public/uploads/001/two/file.docx?
        match = re.search(r'/storage/v1/object/public/[^/]+/(.+?)(\?|$)', doc.storage_path)

        if match:
            file_path = match.group(1)

            # Get a signed URL from Supabase (valid for 1 hour)
            try:
                signed_url = storage_service.get_signed_url(file_path, expires_in=3600)
                if signed_url:
                    return RedirectResponse(url=signed_url)
            except Exception as e:
                print(f"Failed to get signed URL: {e}")

        # Fallback: try the original URL (cleaned)
        clean_url = doc.storage_path.rstrip('?')
        return RedirectResponse(url=clean_url)
    else:
        # For local files, use FileResponse
        return FileResponse(
            path=doc.storage_path,
            filename=doc.file_name,
            media_type='application/octet-stream'
        )
    

@router.post("/documents/{doc_id}/reparse")
def reparse_document(
    doc_id: UUID,
    db: Session = Depends(get_db)
):
    doc = fetch_document_by_id(db, str(doc_id))
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    return reparse_testbank_document(db, doc_id)


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

    return reprocess_document(db, doc_id)


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
            num_mcq=request.num_mcq
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

    except ValueError as e:
        # Handle validation errors from service
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # Handle unexpected errors
        print(f"Error generating questions: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate questions: {str(e)}"
        )