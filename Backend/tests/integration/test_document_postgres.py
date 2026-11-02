"""Opt-in PostgreSQL concurrency checks; requires an EMPTY disposable database.

TEST_DOCUMENT_POSTGRES_URL=postgresql+psycopg2://... pytest this_file
Never point this at an application database: tables are created and dropped.
"""
import os
from uuid import uuid4
from unittest.mock import MagicMock
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError
from app.database import Base
from app.models.user import User
from app.models.module import Module
from app.models.document import Document
from app.models.question import Question

pytestmark = pytest.mark.skipif(not os.getenv('TEST_DOCUMENT_POSTGRES_URL'), reason='Disposable PostgreSQL not configured')

@pytest.fixture
def pg_engine():
    # Import all FK targets; no startup handlers are invoked by importing main.
    import main
    engine = create_engine(os.environ['TEST_DOCUMENT_POSTGRES_URL'])
    # These tests exercise testbanks, not vector search. No pgvector extension is
    # needed; exclude its standalone table/index from the disposable schema.
    tables = [t for t in Base.metadata.sorted_tables if t.name != 'document_embeddings']
    with engine.connect() as connection:
        assert connection.execute(text("select count(*) from information_schema.tables where table_schema='public'")).scalar() == 0, 'Database must be empty'
    Base.metadata.create_all(engine, tables=tables)
    try:
        yield engine
    finally:
        Base.metadata.drop_all(engine, tables=tables)
        engine.dispose()


def seed(engine):
    with Session(engine) as db:
        user = User(id='owner',username='owner',email='owner@example.invalid',hashed_password='unused',role='teacher',is_active=True)
        db.add(user); db.flush()
        module=Module(id=uuid4(),teacher_id=user.id,name='Lock test',slug='lock-test',access_code='ABC123',status='published')
        db.add(module);db.flush()
        doc=Document(id=uuid4(),teacher_id=user.id,module_id=module.id,title='Bank',file_name='testbank.txt',
                     file_hash=__import__('hashlib').sha256(b'1. What is 2+2?\nAnswer: 4').hexdigest(),file_type='txt',storage_path='supabase://documents-private/owner/source.txt',
                     is_testbank=True,parse_status='pending',processing_status='queued')
        db.add(doc);db.commit()
        return doc.id,module.id


def claim(db):
    return (db.query(Document).join(Module,Document.module_id == Module.id)
            .filter(Document.processing_status == 'queued',Module.status != 'deleting')
            .order_by(Document.uploaded_at).with_for_update(skip_locked=True).first())


def test_only_one_worker_claims_and_crash_rollback_requeues(pg_engine):
    doc_id,_=seed(pg_engine)
    with Session(pg_engine) as first, Session(pg_engine) as second:
        assert claim(first).id == doc_id
        assert claim(second) is None
        first.rollback()  # Same database effect as a worker connection dying.
        assert claim(second).id == doc_id


def test_deletion_waits_for_processing_module_lock(pg_engine):
    _,module_id=seed(pg_engine)
    with Session(pg_engine) as worker, Session(pg_engine) as deleter:
        claim(worker)
        deleter.execute(text("SET LOCAL lock_timeout='100ms'"))
        with pytest.raises(OperationalError):
            deleter.query(Module).filter(Module.id==module_id).with_for_update().first()
        deleter.rollback()
        worker.rollback()
        assert deleter.query(Module).filter(Module.id==module_id).with_for_update().first()


def test_worker_commits_questions_and_status_atomically(pg_engine,tmp_path,monkeypatch):
    from app.services import document as service
    doc_id,_=seed(pg_engine)
    path=tmp_path/'bank.txt';path.write_text('1. What is 2+2?\nAnswer: 4')
    monkeypatch.setattr(service.storage_service,'download_file_temporarily',MagicMock(return_value=str(path)))
    with Session(pg_engine) as worker:
        doc=claim(worker)
        service.process_document(worker,doc_id,locked_document=doc)
    with Session(pg_engine) as reader:
        assert reader.get(Document,doc_id).processing_status == 'parsed'
        assert reader.query(Question).filter_by(document_id=doc_id).count() == 1


def test_failed_replacement_preserves_questions_in_postgres(pg_engine,tmp_path,monkeypatch):
    from app.services import document as service
    doc_id,module_id=seed(pg_engine)
    with Session(pg_engine) as db:
        db.add(Question(module_id=module_id,document_id=doc_id,type='short',text='Original',correct_answer='Kept'))
        db.commit()
    path=tmp_path/'bank.txt';path.write_text('1. What is 2+2?\nAnswer: 4')
    monkeypatch.setattr(service.storage_service,'download_file_temporarily',MagicMock(return_value=str(path)))
    monkeypatch.setattr(service,'parse_testbank_hybrid',MagicMock(return_value=[]))
    with Session(pg_engine) as worker:
        service.process_document(worker,doc_id,locked_document=claim(worker))
    with Session(pg_engine) as reader:
        assert reader.get(Document,doc_id).processing_status == 'failed'
        assert reader.query(Question).filter_by(document_id=doc_id).one().text == 'Original'


def test_module_cascade_in_postgres(pg_engine,monkeypatch):
    from app.models.student_enrollment import StudentEnrollment
    from app.models.test_submission import TestSubmission
    from app.models.student_answer import StudentAnswer
    from app.models.ai_feedback import AIFeedback
    from app.models.feedback_job import FeedbackJob
    from app.models.question_queue import QuestionQueue
    from app.services.module import delete_module_with_documents
    from app.services.document_storage import document_storage
    doc_id,module_id=seed(pg_engine)
    monkeypatch.setattr(document_storage,'delete_file',MagicMock(return_value=True))
    with Session(pg_engine) as db:
        question=Question(module_id=module_id,document_id=doc_id,type='short',text='Q',correct_answer='A')
        db.add(question)
        db.add(StudentEnrollment(student_id='student',module_id=module_id,access_code_used='ABC123'))
        db.flush()
        answer=StudentAnswer(student_id='student',module_id=module_id,document_id=doc_id,
                             question_id=question.id,attempt=1,answer={'text':'A'})
        db.add(answer);db.flush()
        db.add_all([AIFeedback(answer_id=answer.id),FeedbackJob(answer_id=answer.id,module_id=module_id,student_id='student',attempt=1),
            TestSubmission(student_id='student',module_id=module_id,attempt=1,questions_count=1),
            QuestionQueue(student_id='student',module_id=module_id,question_id=question.id,position=0)])
        db.commit()
        assert delete_module_with_documents(db,str(module_id))
    with Session(pg_engine) as db:
        for model in (Module,Document,Question,StudentAnswer,AIFeedback,FeedbackJob,TestSubmission,StudentEnrollment,QuestionQueue):
            assert db.query(model).count() == 0, model.__name__
