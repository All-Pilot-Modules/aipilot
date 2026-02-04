"""
Unit tests for core/auth.py - Authentication and authorization.
Tests: JWT creation/verification, password hashing, role checks.
"""
import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch
import jwt


class TestPasswordHashing:
    """Tests for password hashing functions."""

    def test_hash_password_returns_hash(self):
        """Test that password hashing returns a hash."""
        from app.core.auth import get_password_hash

        password = "TestPassword123!"
        hashed = get_password_hash(password)

        assert hashed is not None
        assert hashed != password
        assert len(hashed) > 20

    def test_hash_password_different_for_same_input(self):
        """Test that same password produces different hashes (salting)."""
        from app.core.auth import get_password_hash

        password = "TestPassword123!"
        hash1 = get_password_hash(password)
        hash2 = get_password_hash(password)

        # Bcrypt adds salt, so hashes should differ
        assert hash1 != hash2

    def test_verify_password_correct(self):
        """Test password verification with correct password."""
        from app.core.auth import get_password_hash, verify_password

        password = "TestPassword123!"
        hashed = get_password_hash(password)

        assert verify_password(password, hashed) is True

    def test_verify_password_incorrect(self):
        """Test password verification with wrong password."""
        from app.core.auth import get_password_hash, verify_password

        password = "TestPassword123!"
        hashed = get_password_hash(password)

        assert verify_password("WrongPassword", hashed) is False

    def test_verify_password_empty(self):
        """Test password verification with empty password."""
        from app.core.auth import get_password_hash, verify_password

        password = "TestPassword123!"
        hashed = get_password_hash(password)

        assert verify_password("", hashed) is False

    def test_hash_password_truncates_long_password(self):
        """Test that very long passwords are handled (bcrypt 72-byte limit)."""
        from app.core.auth import get_password_hash, verify_password

        # Password longer than 72 bytes
        long_password = "A" * 100
        hashed = get_password_hash(long_password)

        # Should still verify (after truncation)
        assert verify_password(long_password, hashed) is True

    def test_hash_special_characters(self):
        """Test hashing passwords with special characters."""
        from app.core.auth import get_password_hash, verify_password

        password = "P@$$w0rd!#$%^&*()"
        hashed = get_password_hash(password)

        assert verify_password(password, hashed) is True

    def test_hash_unicode_characters(self):
        """Test hashing passwords with Unicode characters."""
        from app.core.auth import get_password_hash, verify_password

        password = "Pässwörd123日本語"
        hashed = get_password_hash(password)

        assert verify_password(password, hashed) is True


class TestJWTTokens:
    """Tests for JWT token creation and verification."""

    def test_create_access_token(self):
        """Test creating an access token."""
        from app.core.auth import create_access_token

        token = create_access_token(data={"sub": "user123"})

        assert token is not None
        assert isinstance(token, str)
        assert len(token) > 50

    def test_create_access_token_with_expiry(self):
        """Test creating an access token with custom expiry."""
        from app.core.auth import create_access_token

        expires = timedelta(minutes=60)
        token = create_access_token(data={"sub": "user123"}, expires_delta=expires)

        assert token is not None

    def test_access_token_contains_user_id(self):
        """Test that access token contains user ID in payload."""
        from app.core.auth import create_access_token, verify_token

        user_id = "USR001"
        token = create_access_token(data={"sub": user_id})

        token_data = verify_token(token)

        assert token_data is not None
        assert token_data.user_id == user_id

    def test_access_token_type_marker(self):
        """Test that access token has 'access' type marker."""
        from app.core.auth import create_access_token, SECRET_KEY, ALGORITHM

        token = create_access_token(data={"sub": "user123"})
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        assert payload.get("type") == "access"

    def test_create_refresh_token(self):
        """Test creating a refresh token."""
        from app.core.auth import create_refresh_token

        token = create_refresh_token(data={"sub": "user123"})

        assert token is not None
        assert isinstance(token, str)

    def test_refresh_token_type_marker(self):
        """Test that refresh token has 'refresh' type marker."""
        from app.core.auth import create_refresh_token, SECRET_KEY, ALGORITHM

        token = create_refresh_token(data={"sub": "user123"})
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        assert payload.get("type") == "refresh"

    def test_refresh_token_longer_expiry(self):
        """Test refresh token has longer expiry than access token."""
        from app.core.auth import (
            create_access_token, create_refresh_token,
            SECRET_KEY, ALGORITHM
        )

        access = create_access_token(data={"sub": "user123"})
        refresh = create_refresh_token(data={"sub": "user123"})

        access_payload = jwt.decode(access, SECRET_KEY, algorithms=[ALGORITHM])
        refresh_payload = jwt.decode(refresh, SECRET_KEY, algorithms=[ALGORITHM])

        assert refresh_payload["exp"] > access_payload["exp"]


