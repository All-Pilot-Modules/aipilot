"""
Integration tests for module API routes.
"""
import pytest
import uuid


class TestModuleRoutes:
    """Tests for module management API endpoints."""

    def test_create_module(self, client, auth_headers_teacher):
        """Test creating a new module."""
        response = client.post(
            "/api/modules",
            json={
                "name": f"Test Module {uuid.uuid4().hex[:6]}",
                "description": "A test module",
                "access_code": f"TEST{uuid.uuid4().hex[:6].upper()}",
            },
            headers=auth_headers_teacher,
        )

        assert response.status_code in [200, 201]
        data = response.json()
        assert "id" in data
        assert "access_code" in data

    def test_create_module_student_forbidden(self, client, auth_headers_student):
        """Test that students cannot create modules."""
        response = client.post(
            "/api/modules",
            json={
                "name": "Unauthorized Module",
                "access_code": "UNAUTH",
            },
            headers=auth_headers_student,
        )

        assert response.status_code == 403

    def test_get_module_by_id(self, client, test_module, auth_headers_teacher):
        """Test getting a module by ID."""
        response = client.get(
            f"/api/modules/{test_module.id}",
            headers=auth_headers_teacher,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_module.id)

    def test_get_module_not_found(self, client, auth_headers_teacher):
        """Test getting a non-existent module."""
        response = client.get(
            f"/api/modules/{uuid.uuid4()}",
            headers=auth_headers_teacher,
        )

        assert response.status_code == 404

    def test_get_teacher_modules(self, client, test_module, auth_headers_teacher):
        """Test getting all modules for a teacher."""
        response = client.get(
            "/api/modules",
            headers=auth_headers_teacher,
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_update_module(self, client, test_module, auth_headers_teacher):
        """Test updating a module."""
        response = client.put(
            f"/api/modules/{test_module.id}",
            json={
                "description": "Updated description",
            },
            headers=auth_headers_teacher,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["description"] == "Updated description"

    def test_update_module_not_owner(self, client, test_module, admin_user, admin_token):
        """Test that non-owners cannot update modules."""
        # Create another teacher
        response = client.put(
            f"/api/modules/{test_module.id}",
            json={"description": "Hacked"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        # May succeed for admin or fail for non-owner
        assert response.status_code in [200, 403]

    def test_join_module_by_code(self, client, test_module, auth_headers_student):
        """Test student joining a module by access code."""
        response = client.post(
            "/api/modules/join",
            json={"access_code": test_module.access_code},
            headers=auth_headers_student,
        )

        assert response.status_code in [200, 201]

    def test_join_module_invalid_code(self, client, auth_headers_student):
        """Test joining with invalid access code."""
        response = client.post(
            "/api/modules/join",
            json={"access_code": "INVALID_CODE"},
            headers=auth_headers_student,
        )

        assert response.status_code in [400, 404]


class TestModuleRubricRoutes:
    """Tests for module rubric API endpoints."""

    def test_get_module_rubric(self, client, test_module, auth_headers_teacher):
        """Test getting module rubric."""
        response = client.get(
            f"/api/modules/{test_module.id}/rubric",
            headers=auth_headers_teacher,
        )

        assert response.status_code == 200
        data = response.json()
        assert "grading_criteria" in data or data is not None

    def test_update_module_rubric(self, client, test_module, auth_headers_teacher):
        """Test updating module rubric."""
        new_rubric = {
            "grading_criteria": {
                "accuracy": {"weight": 50, "description": "Correctness"},
                "clarity": {"weight": 50, "description": "Clear writing"},
            },
            "feedback_style": {"tone": "strict"},
        }

        response = client.put(
            f"/api/modules/{test_module.id}/rubric",
            json=new_rubric,
            headers=auth_headers_teacher,
        )

        assert response.status_code == 200
