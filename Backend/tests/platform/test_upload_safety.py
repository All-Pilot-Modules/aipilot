"""Regression coverage for authenticated, atomic upload/extraction and deletion."""
from unittest.mock import MagicMock
from uuid import uuid4
import pytest
from fastapi import HTTPException
from app.services import document as service
from app.models.document import Document
from app.models.question import Question
from app.models.module import Module
from app.models.student_answer import StudentAnswer
from app.models.document_chunk import DocumentChunk
from app.models.document_embedding import DocumentEmbedding
from app.services.document_storage import document_storage
from app.utils import question_parser as parser

SOURCE = '\n\n'.join(f'{i}. Question {i}?\nA. Yes\nB. No\nAnswer: A' for i in range(1, 6))

@pytest.fixture
def upload(db_session, test_module, teacher_user, tmp_path, monkeypatch):
    path = tmp_path / 'download.txt'
    monkeypatch.setattr(service.storage_service, 'upload_file', MagicMock(side_effect=lambda content,key: 'supabase://documents-private/'+key))
    monkeypatch.setattr(service.storage_service, 'download_file_temporarily', MagicMock(return_value=str(path)))
    monkeypatch.setattr(service.storage_service, 'delete_file', MagicMock(return_value=True))
    def run(name='testbank.txt', text=SOURCE, queued=False):
        path.write_text(text)
        return service.handle_document_upload(db_session, text.encode(), name, teacher_user.id,
                                             module_name=test_module.name, enqueue_only=queued)
    return run, path


def test_document_routes_require_auth(client, test_document):
    for method,path in [('get','/api/documents?teacher_id=TEACHER001'),
                        ('get',f'/api/documents/{test_document.id}'),
                        ('get',f'/api/documents/{test_document.id}/download-url'),
                        ('delete',f'/api/documents/{test_document.id}'),
                        ('post',f'/api/documents/{test_document.id}/reparse')]:
        assert getattr(client,method)(path).status_code in (401,403)


def test_cross_owner_and_unsafe_edits_rejected(client, test_document, auth_headers_student, auth_headers_teacher):
    assert client.get(f'/api/documents/{test_document.id}',headers=auth_headers_student).status_code == 403
    assert client.put(f'/api/documents/{test_document.id}',headers=auth_headers_teacher,
                      json={'storage_path':'/tmp/private'}).status_code == 422
    assert client.get('/api/documents?teacher_id=another',headers=auth_headers_teacher).status_code == 403


def test_upload_returns_queued_without_parsing(client, upload, test_module, teacher_user, auth_headers_teacher, monkeypatch):
    process = MagicMock(side_effect=AssertionError('must not process in request'))
    monkeypatch.setattr(service,'process_document',process)
    response=client.post('/api/upload',headers=auth_headers_teacher,
        data={'teacher_id':teacher_user.id,'module_name':test_module.name,'is_testbank':'true'},
        files={'file':('exam.txt',SOURCE.encode())})
    assert response.status_code == 202, response.text
    assert response.json()['processing_status'] == 'queued'
    assert response.json()['is_testbank'] is True
    process.assert_not_called()


@pytest.mark.parametrize('name,content,status', [('x.exe',b'x',415),('x.txt',b'',422),
    ('x.pdf',b'not pdf',422),('../x.txt',b'hello',422),('x.docx',b'not zip',422),
    ('x.txt',b'\x00binary',422),('x.txt',b'x'*(20*1024*1024+1),413)])
def test_invalid_files_never_reach_storage(upload, db_session, test_module, teacher_user, name,content,status):
    with pytest.raises(HTTPException) as error:
        service.handle_document_upload(db_session,content,name,teacher_user.id,module_name=test_module.name)
    assert error.value.status_code == status
    service.storage_service.upload_file.assert_not_called()


def test_duplicate_upload_is_idempotent(upload):
    first=upload[0]()
    second=upload[0]()
    assert first.id == second.id
    service.storage_service.upload_file.assert_called_once()