class TestTokenVerification:
    """Tests for token verification."""

    def test_verify_valid_token(self):
        """Test verifying a valid token."""
        from app.core.auth import create_access_token, verify_token

        token = create_access_token(data={"sub": "user123"})
        result = verify_token(token)

        assert result is not None
        assert result.user_id == "user123"

    def test_verify_expired_token(self):
        """Test verifying an expired token."""
        from app.core.auth import create_access_token, verify_token

        # Create token that expires immediately
        token = create_access_token(
            data={"sub": "user123"},
            expires_delta=timedelta(seconds=-1)  # Already expired
        )

        result = verify_token(token)

        assert result is None

    def test_verify_invalid_token(self):
        """Test verifying an invalid token string."""
        from app.core.auth import verify_token

        result = verify_token("invalid.token.string")

        assert result is None

    def test_verify_tampered_token(self):
        """Test verifying a tampered token."""
        from app.core.auth import create_access_token, verify_token

        token = create_access_token(data={"sub": "user123"})
        # Tamper with the token
        tampered = token[:-5] + "XXXXX"

        result = verify_token(tampered)

        assert result is None

    def test_verify_token_missing_sub(self):
        """Test verifying token without 'sub' claim."""
        from app.core.auth import verify_token, SECRET_KEY, ALGORITHM

        # Create token without 'sub'
        payload = {"exp": datetime.now(timezone.utc) + timedelta(hours=1)}
        token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

        result = verify_token(token)

        assert result is None


class TestGetCurrentUser:
    """Tests for get_current_user dependency."""

    @pytest.fixture
    def mock_db(self):
        """Create a mock database session."""
        return MagicMock()

    @pytest.fixture
    def mock_credentials(self):
        """Create mock HTTP credentials."""
        from app.core.auth import create_access_token

        token = create_access_token(data={"sub": "USER001"})
        creds = MagicMock()
        creds.credentials = token
        return creds

    def test_get_current_user_valid_token(self, mock_db, mock_credentials):
        """Test getting current user with valid token."""
        from app.core.auth import get_current_user
        from app.models.user import User

        # Mock user in database
        mock_user = MagicMock(spec=User)
        mock_user.id = "USER001"
        mock_user.is_active = True
        mock_db.query.return_value.filter.return_value.first.return_value = mock_user

        result = get_current_user(mock_credentials, mock_db)

        assert result.id == "USER001"

    def test_get_current_user_invalid_token(self, mock_db):
        """Test getting current user with invalid token."""
        from app.core.auth import get_current_user
        from fastapi import HTTPException

        creds = MagicMock()
        creds.credentials = "invalid.token"

        with pytest.raises(HTTPException) as exc_info:
            get_current_user(creds, mock_db)

        assert exc_info.value.status_code == 401

    def test_get_current_user_user_not_found(self, mock_db, mock_credentials):
        """Test getting current user when user doesn't exist."""
        from app.core.auth import get_current_user
        from fastapi import HTTPException

        mock_db.query.return_value.filter.return_value.first.return_value = None

        with pytest.raises(HTTPException) as exc_info:
            get_current_user(mock_credentials, mock_db)

        assert exc_info.value.status_code == 401


class TestGetCurrentActiveUser:
    """Tests for get_current_active_user dependency."""

    def test_active_user_passes(self):
        """Test that active user passes validation."""
        from app.core.auth import get_current_active_user

        mock_user = MagicMock()
        mock_user.is_active = True

        result = get_current_active_user(mock_user)

        assert result == mock_user

    def test_inactive_user_fails(self):
        """Test that inactive user fails validation."""
        from app.core.auth import get_current_active_user
        from fastapi import HTTPException

        mock_user = MagicMock()
        mock_user.is_active = False

        with pytest.raises(HTTPException) as exc_info:
            get_current_active_user(mock_user)

        assert exc_info.value.status_code == 400


class TestRoleBasedAccess:
    """Tests for role-based access control."""

    def test_require_role_correct_role(self):
        """Test require_role passes for correct role."""
        from app.core.auth import require_role

        mock_user = MagicMock()
        mock_user.role = "teacher"
        mock_user.is_active = True

        checker = require_role("teacher")

        # Simulate dependency injection
        with patch("app.core.auth.get_current_active_user", return_value=mock_user):
            result = checker(mock_user)
            assert result == mock_user

    def test_require_role_wrong_role(self):
        """Test require_role fails for wrong role."""
        from app.core.auth import require_role
        from fastapi import HTTPException

        mock_user = MagicMock()
        mock_user.role = "student"
        mock_user.is_active = True

        checker = require_role("teacher")

        with pytest.raises(HTTPException) as exc_info:
            checker(mock_user)

        assert exc_info.value.status_code == 403

    def test_require_roles_one_of_many(self):
        """Test require_roles passes for one of multiple allowed roles."""
        from app.core.auth import require_roles

        mock_user = MagicMock()
        mock_user.role = "admin"
        mock_user.is_active = True

        checker = require_roles(["teacher", "admin"])

        result = checker(mock_user)
        assert result == mock_user

    def test_require_roles_none_match(self):
        """Test require_roles fails when no roles match."""
        from app.core.auth import require_roles
        from fastapi import HTTPException

        mock_user = MagicMock()
        mock_user.role = "student"
        mock_user.is_active = True

        checker = require_roles(["teacher", "admin"])

        with pytest.raises(HTTPException) as exc_info:
            checker(mock_user)

        assert exc_info.value.status_code == 403
