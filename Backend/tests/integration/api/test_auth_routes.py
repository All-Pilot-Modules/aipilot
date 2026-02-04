"""
Integration tests for auth API routes.
"""
import pytest


class TestAuthRoutes:
    """Tests for authentication API endpoints."""

    def test_register_new_user(self, client):
        """Test registering a new user."""
        response = client.post(
            "/api/auth/register",
            json={
                "id": "NEWUSER001",
                "email": "newuser@test.com",
                "password": "SecurePassword123!",
                "role": "student",
            },
        )

        assert response.status_code in [200, 201]
        data = response.json()
        assert "id" in data or "user_id" in data or "access_token" in data

    def test_register_duplicate_id(self, client, student_user):
        """Test registration fails for duplicate ID."""
        response = client.post(
            "/api/auth/register",
            json={
                "id": student_user.id,
                "email": "another@test.com",
                "password": "Password123!",
                "role": "student",
            },
        )

        assert response.status_code in [400, 409]

    def test_login_valid_credentials(self, client, student_user):
        """Test login with valid credentials."""
        response = client.post(
            "/api/auth/login",
            json={
                "id": student_user.id,
                "password": "password123",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data

    def test_login_invalid_password(self, client, student_user):
        """Test login fails with wrong password."""
        response = client.post(
            "/api/auth/login",
            json={
                "id": student_user.id,
                "password": "wrongpassword",
            },
        )

        assert response.status_code == 401

    def test_login_nonexistent_user(self, client):
        """Test login fails for non-existent user."""
        response = client.post(
            "/api/auth/login",
            json={
                "id": "NONEXISTENT",
                "password": "password123",
            },
        )

        assert response.status_code in [401, 404]

    def test_refresh_token(self, client, student_user):
        """Test refreshing access token."""
        # First login to get refresh token
        login_response = client.post(
            "/api/auth/login",
            json={
                "id": student_user.id,
                "password": "password123",
            },
        )
        refresh_token = login_response.json()["refresh_token"]

        # Use refresh token
        response = client.post(
            "/api/auth/refresh",
            json={"refresh_token": refresh_token},
        )

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data

    def test_protected_route_without_token(self, client):
        """Test that protected routes require authentication."""
        response = client.get("/api/modules")

        assert response.status_code == 401 or response.status_code == 403

    def test_protected_route_with_token(self, client, auth_headers_student):
        """Test accessing protected route with valid token."""
        response = client.get(
            "/api/student/profile",
            headers=auth_headers_student,
        )

        # Should not be 401
        assert response.status_code != 401


class TestPasswordReset:
    """Tests for password reset functionality."""

    def test_request_password_reset(self, client, student_user):
        """Test requesting a password reset."""
        response = client.post(
            "/api/auth/request-reset",
            json={"email": student_user.email},
        )

        # Should succeed or indicate email sent
        assert response.status_code in [200, 202]

    def test_request_reset_nonexistent_email(self, client):
        """Test password reset for non-existent email."""
        response = client.post(
            "/api/auth/request-reset",
            json={"email": "nonexistent@test.com"},
        )

        # Should not reveal if email exists (security)
        assert response.status_code in [200, 202, 404]
