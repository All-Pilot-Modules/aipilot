from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4
from unittest.mock import MagicMock
import pytest
from pydantic import ValidationError
from fastapi import HTTPException
from app.services.learning_memory import Observation, memory_entries
from app.api.routes.learning_memory import get_learning_memory


def test_observation_rejects_unstructured_or_excessive_output():
    with pytest.raises(ValidationError):
        Observation.model_validate({'summary':'ok'})
    with pytest.raises(ValidationError):
        Observation(summary='ok', strengths=['x']*4, areas_to_improve=[], next_steps=[])
    assert Observation(summary='Used the product rule correctly.', strengths=[], areas_to_improve=[], next_steps=[]).summary


def test_memory_query_scopes_student_module_and_completed():
    db=MagicMock()
    db.query.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value=[]
    mid=uuid4()
    assert memory_entries(db, mid, 'student-a') == []
    clauses=db.query.return_value.filter.call_args.args
    assert len(clauses)==3
    assert [clause.right.value for clause in clauses] == [mid, 'student-a', 'completed']


def test_other_teacher_cannot_read_memory():
    db=MagicMock()
    db.query.return_value.filter.return_value.first.return_value=SimpleNamespace(teacher_id='owner')
    with pytest.raises(HTTPException) as exc:
        get_learning_memory(uuid4(), 'student-a', db, SimpleNamespace(id='other'))
    assert exc.value.status_code == 403
    assert db.query.call_count == 1


def test_memory_waits_for_real_released_complete_feedback():
    from app.services.learning_memory import feedback_ready
    feedback=SimpleNamespace(generation_status='completed', released=True, error_type=None, feedback_data={'explanation':'correct'})
    rows=[(None, None, feedback)]
    assert feedback_ready(rows, 1)
    assert not feedback_ready(rows, 2)
    feedback.feedback_data['fallback']=True
    assert not feedback_ready(rows, 1)
    feedback.feedback_data.pop('fallback')
    feedback.released=False
    assert not feedback_ready(rows, 1)
    assert not feedback_ready([], 0)


def test_generation_commits_claim_before_ai_and_saves_validated_evidence(monkeypatch):
    import json
    import app.services.learning_memory as service
    from app.services import openai_client
    db=MagicMock()
    submission=SimpleNamespace(id=uuid4(), module_id=uuid4(), student_id='synthetic', attempt=1,
        questions_count=1, submitted_at=datetime.now(timezone.utc))
    answer=SimpleNamespace(id=uuid4(), answer={'text':'3x squared'})
    feedback=SimpleNamespace(generation_status='completed', released=True, error_type=None,
        feedback_data={'explanation':'Power rule used correctly'}, score=100)
    candidate=MagicMock(); evidence=MagicMock(); previous=MagicMock(); saved=MagicMock()
    candidate.outerjoin.return_value.filter.return_value.order_by.return_value.with_for_update.return_value.first.return_value=submission
    evidence.join.return_value.outerjoin.return_value.filter.return_value.all.return_value=[(answer,SimpleNamespace(text='Differentiate x cubed'),feedback)]
    previous.filter.return_value.order_by.return_value.limit.return_value.all.return_value=[]
    db.query.side_effect=[candidate,evidence,previous,saved]
    session=MagicMock(); session.__enter__.return_value=db
    monkeypatch.setattr(service,'SessionLocal',lambda:session)
    observation={'summary':'Applied the power rule correctly.','strengths':['Power rule'],'areas_to_improve':[],'next_steps':['Practise another polynomial.']}
    client=MagicMock()
    def respond(**kwargs):
        assert db.commit.call_count == 1
        assert kwargs['response_format']=={'type':'json_object'}
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(observation)))])
    client.create_chat_completion.side_effect=respond
    monkeypatch.setattr(openai_client,'OpenAIClientWithRetry',lambda **kwargs:client)
    assert service.generate_one()
    update=saved.filter.return_value.update.call_args.args[0]
    assert update['status']=='completed'
    assert update['source_answer_ids']==[str(answer.id)]
    assert update['observations']==observation
    assert len(saved.filter.call_args.args)==2  # Submission and lease ownership fencing.


def test_tutor_receives_only_its_scoped_memory(monkeypatch):
    import app.services.learning_memory as memory
    import app.services.chatbot as chatbot
    db=MagicMock()
    db.query.return_value.filter.return_value.first.return_value=SimpleNamespace(name='Maths', assignment_config={}, chatbot_instructions=None)
    journal=MagicMock(return_value='Prior evidence: practised the product rule.')
    monkeypatch.setattr(memory, 'tutor_memory', journal)
    monkeypatch.setattr(chatbot, 'get_context_for_feedback', lambda **kwargs: {'has_context':False})
    completion=SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content='Try the product rule.'))])
    ai=MagicMock(return_value=completion)
    monkeypatch.setattr(chatbot._chatbot_client, 'create_chat_completion', ai)
    chatbot.get_chatbot_response(db, 'module-a', 'Help me practise', [], 'student-a')
    journal.assert_called_once_with(db, 'module-a', 'student-a')
    assert 'Prior evidence: practised the product rule.' in ai.call_args.kwargs['messages'][0]['content']


def test_concept_memory_validates_evidence_ids_and_signal():
    import json
    from app.services.learning_memory import validate_observation
    memory = {'summary': 'The student applied the product rule.', 'strengths': [],
              'areas_to_improve': [], 'next_steps': [], 'concepts': [{
                  'concept': 'Product rule', 'observation': 'Both factors were differentiated.',
                  'signal': 'demonstrated', 'answer_ids': ['answer-a']}]}
    assert validate_observation(json.dumps(memory), [{'answer_id': 'answer-a'}])['concepts'][0]['concept'] == 'Product rule'
    with pytest.raises(ValueError):
        validate_observation(json.dumps(memory), [{'answer_id': 'another-student-answer'}])
    memory['concepts'][0]['signal'] = 'mastered'
    with pytest.raises(ValidationError):
        validate_observation(json.dumps(memory), [{'answer_id': 'answer-a'}])
