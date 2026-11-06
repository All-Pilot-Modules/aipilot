"""Validated uploads and transactional document processing.

Queued records are durable jobs. A worker holds module/document row locks until
results commit, so a crash rolls back to queued and deletion cannot race parsing.
"""
import logging
import os
from datetime import datetime, timezone, timedelta
from hashlib import sha256
from uuid import UUID, uuid4
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.models.document import Document
from app.models.module import Module
from app.models.module_batch import ModuleBatch  # Register the question/answer FK target for standalone workers.
from app.models.user import User
from app.models.question import Question
from app.models.student_answer import StudentAnswer
from app.models.question_queue import QuestionQueue
from app.models.document_chunk import DocumentChunk
from app.schemas.question import QuestionCreate
from app.services.module import get_or_create_module
from app.services.document_storage import document_storage as storage_service, PRIVATE_BUCKET
from app.services.document_validation import validate_upload, MAX_EXTRACTED_CHARS
from app.utils.text_extractor import extract_text_from_file
from app.utils.text_chunker import chunk_text
from app.utils.question_parser import parse_testbank_hybrid
from app.services.embedding import generate_embeddings_for_document

logger = logging.getLogger(__name__)


def lock_document(db, document_id):
    doc = db.get(Document, UUID(str(document_id)))
    if not doc:
        raise HTTPException(404, 'Document not found')
    module = db.query(Module).filter(Module.id == doc.module_id).with_for_update().first()
    if not module or module.status == 'deleting':
        raise HTTPException(409, 'Module is being deleted')
    doc = db.query(Document).filter(Document.id == document_id).populate_existing().with_for_update().first()
    if not doc or doc.processing_status == 'deleting':
        raise HTTPException(409, 'Document is being deleted')
    return doc


def handle_document_upload(db: Session, file_bytes: bytes, filename: str, teacher_id: str,
                           title=None, module_name=None, is_testbank=None, enqueue_only=False):
    testbank = ('testbank' in (filename or '').lower()) if is_testbank is None else is_testbank
    extension = validate_upload(file_bytes, filename, testbank)
    if not module_name or not module_name.strip() or len(module_name) > 255:
        raise HTTPException(422, 'A module name is required (maximum 255 characters)')
    if title is not None and (not title.strip() or len(title) > 255):
        raise HTTPException(422, 'Title must be between 1 and 255 characters')
    teacher = db.query(User).filter(User.id == teacher_id).with_for_update().first()
    if not teacher:
        raise HTTPException(400, 'User not found')
    module = get_or_create_module(db, teacher_id, module_name)
    # get_or_create may commit; reacquire the owner lock to serialize quotas.
    db.query(User).filter(User.id == teacher_id).with_for_update().first()
    module = db.query(Module).filter(Module.id == module.id).with_for_update().first()
    if not module or module.status == 'deleting':
        raise HTTPException(409, 'Module is being deleted')
    digest = sha256(file_bytes).hexdigest()
    existing = db.query(Document).filter_by(teacher_id=teacher_id, module_id=module.id, file_hash=digest).first()
    if existing:
        if existing.is_testbank != testbank:
            raise HTTPException(409, 'This file already exists with a different document type')
        if (existing.processing_metadata or {}).get('upload_complete', True):
            return existing
        document = existing
    else:
        owned = db.query(Document).filter(Document.teacher_id == teacher_id)
        if owned.filter(Document.processing_status.in_(['queued', 'uploading'])).count() >= 5 or owned.filter(
                Document.uploaded_at >= datetime.now(timezone.utc) - timedelta(hours=1)).count() >= 30:
            raise HTTPException(429, 'Upload limit reached. Wait for queued files to finish and retry later.')
        doc_id = uuid4()
        key = f'{teacher_id}/{module.id}/{doc_id}/source.{extension}'
        document = Document(id=doc_id, title=title or filename, file_name=filename,
                            file_hash=digest, file_type=extension, teacher_id=teacher_id,
                            module_id=module.id, storage_path=f'supabase://{PRIVATE_BUCKET}/{key}', slide_count=0,
                            is_testbank=testbank, parse_status='pending' if testbank else None,
                            processing_status='uploading', processing_metadata={
                                'file_size': len(file_bytes), 'upload_complete': False, 'explicit_document_type': is_testbank is not None})
        db.add(document)
        # Reserve the immutable key before touching storage. Even if the process
        # crashes during upload, deletion/re-upload can recover the known key.
        db.commit()
    doc_id = document.id
    document = lock_document(db, doc_id)
    _, key = storage_service.resolve(document.storage_path)
    try:
        reference = storage_service.upload_file(file_bytes, key)
        document.storage_path = reference
        document.processing_status = 'queued'
        document.processing_metadata = {**(document.processing_metadata or {}),
            'upload_complete': True, 'queued_at': datetime.now(timezone.utc).isoformat()}
        document.processing_metadata.pop('error', None)
        db.commit()
    except Exception:
        logger.exception('Storage upload failed for document %s', doc_id)
        db.rollback()
        # Keep the reserved key for retry/cleanup; never delete an object after an
        # ambiguous commit failure (the committed row may already reference it).
        document = db.get(Document, doc_id)
        if document and not (document.processing_metadata or {}).get('upload_complete'):
            document.processing_status = 'failed'
            document.processing_metadata = {**(document.processing_metadata or {}),
                'error': 'Upload interrupted. Upload the same file again to resume.'}
            db.commit()
        raise HTTPException(503, 'Upload interrupted. Upload the same file again to resume.')
    if not enqueue_only:
        return process_document(db, doc_id)
    db.refresh(document)
    return document


