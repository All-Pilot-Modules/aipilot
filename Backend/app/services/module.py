from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.models.module import Module
from app.models.document import Document
from uuid import uuid4
from datetime import datetime, timezone
import secrets
import slugify  # type: ignore # Requires `python-slugify`

def get_or_create_module(db: Session, teacher_id: str, module_name: str) -> Module:
    # Validate inputs
    if not teacher_id or not module_name:
        raise ValueError("teacher_id and module_name are required")
    
    existing = db.query(Module).filter_by(teacher_id=teacher_id, name=module_name).first()
    if existing:
        return existing

    try:
        # Generate slug with fallback
        slug = slugify.slugify(module_name) or module_name.lower().replace(' ', '-')
        
        new_module = Module(
            id=uuid4(),
            teacher_id=teacher_id,
            name=module_name,
            slug=slug,
            access_code=secrets.token_hex(3).upper(),
            is_active=True,
            visibility="class-only",
            created_at=datetime.now(timezone.utc)
        )
        db.add(new_module)
        db.commit()
        db.refresh(new_module)
        return new_module
        
    except IntegrityError:
        db.rollback()
        # Try to get existing module that might have been created concurrently
        existing = db.query(Module).filter_by(teacher_id=teacher_id, name=module_name).first()
        if existing:
            return existing
        # If still not found, raise error instead of returning None
        raise ValueError(f"Failed to create or find module '{module_name}' for teacher '{teacher_id}'")
    except Exception as e:
        db.rollback()
        raise ValueError(f"Error creating module: {str(e)}")

def delete_module_with_documents(db: Session, module_id: str) -> bool:
    from app.models.question import Question
    from app.models.question_queue import QuestionQueue
    from app.models.chat_conversation import ChatConversation
    from app.models.test_submission import TestSubmission
    from app.services.document_cleanup import remove_references
    from app.services.document_storage import document_storage

    module = db.query(Module).filter(Module.id == module_id).with_for_update().first()
    if not module:
        return False
    # Mark before external cleanup. A failed attempt remains retryable and workers
    # will not create new data for a deleting module.
    module.status = 'deleting'
    module.is_active = False
    db.commit()
    module = db.query(Module).filter(Module.id == module_id).with_for_update().first()
    if not module:
        return False
    try:
        documents = db.query(Document).filter(Document.module_id == module.id).all()
        questions = db.query(Question).filter(Question.module_id == module.id).all()
        references = [doc.storage_path for doc in documents]
        references.extend((module.ai_config or {}).get('pending_storage_cleanup', []))
        for doc in documents:
            references.extend((doc.processing_metadata or {}).get('pending_storage_cleanup', []))
        for doc in documents:
            bucket, key = document_storage.resolve(doc.storage_path)
            if not key.endswith('/source.' + doc.file_type):
                references.append(f'supabase://{bucket}/{key.rsplit("/", 1)[0]}/parsed_questions.json')
        for question in questions:
            if question.image_url:
                try:
                    document_storage.resolve(question.image_url)
                except ValueError:
                    continue  # External images are not owned by this application.
                references.append(question.image_url)
        remove_references(references)
        # Delete non-cascading/restricting edges first. Remaining descendants use
        # FK cascades: answers, feedback/jobs/critiques/grades, enrollments/claims,
        # batches, surveys, learning memory, chunks, embeddings and collaborators.
        db.query(QuestionQueue).filter(QuestionQueue.module_id == module.id).delete(synchronize_session=False)
        db.query(TestSubmission).filter(TestSubmission.module_id == module.id).delete(synchronize_session=False)
        db.query(ChatConversation).filter(ChatConversation.module_id == module.id).delete(synchronize_session=False)
        db.query(Document).filter(Document.module_id == module.id).delete(synchronize_session=False)
        db.query(Module).filter(Module.id == module.id).delete(synchronize_session=False)
        db.commit()
        return True
    except Exception:
        db.rollback()
        raise
