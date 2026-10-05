"""Provider contracts and deterministic grading without live API usage."""
from types import SimpleNamespace
from unittest.mock import MagicMock
import json
import pytest
from app.services import embedding
from app.services.question_grading import QuestionGradingService


def response(vectors):
    return SimpleNamespace(data=[SimpleNamespace(embedding=v) for v in vectors],
                           usage=SimpleNamespace(total_tokens=12))


def test_embedding_requests_expected_dimensions(monkeypatch):
    provider = MagicMock(return_value=response([[0.1] * 1536]))
    monkeypatch.setattr(embedding.client, "create_embedding", provider)
    result = embedding.generate_embedding("Product rule")
    assert result["dimensions"] == 1536
    assert result["tokens"] == 12
    assert len(result["embedding"]) == 1536
    assert provider.call_args.kwargs["dimensions"] == 1536


def test_embedding_batch_one_provider_call(monkeypatch):
    provider = MagicMock(return_value=response([[0.1] * 1536, [0.2] * 1536]))
    monkeypatch.setattr(embedding.client, "create_embedding", provider)
    results = embedding.generate_embeddings_batch(["First", "Second"])
    provider.assert_called_once()
    assert [r["embedding"][0] for r in results] == [0.1, 0.2]


def test_embedding_failure_is_not_silent(monkeypatch):
    monkeypatch.setattr(embedding.client, "create_embedding", MagicMock(side_effect=RuntimeError("provider unavailable")))
    with pytest.raises(RuntimeError, match="provider unavailable"):
        embedding.generate_embedding("Product rule")


def test_rag_cache_isolates_student_answers():
    from app.services.rag_retriever import _cache_key
    assert _cache_key("module", "question", "wrong") != _cache_key("module", "question", "correct")


@pytest.mark.parametrize("selected,correct,expected", [(["A"], ["A"], True),
    (["B"], ["A"], False), (["A", "C"], ["A", "C"], True), ([], ["A"], False)])
def test_multiple_choice_grading(selected, correct, expected):
    service = QuestionGradingService()
    result = service.grade_mcq_multiple(selected, correct, total_options=4)
    assert result["is_correct"] is expected
    assert 0 <= result["score"] <= 100


def test_fill_blank_partial_credit_and_empty_answers():
    service = QuestionGradingService()
    result = service.grade_fill_blank({0: "Paris", 1: ""}, [
        {"position": 0, "correct_answers": ["Paris"], "points": 2},
        {"position": 1, "correct_answers": ["France"], "points": 3}], use_ai_semantic_matching=False)
    assert result["earned_points"] == 2
    assert result["total_points"] == 5
    assert result["partial_credit"] is True


def test_feedback_provider_failure_marked_for_retry(monkeypatch, mcq_question):
    from app.services import ai_feedback
    ai_feedback._mcq_cache.clear()
    service = ai_feedback.AIFeedbackService()
    monkeypatch.setattr(service.client, "create_chat_completion", MagicMock(side_effect=RuntimeError("provider unavailable")))
    result = service._analyze_mcq_answer("B", mcq_question, "gpt-4o-mini", {})
    assert result["fallback"] is True
    assert result["_error_type"]
    assert result["is_correct"] is True  # deterministic MCQ score survives


def test_successful_mcq_feedback_uses_provider_and_cache(monkeypatch, mcq_question):
    from app.services import ai_feedback
    ai_feedback._mcq_cache.clear()
    provider = MagicMock(return_value=SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(
        content=json.dumps({"explanation": "Paris is France's capital.", "concept_explanation": "Capital cities."})))]))
    service = ai_feedback.AIFeedbackService()
    monkeypatch.setattr(service.client, "create_chat_completion", provider)
    first = service._analyze_mcq_answer("B", mcq_question, "gpt-4o-mini", {})
    second = service._analyze_mcq_answer("B", mcq_question, "gpt-4o-mini", {})
    assert not first.get("fallback", False)
    assert first["correctness_score"] == 100
    assert second["explanation"] == first["explanation"]
    provider.assert_called_once()


def test_document_embeddings_persist_per_chunk(db_session, test_document, monkeypatch):
    from app.models.document_chunk import DocumentChunk
    from app.models.document_embedding import DocumentEmbedding
    chunks = [DocumentChunk(document_id=test_document.id, module_id=test_document.module_id,
        chunk_index=i, chunk_text=f"Section {i}", chunk_size=9) for i in range(3)]
    db_session.add_all(chunks)
    db_session.flush()

    def create(**kwargs):
        return response([[0.1] * 1536 for _ in kwargs["input"]])

    provider = MagicMock(side_effect=create)
    monkeypatch.setattr(embedding.client, "create_embedding", provider)
    assert embedding.generate_embeddings_for_document(db_session, str(test_document.id), batch_size=2) == 3
    rows = db_session.query(DocumentEmbedding).filter_by(document_id=test_document.id).all()
    assert {row.chunk_id for row in rows} == {chunk.id for chunk in chunks}
    assert all(row.module_id == test_document.module_id and row.embedding_dimensions == 1536 for row in rows)
    assert provider.call_count == 2
