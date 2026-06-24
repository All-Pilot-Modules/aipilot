"""
Integration tests for auth API routes (/api/auth/*).

Covers: registration, login, email verification, token operations,
        password reset, and role-based access enforcement.
"""
import pytest
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

from app.core.auth import get_password_hash
from app.models.user import User


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _reg_payload(**overrides):
    """Base valid registration payload."""
    base = {
        "username": "newuser",
        "email": "newuser@test.com",
        "password": "SecurePass123!",
        "role": "student",
    }
    base.update(overrides)
    return base


PATCH_SEND_VERIFICATION = "app.api.routes.auth.send_verification_email"
PATCH_SEND_WELCOME = "app.api.routes.auth.send_welcome_email"
PATCH_SEND_RESET = "app.api.routes.auth.send_reset_password_email"


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------

class TestRegistration:

    def test_register_student_success(self, client):
        with patch(PATCH_SEND_VERIFICATION):
            resp = client.post("/api/auth/register", json=_reg_payload())
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == "newuser@test.com"
        assert data["role"] == "student"
        assert data["is_email_verified"] is False

    def test_register_returns_uuid_id(self, client):
        """id must always be a UUID, never an arbitrary string."""
        with patch(PATCH_SEND_VERIFICATION):
            resp = client.post("/api/auth/register", json=_reg_payload())
        import uuid
        user_id = resp.json()["id"]
        uuid.UUID(user_id)  # raises ValueError if not a valid UUID

    def test_register_teacher_gets_can_create_modules(self, client):
        with patch(PATCH_SEND_VERIFICATION):
            resp = client.post(
                "/api/auth/register",
                json=_reg_payload(username="teacher1", email="teacher1@test.com", role="teacher"),
            )
        assert resp.status_code == 200
        assert resp.json()["can_create_modules"] is True

    def test_register_student_cannot_create_modules_by_default(self, client):
        with patch(PATCH_SEND_VERIFICATION):
            resp = client.post("/api/auth/register", json=_reg_payload())
        assert resp.status_code == 200
        assert resp.json()["can_create_modules"] is False

    def test_register_student_can_explicitly_enable_can_create_modules(self, client):
        with patch(PATCH_SEND_VERIFICATION):
            resp = client.post(
                "/api/auth/register",
                json=_reg_payload(can_create_modules=True),
            )
        assert resp.status_code == 200
        assert resp.json()["can_create_modules"] is True

    def test_register_with_banner_id(self, client):
        with patch(PATCH_SEND_VERIFICATION):
            resp = client.post(
                "/api/auth/register",
                json=_reg_payload(banner_id="B12345678"),
            )
        assert resp.status_code == 200
        assert resp.json()["banner_id"] == "B12345678"

    def test_register_duplicate_email_fails(self, client, student_user):
        with patch(PATCH_SEND_VERIFICATION):
            resp = client.post(
                "/api/auth/register",
                json=_reg_payload(email=student_user.email, username="uniqueuser"),
            )
        assert resp.status_code == 400
        assert "email" in resp.json()["detail"].lower()

    def test_register_duplicate_username_fails(self, client, student_user):
        with patch(PATCH_SEND_VERIFICATION):
            resp = client.post(
                "/api/auth/register",
                json=_reg_payload(username=student_user.username, email="unique@test.com"),
            )
        assert resp.status_code == 400
        assert "username" in resp.json()["detail"].lower()

    def test_register_sends_verification_email(self, client):
        with patch(PATCH_SEND_VERIFICATION) as mock_send:
            client.post("/api/auth/register", json=_reg_payload())
        mock_send.assert_called_once()
        call_kwargs = mock_send.call_args
        assert call_kwargs[1]["to_email"] == "newuser@test.com" or call_kwargs[0][0] == "newuser@test.com"


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

