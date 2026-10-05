"""Teacher detail-page survey access must not require a student session."""
from app.core.auth import create_access_token
from app.models.user import User


def test_teacher_reads_selected_student_survey(client, test_module, student_session, student_user, auth_headers_teacher):
    saved = client.post(f'/api/student/modules/{test_module.id}/survey',
                        headers=student_session, json={'responses': {'q1': 'Helpful', 'q3': 'Good experience'}})
    assert saved.status_code == 200, saved.text
    url = f'/api/modules/{test_module.id}/survey/students/{student_user.id}'
    result = client.get(url, headers=auth_headers_teacher)
    assert result.status_code == 200, result.text
    assert result.json()['my_response']['responses'] == {'q1': 'Helpful', 'q3': 'Good experience'}
    assert result.json()['my_response']['student_id'] == student_user.id
    empty = client.get(f'/api/modules/{test_module.id}/survey/students/another-student', headers=auth_headers_teacher)
    assert empty.status_code == 200
    assert empty.json()['my_response'] is None


def test_teacher_survey_rejects_anonymous_and_student(client, test_module, student_session):
    url = f'/api/modules/{test_module.id}/survey/students/some-student'
    assert client.get(url).status_code == 403
    assert client.get(url, headers=student_session).status_code == 403


def test_teacher_cannot_read_another_teachers_survey(client, db_session, test_module):
    other = User(id='OTHER-TEACHER', username='otherteacher', email='other@example.test',
                 hashed_password='unused', role='teacher', is_active=True)
    db_session.add(other)
    db_session.flush()
    token = create_access_token({'sub': other.id})
    response = client.get(f'/api/modules/{test_module.id}/survey/students/some-student',
                          headers={'Authorization': f'Bearer {token}'})
    assert response.status_code == 403