def test_embedding_failure_does_not_mark_ready(upload,db_session,monkeypatch):
    from app.services import embedding
    monkeypatch.setattr(embedding,'generate_embeddings_batch',MagicMock(side_effect=RuntimeError('provider unavailable')))
    doc=upload[0]('lesson.txt','Readable course material')
    assert doc.processing_status == 'failed'
    assert db_session.query(DocumentEmbedding).filter_by(document_id=doc.id).count() == 0
    assert db_session.query(DocumentChunk).filter_by(document_id=doc.id).count() == 0


@pytest.mark.parametrize('result',[[],[{'text':'invalid'}]])
def test_bad_reparse_preserves_questions(upload,db_session,monkeypatch,result):
    doc=upload[0]()
    ids={q.id for q in db_session.query(Question).filter_by(document_id=doc.id)}
    upload[1].write_text(SOURCE)
    monkeypatch.setattr(service,'parse_testbank_hybrid',MagicMock(return_value=result))
    service.reparse_testbank_document(db_session,doc.id)
    assert doc.parse_status == 'failed'
    assert {q.id for q in db_session.query(Question).filter_by(document_id=doc.id)} == ids


def test_reparse_with_answers_rejected(upload,db_session):
    doc=upload[0]()
    q=db_session.query(Question).filter_by(document_id=doc.id).first()
    db_session.add(StudentAnswer(student_id='student',module_id=doc.module_id,question_id=q.id,
                                 document_id=doc.id,answer={'text':'yes'},attempt=1))
    db_session.commit()
    with pytest.raises(HTTPException) as error:
        service.reparse_testbank_document(db_session,doc.id)
    assert error.value.status_code == 409


def test_keep_questions_keeps_answers(upload,db_session):
    from app.crud.document import delete_document
    doc=upload[0]()
    q=db_session.query(Question).filter_by(document_id=doc.id).first()
    answer=StudentAnswer(student_id='student',module_id=doc.module_id,question_id=q.id,
                         document_id=doc.id,answer={'text':'yes'},attempt=1)
    db_session.add(answer);db_session.commit()
    answer_id=answer.id
    delete_document(db_session,str(doc.id),delete_questions=False)
    db_session.expire_all()
    assert db_session.query(Question).count() == 5
    assert db_session.get(StudentAnswer,answer_id).document_id is None


def test_storage_cleanup_failure_retains_module_and_questions(upload,db_session,monkeypatch):
    from app.services.module import delete_module_with_documents
    doc=upload[0]()
    monkeypatch.setattr(document_storage,'delete_file',MagicMock(side_effect=RuntimeError('offline')))
    with pytest.raises(HTTPException) as error:
        delete_module_with_documents(db_session,str(doc.module_id))
    assert error.value.status_code == 503
    assert db_session.query(Question).count() == 5
    assert db_session.get(Module,doc.module_id).status == 'deleting'


def test_module_delete_removes_all_descendants(upload,db_session,test_module):
    from app.services.module import delete_module_with_documents
    from app.models.question_queue import QuestionQueue
    from app.models.student_enrollment import StudentEnrollment
    from app.models.test_submission import TestSubmission
    from app.models.ai_feedback import AIFeedback
    from app.models.feedback_job import FeedbackJob
    from app.models.chat_conversation import ChatConversation
    from app.models.chat_message import ChatMessage
    from app.models.survey_response import SurveyResponse
    doc=upload[0]()
    q=db_session.query(Question).filter_by(document_id=doc.id).first()
    enrollment=StudentEnrollment(student_id='student',module_id=test_module.id,access_code_used='TEST')
    answer=StudentAnswer(student_id='student',module_id=test_module.id,question_id=q.id,
                         document_id=doc.id,answer={'text':'yes'},attempt=1)
    chat=ChatConversation(student_id='student',module_id=test_module.id,title='Chat')
    db_session.add_all([enrollment,answer,chat]);db_session.flush()
    db_session.add_all([
        TestSubmission(student_id='student',module_id=test_module.id,attempt=1,questions_count=5),
        AIFeedback(answer_id=answer.id),
        FeedbackJob(answer_id=answer.id,student_id='student',module_id=test_module.id,attempt=1),
        QuestionQueue(student_id='student',module_id=test_module.id,question_id=q.id,position=0),
        ChatMessage(conversation_id=chat.id,role='user',content='hello'),
        SurveyResponse(student_id='student',module_id=test_module.id,responses={'q1':'yes'}),
    ]);db_session.commit()
    delete_module_with_documents(db_session,str(test_module.id))
    for model in (Module,Document,Question,StudentAnswer,StudentEnrollment,TestSubmission,AIFeedback,
                  FeedbackJob,QuestionQueue,ChatConversation,ChatMessage,SurveyResponse):
        assert db_session.query(model).count() == 0, model.__name__
    document_storage.delete_file.assert_called_once()


