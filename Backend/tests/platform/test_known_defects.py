"""Executable outstanding bugs. Strict xfail requires revisiting a test when fixed.

These are NOT passing functionality; see TESTING.md for release implications.
"""
import json
import pytest
from app.services.ai_feedback import _loads_feedback_json


def test_valid_json_math_roundtrips():
    expected = {"explanation": r"$\frac{1}{2}$"}
    assert _loads_feedback_json(json.dumps(expected)) == expected


@pytest.mark.xfail(strict=True, reason="BUG-TEACHER-AUTH: teacher feedback endpoint lacks authentication")
def test_teacher_feedback_rejects_anonymous(client, test_module):
    response = client.get(f"/api/ai-feedback/teacher/module/{test_module.id}/released")
    assert response.status_code == 403


@pytest.mark.xfail(strict=True, reason="BUG-JOIN-IDENTITY: shared class code can mint another student's identity")
def test_join_cannot_impersonate_existing_student(client, test_module, student_session, student_user):
    response = client.post("/api/student/join-module", params={
        "access_code": test_module.access_code, "student_id": student_user.id})
    assert response.status_code == 403