def validate_questions(questions):
    if not questions:
        raise ValueError('No questions were extracted. Check the file format and answer keys.')
    validated = [QuestionCreate(**question) for question in questions]
    for q in validated:
        if not q.text.strip():
            raise ValueError('An extracted question has no text')
        if q.type == 'mcq':
            if not q.options or len(q.options) < 2 or q.correct_option_id not in q.options:
                raise ValueError('Every multiple-choice question needs options and a matching answer key')
        elif q.type == 'mcq_multiple':
            keys = (q.extended_config or {}).get('correct_option_ids', [])
            if not q.options or len(q.options) < 2 or not keys or any(key not in q.options for key in keys):
                raise ValueError('Every multiple-answer question needs matching answer keys')
        elif not q.correct_answer or not q.correct_answer.strip():
            raise ValueError('Every short-answer question needs an answer key')
    return validated


def ensure_reparse_safe(db, doc):
    if db.query(StudentAnswer.id).join(Question, Question.id == StudentAnswer.question_id).filter(
            Question.document_id == doc.id).first():
        raise HTTPException(409, 'This testbank has student answers. Upload a new version to preserve grading history.')


def process_document(db, document_id, locked_document=None):
    doc = locked_document or lock_document(db, document_id)
    path = None
    try:
        # Savepoint rollback preserves previous questions/chunks and the outer locks.
        with db.begin_nested():
            path = storage_service.download_file_temporarily(doc.storage_path)
            with open(path, 'rb') as source:
                content = source.read()
            if sha256(content).hexdigest() != doc.file_hash:
                raise ValueError('Stored file content no longer matches the original upload. Upload a new version.')
            validate_upload(content, f'source.{doc.file_type}', doc.is_testbank)
            if not doc.is_testbank and 'testbank' in doc.file_name.lower() and not (doc.processing_metadata or {}).get('explicit_document_type'):
                raise ValueError('Legacy testbank classification needs repair before processing. Run the document migration.')
            result = extract_text_from_file(path, doc.file_type, is_testbank=doc.is_testbank)
            text = result['text']
            if not text.strip():
                raise ValueError('No readable text found. Use a searchable document or enable OCR.')
            if len(text) > MAX_EXTRACTED_CHARS:
                raise ValueError('Extracted text is too large; split the document into smaller files.')
            metadata = dict(doc.processing_metadata or {})
            metadata.pop('error', None)
            metadata.pop('failed_at', None)
            metadata.update({'char_count': len(text), 'extraction': {
                k: v for k, v in result['metadata'].items() if k not in ('page_texts', 'slide_texts')}})
            if doc.is_testbank:
                ensure_reparse_safe(db, doc)
                questions = validate_questions(parse_testbank_hybrid(text, doc.module_id, doc.id))
                ids = db.query(Question.id).filter(Question.document_id == doc.id)
                db.query(QuestionQueue).filter(QuestionQueue.question_id.in_(ids)).delete(synchronize_session=False)
                db.query(Question).filter(Question.document_id == doc.id).delete(synchronize_session=False)
                db.add_all([Question(id=uuid4(), **q.model_dump()) for q in questions])
                doc.parse_status, doc.parse_error = 'success', None
                doc.processing_status = 'parsed'
                metadata['question_count'] = len(questions)
            else:
                chunks = chunk_text(text, chunk_size=1000, overlap=200)
                if not chunks:
                    raise ValueError('No usable text chunks found')
                db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).delete(synchronize_session=False)
                db.add_all([DocumentChunk(document_id=doc.id, module_id=doc.module_id,
                    chunk_index=c['index'], chunk_text=c['text'], chunk_size=len(c['text']),
                    chunk_metadata=c.get('chunk_metadata', {})) for c in chunks])
                db.flush()
                count = generate_embeddings_for_document(db, str(doc.id), batch_size=100, commit=False)
                if count != len(chunks):
                    raise ValueError('Embedding coverage is incomplete; retry processing.')
                doc.processing_status = 'embedded'
                metadata.update({'chunk_count': len(chunks), 'embedding_count': count})
            doc.slide_count = result['metadata'].get('slides', result['metadata'].get('pages', 0))
            metadata['completed_at'] = datetime.now(timezone.utc).isoformat()
            doc.processing_metadata = metadata
            db.flush()
        db.commit()
    except Exception as error:
        logger.exception('Document processing failed for %s', document_id)
        # Provider/internal errors stay in server logs, not the API response.
        message = str(error) if isinstance(error, ValueError) else (
            error.detail if isinstance(error, HTTPException) else 'Processing failed. Retry or contact support.')
        doc.processing_status = 'failed'
        doc.processing_metadata = {**(doc.processing_metadata or {}), 'error': message,
                                   'failed_at': datetime.now(timezone.utc).isoformat()}
        if doc.is_testbank:
            doc.parse_status, doc.parse_error = 'failed', message
        db.commit()
    finally:
        if path and os.path.exists(path):
            os.unlink(path)
    db.refresh(doc)
    return doc