def test_storage_url_resolution_and_local_path_rejection():
    assert document_storage.resolve('https://test.supabase.co/storage/v1/object/public/uploads/a/b.txt?') == ('uploads','a/b.txt')
    for ref in ('/tmp/file','https://evil.invalid/storage/v1/object/public/uploads/a.txt','supabase://documents-private/../file'):
        with pytest.raises(ValueError): document_storage.resolve(ref)


def test_short_answer_and_small_bank_do_not_need_ai(monkeypatch):
    ai=MagicMock(side_effect=AssertionError('unneeded AI'))
    monkeypatch.setattr(parser,'parse_testbank_with_ai',ai)
    questions=parser.parse_testbank_hybrid('1. What is 2+2?\nAnswer: 4',uuid4())
    assert questions[0]['correct_answer'] == '4'
    assert questions[0]['text'] == 'What is 2+2?'
    ai.assert_not_called()


def test_status_metadata_survives_multiple_updates(upload,db_session):
    from app.services.document_status import update_document_status
    doc=upload[0](queued=True)
    update_document_status(db_session,str(doc.id),'extracted',{'char_count':10})
    update_document_status(db_session,str(doc.id),'chunked',{'chunk_count':1})
    db_session.expire_all()
    assert db_session.get(Document,doc.id).processing_metadata['chunk_count'] == 1


def test_docx_tables_extracted(tmp_path):
    from docx import Document as Docx
    from app.utils.text_extractor import extract_text_from_file
    doc=Docx();doc.add_table(rows=1,cols=1).cell(0,0).text='Important content'
    path=tmp_path/'table.docx';doc.save(path)
    assert 'Important content' in extract_text_from_file(str(path),'docx')['text']


def test_blank_pdf_requires_ocr(tmp_path,monkeypatch):
    import fitz
    from app.utils import text_extractor
    path=tmp_path/'blank.pdf'
    with fitz.open() as doc: doc.new_page();doc.save(path)
    monkeypatch.setattr(text_extractor,'extract_text_with_llamaparse',MagicMock(side_effect=RuntimeError('offline')))
    with pytest.raises(ValueError,match='OCR'):
        text_extractor.extract_text_from_file(str(path),'pdf')


def test_student_download_is_module_scoped_and_excludes_testbanks(client,student_session,test_document,db_session,monkeypatch):
    monkeypatch.setattr(document_storage,'signed_url',MagicMock(return_value='https://test.invalid/signed'))
    url=f'/api/documents/{test_document.id}/download-url'
    assert client.get(url,headers=student_session).status_code == 200
    test_document.is_testbank=True;db_session.commit()
    assert client.get(url,headers=student_session).status_code == 403
    document_storage.signed_url.assert_called_once()


def test_module_delete_authorization(client,test_module,auth_headers_student,auth_headers_teacher,monkeypatch):
    from app.api.routes import module
    remove=MagicMock(return_value=True)
    monkeypatch.setattr(module,'delete_module_with_documents',remove)
    url=f'/api/modules/{test_module.id}'
    assert client.delete(url).status_code in (401,403)
    assert client.delete(url,headers=auth_headers_student).status_code == 403
    remove.assert_not_called()
    assert client.delete(url,headers=auth_headers_teacher).status_code == 200


def test_module_delete_leaves_other_modules_intact(upload,db_session,teacher_user):
    from app.services.module import delete_module_with_documents
    doc=upload[0]()
    other=Module(id=uuid4(),teacher_id=teacher_user.id,name='Other',slug='other',access_code='OTHER1')
    db_session.add(other);db_session.flush()
    q=Question(module_id=other.id,type='short',text='Keep me',correct_answer='Yes')
    db_session.add(q);db_session.commit()
    qid=q.id
    delete_module_with_documents(db_session,str(doc.module_id))
    assert db_session.get(Question,qid).text == 'Keep me'
    assert db_session.get(Module,other.id)


