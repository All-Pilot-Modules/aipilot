from sqlalchemy.orm import Session
from app.models.document import Document
from app.schemas.document import DocumentCreate, DocumentUpdate
from datetime import datetime, timezone
import uuid
from typing import List, Optional

def create_document(db: Session, doc_data: DocumentCreate) -> Document:
    new_doc = Document(
        id=str(uuid.uuid4()),
        title=doc_data.title,
        file_name=doc_data.file_name,
        file_hash=doc_data.file_hash,
        file_type=doc_data.file_type,
        teacher_id=doc_data.teacher_id,
        module_id=doc_data.module_id,  # ✅ CHANGED from module_name to module_id
        storage_path=doc_data.storage_path,
        index_path=doc_data.index_path,
        slide_count=doc_data.slide_count,
        processing_status=doc_data.processing_status,
        processing_metadata=dict(doc_data.processing_metadata or {}),
        is_testbank=doc_data.is_testbank,
        parse_status=doc_data.parse_status,
        parse_error=doc_data.parse_error,
        uploaded_at=datetime.now(timezone.utc)
    )
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)
    return new_doc

def get_all_documents(db: Session) -> List[Document]:
    return db.query(Document).all()

def get_documents_by_teacher(db: Session, teacher_id: str) -> List[Document]:
    return db.query(Document).filter(Document.teacher_id == teacher_id).all()

def get_documents_by_module(db: Session, module_id) -> List[Document]:
    return db.query(Document).filter(Document.module_id == module_id).all()

def get_documents_by_module_for_students(db: Session, module_id) -> List[Document]:
    """Get documents for students - excludes test banks"""
    return db.query(Document).filter(
        Document.module_id == module_id,
        Document.is_testbank == False,  # Never show test banks to students
        ~Document.file_name.ilike('%testbank%')  # Also filter by filename containing 'testbank'
    ).all()


def get_document_by_id(db: Session, document_id: str) -> Optional[Document]:
    return db.query(Document).filter(Document.id == document_id).first()


def update_document(db: Session, document_id: str, update_data: DocumentUpdate) -> Optional[Document]:
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        return None

    for field, value in update_data.dict(exclude_unset=True).items():
        setattr(doc, field, value)

    db.commit()
    db.refresh(doc)
    return doc


def delete_document(db: Session, document_id: str, delete_questions: bool = False) -> Optional[Document]:
    from app.models.module import Module
    from app.models.question import Question
    from app.models.question_queue import QuestionQueue
    from app.models.student_answer import StudentAnswer
    from app.services.document_cleanup import remove_references
    from fastapi import HTTPException
    doc = get_document_by_id(db, document_id)
    if not doc:
        return None
    module = db.query(Module).filter(Module.id == doc.module_id).with_for_update().first()
    if not module or module.status == 'deleting':
        raise HTTPException(409, 'Module deletion is in progress')
    doc = db.query(Document).filter(Document.id == document_id).with_for_update().populate_existing().first()
    if not doc:
        return None
    doc.processing_status = 'deleting'
    db.commit()
    db.query(Module).filter(Module.id == doc.module_id).with_for_update().first()
    doc = db.query(Document).filter(Document.id == document_id).with_for_update().first()
    if not doc:
        return None
    try:
        remove_references([doc.storage_path] + list((doc.processing_metadata or {}).get('pending_storage_cleanup', [])))
        if delete_questions:
            ids = db.query(Question.id).filter(Question.document_id == doc.id)
            db.query(QuestionQueue).filter(QuestionQueue.question_id.in_(ids)).delete(synchronize_session=False)
        else:
            # Detach both edges so document CASCADE cannot erase answers/history.
            db.query(Question).filter(Question.document_id == doc.id).update(
                {Question.document_id: None}, synchronize_session=False)
            db.query(StudentAnswer).filter(StudentAnswer.document_id == doc.id).update(
                {StudentAnswer.document_id: None}, synchronize_session=False)
        db.delete(doc)
        db.commit()
        return doc
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise HTTPException(500, "Document deletion could not finish. Retry or contact support.")
