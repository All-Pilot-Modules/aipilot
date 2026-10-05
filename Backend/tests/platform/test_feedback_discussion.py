from app.models.ai_feedback import AIFeedback
from app.core.auth import create_student_token
from unittest.mock import patch
import json


def test_discussion_uses_saved_context(client, db_session, student_answer_text, student_session):
    fb = AIFeedback(answer_id=student_answer_text.id, released=True, score=25, points_earned=0.25, points_possible=1, feedback_data={'explanation':'Review the product rule', 'strengths':['Clear notation'], 'weaknesses':['Missing a term'], 'improvement_hint':'Differentiate both factors', 'concept_explanation':'Product rule'})
    db_session.add(fb)
    db_session.flush()
    with patch('app.api.routes.chat.get_chatbot_response', return_value={'response':'Let us review your reasoning.'}) as ai:
        response = client.post(f'/api/chat/feedback/{fb.id}/discuss', headers=student_session)
    assert response.status_code == 200, response.text
    context = json.loads(ai.call_args.kwargs['student_question'].split('\n\n', 1)[1])
    assert context['answer'] == student_answer_text.answer
    assert context['attempt'] == student_answer_text.attempt
    assert context['question']
    assert context['score'] == 25
    assert context['feedback'] == fb.feedback_data
    with patch('app.api.routes.chat.get_chatbot_response', return_value={'response':'Let us take the next step.'}) as follow_up:
        continued = client.post(f"/api/chat/conversations/{response.json()['conversation_id']}/message",
            headers=student_session, json={'message':'Explain the missing term.'})
    assert continued.status_code == 200
    assert any('Review the product rule' in msg.content for msg in follow_up.call_args.kwargs['conversation_history'])
    assert response.json()['assistant_message']['content'] == 'Let us review your reasoning.'
    fb.released = False
    db_session.flush()
    assert client.post(f'/api/chat/feedback/{fb.id}/discuss', headers=student_session).status_code == 404


def test_discussion_rejects_other_student(client, db_session, student_answer_text):
    fb = AIFeedback(answer_id=student_answer_text.id, released=True)
    db_session.add(fb)
    db_session.flush()
    token = create_student_token('someone-else', student_answer_text.module_id)
    assert client.post(f'/api/chat/feedback/{fb.id}/discuss', headers={'Authorization':f'Bearer {token}'}).status_code == 404


def test_discussion_waits_for_real_feedback(client, db_session, student_answer_text, student_session):
    fb = AIFeedback(answer_id=student_answer_text.id, released=True, generation_status='pending')
    db_session.add(fb)
    db_session.flush()
    url = f'/api/chat/feedback/{fb.id}/discuss'
    assert client.post(url, headers=student_session).status_code == 409
    fb.generation_status = 'completed'
    fb.feedback_data = {'fallback': True, 'explanation': 'Temporarily unavailable'}
    db_session.flush()
    assert client.post(url, headers=student_session).status_code == 409