def test_interrupted_upload_can_resume(upload,db_session,monkeypatch):
    storage=service.storage_service.upload_file
    storage.side_effect=RuntimeError('offline')
    with pytest.raises(HTTPException): upload[0](queued=True)
    doc=db_session.query(Document).one()
    original_id=doc.id
    assert doc.processing_metadata['upload_complete'] is False
    storage.side_effect=lambda content,key: 'supabase://documents-private/'+key
    resumed=upload[0](queued=True)
    assert resumed.id == original_id
    assert resumed.processing_status == 'queued'
    assert resumed.processing_metadata['upload_complete'] is True


def test_image_upload_failure_preserves_old_image(client,mcq_question,db_session,auth_headers_teacher,monkeypatch):
    import io
    from PIL import Image
    from app.services.storage import SupabaseStorageService
    mcq_question.image_url='https://test.supabase.co/storage/v1/object/public/question-images/old.png'
    db_session.commit()
    monkeypatch.setattr(SupabaseStorageService,'upload_file',MagicMock(side_effect=RuntimeError('offline')))
    image=io.BytesIO();Image.new('RGB',(2,2)).save(image,format='PNG')
    response=client.post(f'/api/questions/{mcq_question.id}/upload-image',headers=auth_headers_teacher,
                         files={'file':('image.png',image.getvalue(),'image/png')})
    assert response.status_code == 503
    db_session.refresh(mcq_question)
    assert mcq_question.image_url.endswith('/old.png')
    module=db_session.get(Module,mcq_question.module_id)
    assert module.ai_config['pending_storage_cleanup']


def test_private_bucket_must_not_be_public(monkeypatch):
    client=document_storage.client
    client.storage.list_buckets.return_value=[{'id':'documents-private','public':True}]
    client.storage.get_bucket.return_value={'id':'documents-private','public':True}
    with pytest.raises(RuntimeError,match='private'):
        document_storage.ensure_private_bucket()
    client.storage.list_buckets.reset_mock(return_value=True)
    client.storage.get_bucket.reset_mock(return_value=True)


def test_empty_ai_response_never_succeeds(monkeypatch):
    monkeypatch.setattr(parser,'parse_testbank_with_ai',MagicMock(return_value=[]))
    with pytest.raises(ValueError):
        parser.parse_testbank_hybrid('1. Question without an answer',uuid4())


def test_embedding_batch_preserves_provider_indices(monkeypatch):
    from types import SimpleNamespace
    from app.services import embedding
    response=SimpleNamespace(data=[SimpleNamespace(index=1,embedding=[2.0]),SimpleNamespace(index=0,embedding=[1.0])],usage=SimpleNamespace(total_tokens=2))
    monkeypatch.setattr(embedding.client,'create_embedding',MagicMock(return_value=response))
    assert [r['embedding'] for r in embedding.generate_embeddings_batch(['first','second'])] == [[1.0],[2.0]]


def test_legacy_private_migration_repairs_flags_without_replacing_questions(upload,db_session,monkeypatch):
    from scripts.migrate_document_storage import migrate
    doc=upload[0]()
    old='https://test.supabase.co/storage/v1/object/public/uploads/owner/module/testbank.txt?'
    doc.storage_path=old;doc.is_testbank=False;doc.processing_status='uploaded'
    db_session.commit()
    ids={q.id for q in db_session.query(Question)}
    monkeypatch.setattr(document_storage.client.storage,'from_',MagicMock(return_value=MagicMock(download=MagicMock(return_value=SOURCE.encode()))))
    migrate(db_session,apply=True)
    db_session.refresh(doc)
    assert doc.storage_path.startswith('supabase://documents-private/')
    assert doc.is_testbank and doc.processing_status == 'parsed'
    assert {q.id for q in db_session.query(Question)} == ids
    assert old in [call.args[0] for call in document_storage.delete_file.call_args_list]


