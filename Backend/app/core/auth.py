from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID
import jwt
from jwt import PyJWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, Query, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.schemas.user import TokenData
from app.core.config import JWT_SECRET

# Password hashing
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__default_rounds=12,
    bcrypt__min_rounds=4,
    bcrypt__max_rounds=31
)

# JWT settings
if not JWT_SECRET:
    raise ValueError("JWT_SECRET environment variable is not set")
SECRET_KEY = JWT_SECRET
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7  # Refresh token valid for 7 days

# HTTP Bearer token scheme
security = HTTPBearer()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against its hash."""
    # Truncate password to 72 bytes for bcrypt compatibility
    if len(plain_password.encode('utf-8')) > 72:
        plain_password = plain_password.encode('utf-8')[:72].decode('utf-8', errors='ignore')
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hash a password."""
    # Truncate password to 72 bytes for bcrypt compatibility
    if len(password.encode('utf-8')) > 72:
        password = password.encode('utf-8')[:72].decode('utf-8', errors='ignore')
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create a JWT refresh token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> Optional[TokenData]:
    """Verify and decode a JWT token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
        token_data = TokenData(user_id=user_id)
        return token_data
    except PyJWTError:
        return None

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Get the current authenticated user."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    token_data = verify_token(credentials.credentials)
    if token_data is None:
        raise credentials_exception
    
    user = db.query(User).filter(User.id == token_data.user_id).first()
    if user is None:
        raise credentials_exception
    
    return user

def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Get the current authenticated and active user."""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

def require_role(required_role: str):
    """Dependency factory for role-based access control."""
    def role_checker(current_user: User = Depends(get_current_active_user)) -> User:
        if current_user.role != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Operation not permitted for this role"
            )
        return current_user
    return role_checker

def require_roles(required_roles: list):
    """Dependency factory for multiple role-based access control."""
    def role_checker(current_user: User = Depends(get_current_active_user)) -> User:
        if current_user.role not in required_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Operation not permitted for this role"
            )
        return current_user
    return role_checker


# ---------------------------------------------------------------------------
# Student sessions
#
# Students don't have a `users` row (no password, no account) — they join a
# module with a shared access code plus a self-reported banner ID, and every
# student-facing route used to just trust whatever student_id showed up in
# the query string. Anyone who knew (or guessed) a classmate's banner ID and
# the module's access code — which the whole class shares, not a secret per
# student — could read or submit as them.
#
# join_module_with_code now issues one of these tokens after enrollment, and
# every student route should derive identity from it instead of the
# query/body-supplied student_id (that field still exists in request
# payloads for backward compatibility but must never be trusted).
# ---------------------------------------------------------------------------

STUDENT_TOKEN_EXPIRE_HOURS = 12  # covers a full exam session with margin


class StudentIdentity:
    """Verified student identity derived from a signed session token."""
    def __init__(self, student_id: str, module_id: str):
        self.student_id = student_id
        self.module_id = module_id


def create_student_token(student_id: str, module_id) -> str:
    """Issue a short-lived, module-scoped student session token after enrollment."""
    return create_access_token(
        data={"sub": student_id, "module_id": str(module_id), "role": "student"},
        expires_delta=timedelta(hours=STUDENT_TOKEN_EXPIRE_HOURS),
    )


def _decode_student_token(token: str) -> StudentIdentity:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing student session — please rejoin the module",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except PyJWTError:
        raise credentials_exception

    if payload.get("role") != "student":
        raise credentials_exception

    student_id = payload.get("sub")
    module_id = payload.get("module_id")
    if not student_id or not module_id:
        raise credentials_exception

    return StudentIdentity(student_id=student_id, module_id=module_id)


def get_current_student(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> StudentIdentity:
    """Derive student identity from a signed session token — never trust a client-supplied student_id."""
    return _decode_student_token(credentials.credentials)


def get_current_student_from_query_token(
    token: str = Query(..., description="Student session token"),
) -> StudentIdentity:
    """
    Same as get_current_student, but reads the token from a query param
    instead of the Authorization header — for the SSE endpoint, whose
    browser EventSource client cannot send custom headers at all.
    """
    return _decode_student_token(token)


def get_current_student_for_module(
    module_id: UUID,
    identity: StudentIdentity = Depends(get_current_student),
) -> str:
    """
    Use on any route whose path already scopes to {module_id} — FastAPI
    resolves this dependency's module_id parameter from the enclosing
    route's path param of the same name. Verifies the token's module_id
    claim matches the path (so a valid session for Module A can't read or
    write Module B), then returns the verified student_id.
    """
    if str(identity.module_id) != str(module_id):
        raise HTTPException(status_code=403, detail="Session not valid for this module")
    return identity.student_id


def get_current_student_for_module_from_query_token(
    module_id: UUID,
    identity: StudentIdentity = Depends(get_current_student_from_query_token),
) -> str:
    """Query-token variant of get_current_student_for_module, for the SSE endpoint."""
    if str(identity.module_id) != str(module_id):
        raise HTTPException(status_code=403, detail="Session not valid for this module")
    return identity.student_id


def get_current_student_id(identity: StudentIdentity = Depends(get_current_student)) -> str:
    """
    Use on routes with no module_id path param to match against (so
    get_current_student_for_module doesn't apply) that only need the bare
    student_id string — typically because the query/model they filter by is
    already scoped to student_id directly, making it safe by construction
    once that value comes from a verified token instead of client input.
    """
    return identity.student_id