from app.api.routes.survey import _get_survey_config, _set_survey_config
from app.config.survey_defaults import DEFAULT_SURVEY_QUESTIONS


def test_original_defaults_for_unconfigured_module(test_module):
    test_module.settings = {'survey': {'questions': [], 'required': False}}
    questions, required = _get_survey_config(test_module)
    assert questions == DEFAULT_SURVEY_QUESTIONS
    assert len(questions) == 5
    assert not required
    questions[0]['question'] = 'changed locally'
    assert DEFAULT_SURVEY_QUESTIONS[0]['question'] != 'changed locally'


def test_teacher_can_intentionally_remove_all_questions(test_module):
    _set_survey_config(test_module, questions=[])
    assert _get_survey_config(test_module)[0] == []


def test_custom_questions_are_preserved(test_module):
    questions = [{'id': 'custom', 'question': 'How was it?', 'type': 'short', 'required': False}]
    _set_survey_config(test_module, questions=questions)
    assert _get_survey_config(test_module)[0] == questions


def test_teacher_and_student_receive_same_defaults(client, test_module, student_session):
    teacher = client.get(f'/api/modules/{test_module.id}/survey')
    student = client.get(f'/api/student/modules/{test_module.id}/survey', headers=student_session)
    assert teacher.status_code == student.status_code == 200
    assert teacher.json()['survey_questions'] == student.json()['survey_questions'] == DEFAULT_SURVEY_QUESTIONS