def test_migration_dry_run_does_not_mutate_storage(upload,db_session):
    from scripts.migrate_document_storage import migrate
    doc=upload[0]()
    doc.storage_path='https://test.supabase.co/storage/v1/object/public/uploads/owner/testbank.txt?'
    db_session.commit()
    document_storage.upload_file.reset_mock()
    migrate(db_session,apply=False)
    document_storage.upload_file.assert_not_called()
    document_storage.delete_file.assert_not_called()


def test_stored_content_mismatch_does_not_replace_questions(upload,db_session):
    doc=upload[0]()
    upload[1].write_text('1. Changed question\nAnswer: Unexpected')
    service.reparse_testbank_document(db_session,doc.id)
    assert doc.processing_status == 'failed'
    assert 'no longer matches' in doc.parse_error
    assert db_session.query(Question).filter_by(document_id=doc.id).count() == 5


def test_module_delete_includes_grades_claims_collaborators_and_memory(upload,db_session,teacher_user):
    from datetime import datetime, timezone
    from app.services.module import delete_module_with_documents
    from app.models.student_enrollment import StudentEnrollment
    from app.models.test_submission import TestSubmission
    from app.models.module_batch import ModuleBatch
    from app.models.module_collaborator import ModuleCollaborator
    from app.models.enrollment_claim import EnrollmentClaim
    from app.models.ai_feedback import AIFeedback
    from app.models.feedback_critique import FeedbackCritique
    from app.models.teacher_grade import TeacherGrade
    from app.models.answer_grade import AnswerGrade
    from app.models.student_module_grade import StudentModuleGrade
    from app.models.learning_memory import LearningMemory
    doc=upload[0]()
    module_id=doc.module_id
    question=db_session.query(Question).filter_by(document_id=doc.id).first()
    enrollment=StudentEnrollment(student_id='student',module_id=module_id,access_code_used='TEST')
    batch=ModuleBatch(module_id=module_id,name='Exam')
    db_session.add_all([enrollment,batch]);db_session.flush()
    answer=StudentAnswer(student_id='student',module_id=module_id,question_id=question.id,
                         document_id=doc.id,answer={'text':'Yes'},attempt=1,batch_id=batch.id)
    submission=TestSubmission(student_id='student',module_id=module_id,attempt=1,questions_count=5,batch_id=batch.id)
    chunk=DocumentChunk(document_id=doc.id,module_id=module_id,chunk_index=0,chunk_text='Text',chunk_size=4)
    db_session.add_all([answer,submission,chunk]);db_session.flush()
    feedback=AIFeedback(answer_id=answer.id)
    db_session.add(feedback);db_session.flush()
    now=datetime.now(timezone.utc)
    db_session.add_all([
        DocumentEmbedding(document_id=doc.id,module_id=module_id,chunk_id=chunk.id,embedding_vector=[0.0]*1536),
        FeedbackCritique(feedback_id=feedback.id,student_id='student',rating=4),
        TeacherGrade(answer_id=answer.id,student_id='student',module_id=module_id,question_id=question.id,
                     points_awarded=1,graded_by=teacher_user.id),
        AnswerGrade(answer_id=answer.id,student_id='student',module_id=module_id,question_id=question.id,attempt=1),
        StudentModuleGrade(student_id='student',module_id=module_id,attempt=1),
        ModuleCollaborator(module_id=module_id,user_id=teacher_user.id),
        EnrollmentClaim(user_id=teacher_user.id,banner_id='student',module_id=module_id,access_code='TEST'),
        LearningMemory(submission_id=submission.id,module_id=module_id,student_id='student',attempt=1,
                       available_at=now,created_at=now,updated_at=now),
    ]);db_session.commit()
    delete_module_with_documents(db_session,str(module_id))
    for model in (DocumentEmbedding,DocumentChunk,FeedbackCritique,TeacherGrade,AnswerGrade,StudentModuleGrade,
                  ModuleCollaborator,EnrollmentClaim,LearningMemory,ModuleBatch):
        assert db_session.query(model).count() == 0, model.__name__
    assert db_session.get(type(teacher_user),teacher_user.id) is not None
