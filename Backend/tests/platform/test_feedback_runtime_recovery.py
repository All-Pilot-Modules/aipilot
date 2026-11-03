"""Regression coverage for the observed pool exhaustion and consent failures."""
import threading
from unittest.mock import MagicMock
from uuid import uuid4
import pytest
from app.core.auth import create_student_token
from app.services import feedback_worker as worker


@pytest.mark.parametrize('choice', [1, 2, 3])
def test_student_can_save_own_consent(client, student_session, student_user, test_module, choice):
    url = f'/api/modules/{test_module.id}/consent/{student_user.id}'
    response = client.put(url, headers=student_session, json={'waiver_status': choice})
    assert response.status_code == 200, response.text
    assert client.get(url, headers=student_session).json()['consent_status'] == choice


@pytest.mark.parametrize('method', ['get', 'put'])
def test_consent_rejects_other_student_module_and_anonymous(client, student_session, student_user, test_module, method):
    request = getattr(client, method)
    kwargs = {'json': {'waiver_status': 1}} if method == 'put' else {}
    url = f'/api/modules/{test_module.id}/consent/{student_user.id}'
    assert request(url, **kwargs).status_code in (401, 403)
    assert request(url.replace(str(student_user.id), 'someone-else'), headers=student_session, **kwargs).status_code == 403
    token = create_student_token(student_user.id, uuid4())
    assert request(url, headers={'Authorization': 'Bearer ' + token}, **kwargs).status_code == 403


def test_unhealthy_loop_releases_leadership_and_stops_heartbeat(monkeypatch):
    stopped, lost = threading.Event(), threading.Event()
    monkeypatch.setattr(worker, '_stop_event', stopped)
    monkeypatch.setattr(worker, '_lost_leadership', lost)
    monkeypatch.setattr(worker, 'HEARTBEAT_INTERVAL', 0)
    monkeypatch.setattr(worker, '_last_loop_tick', 0)
    monkeypatch.setattr(worker.time, 'monotonic', lambda: 10000)
    release = MagicMock()
    monkeypatch.setattr(worker, '_release_leadership', release)
    worker._update_heartbeat()
    assert lost.is_set()
    release.assert_called_once()


def test_shutdown_keeps_handle_to_stuck_loop(monkeypatch):
    thread = MagicMock()
    thread.is_alive.return_value = True
    monkeypatch.setattr(worker, '_worker_thread', thread)
    monkeypatch.setattr(worker, '_heartbeat_thread', None)
    worker._stop_local_worker_threads()
    assert worker._worker_thread is thread


def test_provider_call_does_not_hold_read_transaction(db_session, student_answer_mcq, monkeypatch):
    from app.services.ai_feedback import AIFeedbackService
    from app.services import ai_feedback
    monkeypatch.setattr(AIFeedbackService, '__init__', lambda self: setattr(self, 'default_model', 'test-model'))
    monkeypatch.setattr(ai_feedback, 'should_include_context', lambda *args: False)
    observed = []
    def analyze(self, **kwargs):
        observed.append(db_session.in_transaction())
        # Scalar snapshots remain usable without lazy-loading another connection.
        assert kwargs['question'].text
        return {'is_correct': True, 'correctness_score': 100,
                'explanation': 'Correct.', 'points_earned': 1, 'points_possible': 1}
    monkeypatch.setattr(AIFeedbackService, '_analyze_mcq_answer', analyze)
    result = AIFeedbackService().generate_instant_feedback(db_session, student_answer_mcq,
        str(student_answer_mcq.question_id), str(student_answer_mcq.module_id))
    assert observed == [False], result
    assert not result.get('fallback')


def test_rag_embedding_does_not_hold_document_read_transaction(db_session, test_document, monkeypatch):
    from app.services import rag_retriever as rag
    test_document.processing_status = 'embedded'
    test_document.is_testbank = False
    db_session.commit()
    module_id = str(test_document.module_id)
    monkeypatch.setattr(rag, '_get_cached', lambda key: None)
    observed = []
    def embed(*args, **kwargs):
        observed.append(db_session.in_transaction())
        return {'embedding': [0.0]}
    monkeypatch.setattr(rag, 'generate_embedding', embed)
    monkeypatch.setattr(rag, 'search_similar_chunks_in_module', lambda **kwargs: [])
    rag.get_context_for_feedback(db_session, 'question', 'answer', module_id)
    assert observed == [False]