def queue_document(db, document_id, testbank):
    existing = db.get(Document, UUID(str(document_id)))
    if not existing:
        raise HTTPException(404, 'Document not found')
    db.query(User).filter(User.id == existing.teacher_id).with_for_update().first()
    doc = lock_document(db, document_id)
    if not (doc.processing_metadata or {}).get('upload_complete', True):
        raise HTTPException(409, 'Upload is incomplete. Upload the same file again to resume.')
    if bool(doc.is_testbank) != testbank:
        raise HTTPException(400, 'Use reparse for testbanks and reprocess for course documents')
    if testbank:
        ensure_reparse_safe(db, doc)
    if doc.processing_status == 'queued':
        return doc
    queued = db.query(Document).filter(Document.teacher_id == doc.teacher_id, Document.processing_status == 'queued').count()
    if queued >= 5:
        raise HTTPException(429, 'Wait for queued documents to finish before retrying')
    retries = (doc.processing_metadata or {}).get('retry_requests', [])
    now = datetime.now(timezone.utc).timestamp()
    retries = [stamp for stamp in retries if isinstance(stamp, (int, float)) and now - stamp < 3600]
    if len(retries) >= 5:
        raise HTTPException(429, 'Retry limit reached for this document. Try again in an hour.')
    doc.processing_status = 'queued'
    doc.processing_metadata = {**(doc.processing_metadata or {}), 'retry_requests': retries + [now], 'queued_at': datetime.now(timezone.utc).isoformat()}
    if testbank:
        doc.parse_status, doc.parse_error = 'pending', None
    db.commit()
    db.refresh(doc)
    return doc


def reprocess_document(db, document_id):
    doc = lock_document(db, document_id)
    if doc.is_testbank:
        raise HTTPException(400, 'Use reparse for a testbank')
    return process_document(db, document_id, doc)


def reparse_testbank_document(db, document_id):
    doc = lock_document(db, document_id)
    if not doc.is_testbank:
        raise HTTPException(400, 'This document is not a testbank')
    ensure_reparse_safe(db, doc)
    return process_document(db, document_id, doc)