class TestLogin:

    def test_login_by_username(self, client, student_user):
        resp = client.post(
            "/api/auth/login",
            json={"identifier": student_user.username, "password": "password123"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert "expires_in" in data

    def test_login_by_email(self, client, student_user):
        resp = client.post(
            "/api/auth/login",
            json={"identifier": student_user.email, "password": "password123"},
        )
        assert resp.status_code == 200
        assert "access_token" in resp.json()

    def test_login_response_contains_user_object(self, client, student_user):
        resp = client.post(
            "/api/auth/login",
            json={"identifier": student_user.email, "password": "password123"},
        )
        user = resp.json()["user"]
        assert user["id"] == student_user.id
        assert user["role"] == "student"
        assert user["email"] == student_user.email
        assert user["username"] == student_user.username

    def test_login_wrong_password(self, client, student_user):
        resp = client.post(
            "/api/auth/login",
            json={"identifier": student_user.email, "password": "wrongpassword"},
        )
        assert resp.status_code == 401

    def test_login_nonexistent_user(self, client):
        resp = client.post(
            "/api/auth/login",
            json={"identifier": "nobody@nowhere.com", "password": "password123"},
        )
        assert resp.status_code == 401

    def test_login_unverified_email_forbidden(self, client, db_session):
        """Unverified users get 403, not 200."""
        unverified = User(
            id="UNVERIFIED001",
            username="unverified",
            email="unverified@test.com",
            hashed_password=get_password_hash("password123"),
            role="student",
            can_create_modules=False,
            is_active=True,
            is_email_verified=False,
        )
        db_session.add(unverified)
        db_session.flush()

        resp = client.post(
            "/api/auth/login",
            json={"identifier": "unverified@test.com", "password": "password123"},
        )
        assert resp.status_code == 403
        assert "verified" in resp.json()["detail"].lower()

    def test_login_inactive_user_rejected(self, client, db_session):
        inactive = User(
            id="INACTIVE001",
            username="inactiveuser",
            email="inactive@test.com",
            hashed_password=get_password_hash("password123"),
            role="student",
            can_create_modules=False,
            is_active=False,
            is_email_verified=True,
        )
        db_session.add(inactive)
        db_session.flush()

        resp = client.post(
            "/api/auth/login",
            json={"identifier": "inactive@test.com", "password": "password123"},
        )
        assert resp.status_code == 400

    def test_teacher_login_role_in_response(self, client, teacher_user):
        resp = client.post(
            "/api/auth/login",
            json={"identifier": teacher_user.email, "password": "password123"},
        )
        assert resp.status_code == 200
        assert resp.json()["user"]["role"] == "teacher"


# ---------------------------------------------------------------------------
# Email Verification
# ---------------------------------------------------------------------------

class TestEmailVerification:

    def _make_unverified_user(self, db_session, *, code="123456", token="validtoken123"):
        from datetime import datetime, timedelta
        user = User(
            id="UNVER002",
            username="unverifyme",
            email="unverifyme@test.com",
            hashed_password=get_password_hash("password123"),
            role="student",
            can_create_modules=False,
            is_active=True,
            is_email_verified=False,
            verification_code=code,
            verification_code_expires=datetime.utcnow() + timedelta(minutes=15),
            verification_token=token,
            verification_token_expires=datetime.utcnow() + timedelta(hours=24),
        )
        db_session.add(user)
        db_session.flush()
        return user

    def test_verify_email_correct_code(self, client, db_session):
        user = self._make_unverified_user(db_session, code="654321")
        with patch(PATCH_SEND_WELCOME):
            resp = client.post(
                "/api/auth/verify-email/code",
                params={"email": user.email, "code": "654321"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert "verified" in data["message"].lower()
        assert data["user"]["is_email_verified"] is True

    def test_verify_email_wrong_code(self, client, db_session):
        user = self._make_unverified_user(db_session, code="111111")
        resp = client.post(
            "/api/auth/verify-email/code",
            params={"email": user.email, "code": "999999"},
        )
        assert resp.status_code == 400

    def test_verify_email_already_verified(self, client, student_user):
        """Already-verified users get a 200 with a helpful message, not an error."""
        resp = client.post(
            "/api/auth/verify-email/code",
            params={"email": student_user.email, "code": "000000"},
        )
        assert resp.status_code == 200
        assert "already" in resp.json()["message"].lower()

    def test_verify_email_expired_code(self, client, db_session):
        expired_user = User(
            id="EXPIRED001",
            username="expiredcode",
            email="expiredcode@test.com",
            hashed_password=get_password_hash("password123"),
            role="student",
            can_create_modules=False,
            is_active=True,
            is_email_verified=False,
            verification_code="123456",
            verification_code_expires=datetime.utcnow() - timedelta(minutes=30),
            verification_token="sometoken",
            verification_token_expires=datetime.utcnow() + timedelta(hours=24),
        )
        db_session.add(expired_user)
        db_session.flush()

        resp = client.post(
            "/api/auth/verify-email/code",
            params={"email": expired_user.email, "code": "123456"},
        )
        assert resp.status_code == 400
        assert "expired" in resp.json()["detail"].lower()

    def test_verify_email_via_magic_link_token(self, client, db_session):
        user = self._make_unverified_user(db_session, token="magictoken999")
        with patch(PATCH_SEND_WELCOME):
            resp = client.get(
                "/api/auth/verify-email/token",
                params={"token": "magictoken999"},
            )
        assert resp.status_code == 200
        assert resp.json()["user"]["is_email_verified"] is True

    def test_verify_email_invalid_token(self, client):
        resp = client.get(
            "/api/auth/verify-email/token",
            params={"token": "nonexistenttoken"},
        )
        assert resp.status_code == 404

    def test_verify_email_expired_token(self, client, db_session):
        expired_user = User(
            id="EXPIRED002",
            username="expiredtoken",
            email="expiredtoken@test.com",
            hashed_password=get_password_hash("password123"),
            role="student",
            can_create_modules=False,
            is_active=True,
            is_email_verified=False,
            verification_code="123456",
            verification_code_expires=datetime.utcnow() + timedelta(minutes=15),
            verification_token="expiredmagictoken",
            verification_token_expires=datetime.utcnow() - timedelta(hours=1),
        )
        db_session.add(expired_user)
        db_session.flush()

        resp = client.get(
            "/api/auth/verify-email/token",
            params={"token": "expiredmagictoken"},
        )
        assert resp.status_code == 400
        assert "expired" in resp.json()["detail"].lower()

    def test_resend_verification_email(self, client, db_session):
        user = User(
            id="RESEND001",
            username="resendme",
            email="resendme@test.com",
            hashed_password=get_password_hash("password123"),
            role="student",
            can_create_modules=False,
            is_active=True,
            is_email_verified=False,
        )
        db_session.add(user)
        db_session.flush()

        with patch(PATCH_SEND_VERIFICATION) as mock_send:
            resp = client.post(
                "/api/auth/verify-email/resend",
                params={"email": user.email},
            )
        assert resp.status_code == 200
        mock_send.assert_called_once()

    def test_resend_verification_already_verified(self, client, student_user):
        resp = client.post(
            "/api/auth/verify-email/resend",
            params={"email": student_user.email},
        )
        assert resp.status_code == 200
        assert "already" in resp.json()["message"].lower()

    def test_resend_verification_nonexistent_user(self, client):
        resp = client.post(
            "/api/auth/verify-email/resend",
            params={"email": "ghost@nowhere.com"},
        )
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Token Operations
# ---------------------------------------------------------------------------

class TestTokenOperations:

    def test_get_me_with_valid_token(self, client, student_user, auth_headers_student):
        resp = client.get("/api/auth/me", headers=auth_headers_student)
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == student_user.id
        assert data["email"] == student_user.email

    def test_get_me_without_token(self, client):
        resp = client.get("/api/auth/me")
        assert resp.status_code in (401, 403)

    def test_get_me_with_invalid_token(self, client):
        resp = client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer this.is.not.a.valid.jwt"},
        )
        assert resp.status_code in (401, 403)

    def test_refresh_token_returns_new_access_token(self, client, student_user):
        login = client.post(
            "/api/auth/login",
            json={"identifier": student_user.email, "password": "password123"},
        )
        refresh_tok = login.json()["refresh_token"]

        resp = client.post("/api/auth/refresh", params={"refresh_token": refresh_tok})
        assert resp.status_code == 200
        assert "access_token" in resp.json()

    def test_refresh_with_access_token_rejected(self, client, student_user):
        """Passing an access token to /refresh must fail (wrong type)."""
        login = client.post(
            "/api/auth/login",
            json={"identifier": student_user.email, "password": "password123"},
        )
        access_tok = login.json()["access_token"]

        resp = client.post("/api/auth/refresh", params={"refresh_token": access_tok})
        assert resp.status_code == 401

    def test_logout_succeeds(self, client, auth_headers_student):
        resp = client.post("/api/auth/logout", headers=auth_headers_student)
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Password Reset
# ---------------------------------------------------------------------------

class TestPasswordReset:

    def _user_with_reset_code(self, db_session, *, uid, username, email, code="555555", token="resettoken1"):
        user = User(
            id=uid,
            username=username,
            email=email,
            hashed_password=get_password_hash("OldPassword1!"),
            role="student",
            can_create_modules=False,
            is_active=True,
            is_email_verified=True,
            reset_code=code,
            reset_code_expires=datetime.utcnow() + timedelta(minutes=15),
            reset_token=token,
            reset_token_expires=datetime.utcnow() + timedelta(minutes=15),
        )
        db_session.add(user)
        db_session.flush()
        return user

    def test_request_reset_existing_email(self, client, student_user):
        with patch(PATCH_SEND_RESET) as mock_send:
            resp = client.post(
                "/api/auth/password-reset/request",
                json={"email": student_user.email},
            )
        assert resp.status_code == 200
        mock_send.assert_called_once()

    def test_request_reset_nonexistent_email_returns_200(self, client):
        """Security: must not reveal whether an email is registered."""
        with patch(PATCH_SEND_RESET):
            resp = client.post(
                "/api/auth/password-reset/request",
                json={"email": "ghost@nowhere.com"},
            )
        assert resp.status_code == 200

    def test_verify_reset_code_valid(self, client, db_session):
        user = self._user_with_reset_code(
            db_session, uid="RESET001", username="resetme1", email="resetme1@test.com", code="777777"
        )
        resp = client.post(
            "/api/auth/password-reset/verify-code",
            json={"email": user.email, "code": "777777"},
        )
        assert resp.status_code == 200
        assert "verified" in resp.json()["message"].lower()

    def test_verify_reset_code_invalid(self, client, db_session):
        user = self._user_with_reset_code(
            db_session, uid="RESET002", username="resetme2", email="resetme2@test.com", code="888888"
        )
        resp = client.post(
            "/api/auth/password-reset/verify-code",
            json={"email": user.email, "code": "000000"},
        )
        assert resp.status_code == 400

    def test_verify_reset_code_expired(self, client, db_session):
        expired = User(
            id="RESET003",
            username="resetme3",
            email="resetme3@test.com",
            hashed_password=get_password_hash("password123"),
            role="student",
            can_create_modules=False,
            is_active=True,
            is_email_verified=True,
            reset_code="999999",
            reset_code_expires=datetime.utcnow() - timedelta(minutes=30),
            reset_token="sometok",
            reset_token_expires=datetime.utcnow() - timedelta(minutes=30),
        )
        db_session.add(expired)
        db_session.flush()

        resp = client.post(
            "/api/auth/password-reset/verify-code",
            json={"email": expired.email, "code": "999999"},
        )
        assert resp.status_code == 400
        assert "expired" in resp.json()["detail"].lower()

    def test_confirm_reset_changes_password(self, client, db_session):
        user = self._user_with_reset_code(
            db_session, uid="RESET004", username="resetme4", email="resetme4@test.com", code="111222"
        )
        resp = client.post(
            "/api/auth/password-reset/confirm",
            json={"email": user.email, "code": "111222", "new_password": "NewSecure99!"},
        )
        assert resp.status_code == 200

        # Old password must no longer work
        login = client.post(
            "/api/auth/login",
            json={"identifier": user.email, "password": "OldPassword1!"},
        )
        assert login.status_code == 401

        # New password must work
        login2 = client.post(
            "/api/auth/login",
            json={"identifier": user.email, "password": "NewSecure99!"},
        )
        assert login2.status_code == 200

    def test_confirm_reset_short_password_rejected(self, client, db_session):
        user = self._user_with_reset_code(
            db_session, uid="RESET005", username="resetme5", email="resetme5@test.com", code="333444"
        )
        resp = client.post(
            "/api/auth/password-reset/confirm",
            json={"email": user.email, "code": "333444", "new_password": "abc"},
        )
        assert resp.status_code == 400

    def test_verify_reset_token_valid(self, client, db_session):
        user = self._user_with_reset_code(
            db_session,
            uid="RESET006",
            username="resetme6",
            email="resetme6@test.com",
            token="goodresettoken",
        )
        resp = client.get(
            "/api/auth/password-reset/verify-token",
            params={"token": "goodresettoken"},
        )
        assert resp.status_code == 200
        assert resp.json()["email"] == user.email

    def test_verify_reset_token_invalid(self, client):
        resp = client.get(
            "/api/auth/password-reset/verify-token",
            params={"token": "completelyinvalidtoken"},
        )
        assert resp.status_code == 404

    def test_verify_reset_token_expired(self, client, db_session):
        expired = User(
            id="RESET007",
            username="resetme7",
            email="resetme7@test.com",
            hashed_password=get_password_hash("password123"),
            role="student",
            can_create_modules=False,
            is_active=True,
            is_email_verified=True,
            reset_code="123456",
            reset_code_expires=datetime.utcnow() - timedelta(minutes=30),
            reset_token="expiredreset",
            reset_token_expires=datetime.utcnow() - timedelta(minutes=30),
        )
        db_session.add(expired)
        db_session.flush()

        resp = client.get(
            "/api/auth/password-reset/verify-token",
            params={"token": "expiredreset"},
        )
        assert resp.status_code == 400
        assert "expired" in resp.json()["detail"].lower()


# ---------------------------------------------------------------------------
# Role-based access
# ---------------------------------------------------------------------------

class TestRoleBasedAccess:

    def test_unauthenticated_cannot_access_me(self, client):
        resp = client.get("/api/auth/me")
        assert resp.status_code in (401, 403)

    def test_student_cannot_access_pending_claims(self, client, auth_headers_student):
        resp = client.get("/api/claims/pending", headers=auth_headers_student)
        assert resp.status_code in (401, 403)

    def test_teacher_can_access_pending_claims(self, client, auth_headers_teacher):
        resp = client.get("/api/claims/pending", headers=auth_headers_teacher)
        # 200 (empty list) or 404 if route moved — but never 401/403
        assert resp.status_code not in (401, 403)

    def test_student_token_has_student_role(self, client, student_user):
        import jwt as pyjwt
        from app.core.auth import SECRET_KEY, ALGORITHM
        login = client.post(
            "/api/auth/login",
            json={"identifier": student_user.email, "password": "password123"},
        )
        token = login.json()["access_token"]
        decoded = pyjwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert decoded["role"] == "student"

    def test_teacher_token_has_teacher_role(self, client, teacher_user):
        import jwt as pyjwt
        from app.core.auth import SECRET_KEY, ALGORITHM
        login = client.post(
            "/api/auth/login",
            json={"identifier": teacher_user.email, "password": "password123"},
        )
        token = login.json()["access_token"]
        decoded = pyjwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert decoded["role"] == "teacher"
