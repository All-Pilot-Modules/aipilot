import uuid
from datetime import timedelta, datetime
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from app.schemas.user import (
    UserLogin,
    Token,
    UserCreate,
    UserOut,
    PasswordResetRequest,
    PasswordResetVerify,
    PasswordResetConfirm
)
from app.core.auth import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    get_current_active_user,
    verify_token,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_DAYS
)
from app.core.email import (
    send_verification_email,
    send_welcome_email,
    send_reset_password_email,
    generate_verification_code,
    generate_verification_token,
    get_verification_code_expiry,
    get_verification_token_expiry,
    get_reset_code_expiry,
    get_reset_token_expiry
)
from app.database import get_db
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=UserOut)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user and send verification email."""
    # Check email uniqueness
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    # Check username uniqueness
    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(status_code=400, detail="This username is already taken")

    # Hash the password
    hashed_password = get_password_hash(user_data.password)

    # Generate verification code and token
    verification_code = generate_verification_code()
    verification_token = generate_verification_token()

    # Create user with email verification fields
    db_user = User(
        id=user_data.id or str(uuid.uuid4()),
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password,
        profile_image=user_data.profile_image,
        role=user_data.role or "student",  # Default role
        is_email_verified=False,
        verification_code=verification_code,
        verification_code_expires=get_verification_code_expiry(),
        verification_token=verification_token,
        verification_token_expires=get_verification_token_expiry()
    )

    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    # Send verification email
    if user_data.email:
        send_verification_email(
            to_email=user_data.email,
            username=user_data.username,
            code=verification_code,
            token=verification_token
        )

    return db_user

@router.post("/login", response_model=Token)
def login(user_data: UserLogin, db: Session = Depends(get_db)):
    """Authenticate user and return access token."""
    # Find user by username or email
    user = db.query(User).filter(
        (User.username == user_data.identifier) |
        (User.email == user_data.identifier)
    ).first()

    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )

    # Check email verification status
    if not user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Please verify your email before logging in."
        )
    
    # Create access token and refresh token with user role and additional claims
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "sub": user.id,
            "role": user.role,
            "email": user.email,
            "username": user.username
        },
        expires_delta=access_token_expires
    )

    # Create refresh token (longer expiration)
    refresh_token_expires = timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    refresh_token = create_refresh_token(
        data={"sub": user.id},
        expires_delta=refresh_token_expires
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,  # seconds
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "profile_image": user.profile_image,
            "is_email_verified": user.is_email_verified,
            "is_active": user.is_active,
            "created_at": user.created_at,
            "updated_at": user.updated_at
        }
    }

@router.get("/me", response_model=UserOut)
def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    """Get current authenticated user information."""
    return current_user

@router.post("/refresh")
def refresh_token(refresh_token: str, db: Session = Depends(get_db)):
    """Refresh access token using refresh token."""
    try:
        # Verify refresh token
        payload = verify_token(refresh_token)
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )

        # Check if it's actually a refresh token
        # Note: verify_token returns TokenData which doesn't have 'type' by default
        # We need to decode the token again to check type
        import jwt as pyjwt
        from app.core.auth import SECRET_KEY, ALGORITHM
        decoded = pyjwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])

        if decoded.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type"
            )

        # Get user from database
        user = db.query(User).filter(User.id == payload.user_id).first()
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive"
            )

        # Create new access token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        new_access_token = create_access_token(
            data={
                "sub": user.id,
                "role": user.role,
                "email": user.email,
                "username": user.username
            },
            expires_delta=access_token_expires
        )

        return {
            "access_token": new_access_token,
            "token_type": "bearer",
            "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not refresh token"
        )

@router.post("/logout")
def logout():
    """Logout user (client-side token removal)."""
    return {"message": "Successfully logged out"}


@router.post("/verify-email/code")
def verify_email_with_code(email: str, code: str, db: Session = Depends(get_db)):
    """Verify user email using 6-digit code."""
    # Find user by email
    user = db.query(User).filter(User.email == email).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Check if already verified
    if user.is_email_verified:
        return {"message": "Email already verified"}

    # Check if code matches
    if user.verification_code != code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code"
        )

    # Check if code has expired
    if user.verification_code_expires and user.verification_code_expires < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired. Please request a new one."
        )

    # Mark email as verified
    user.is_email_verified = True
    user.verification_code = None
    user.verification_code_expires = None
    user.verification_token = None
    user.verification_token_expires = None

    db.commit()

    # Send welcome email
    send_welcome_email(user.email, user.username)

    return {
        "message": "Email verified successfully",
        "user": {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "is_email_verified": user.is_email_verified
        }
    }


@router.get("/verify-email/token")
def verify_email_with_token(token: str, db: Session = Depends(get_db)):
    """Verify user email using magic link token."""
    # Find user by verification token
    user = db.query(User).filter(User.verification_token == token).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid verification link"
        )

    # Check if already verified
    if user.is_email_verified:
        return {"message": "Email already verified", "redirect": "/login"}

    # Check if token has expired
    if user.verification_token_expires and user.verification_token_expires < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification link has expired. Please request a new one."
        )

    # Mark email as verified
    user.is_email_verified = True
    user.verification_code = None
    user.verification_code_expires = None
    user.verification_token = None
    user.verification_token_expires = None

    db.commit()

    # Send welcome email
    send_welcome_email(user.email, user.username)

    return {
        "message": "Email verified successfully",
        "redirect": "/login",
        "user": {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "is_email_verified": user.is_email_verified
        }
    }


@router.post("/verify-email/resend")
def resend_verification_email(email: str, db: Session = Depends(get_db)):
    """Resend verification email with new code and token."""
    # Find user by email
    user = db.query(User).filter(User.email == email).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Check if already verified
    if user.is_email_verified:
        return {"message": "Email already verified"}

    # Generate new verification code and token
    verification_code = generate_verification_code()
    verification_token = generate_verification_token()

    # Update user with new verification data
    user.verification_code = verification_code
    user.verification_code_expires = get_verification_code_expiry()
    user.verification_token = verification_token
    user.verification_token_expires = get_verification_token_expiry()

    db.commit()

    # Send verification email
    send_verification_email(
        to_email=user.email,
        username=user.username,
        code=verification_code,
        token=verification_token
    )

    return {
        "message": "Verification email sent successfully",
        "email": user.email
    }


@router.post("/password-reset/request")
def request_password_reset(request: PasswordResetRequest, db: Session = Depends(get_db)):
    """
    Request password reset by email. Sends reset code and magic link.
    Returns success even if email doesn't exist (security best practice).
    """
    # Find user by email
    user = db.query(User).filter(User.email == request.email).first()

    # Always return success (don't reveal if email exists)
    if not user:
        return {
            "message": "If an account exists with this email, you will receive a password reset link.",
            "email": request.email
        }

    # Generate reset code and token
    reset_code = generate_verification_code()  # Reuse existing function (6 digits)
    reset_token = generate_verification_token()  # Reuse existing function

    # Update user with reset data
    user.reset_code = reset_code
    user.reset_code_expires = get_reset_code_expiry()  # 15 minutes
    user.reset_token = reset_token
    user.reset_token_expires = get_reset_token_expiry()  # 15 minutes

    db.commit()

    # Send reset email
    send_reset_password_email(
        to_email=user.email,
        username=user.username,
        code=reset_code,
        token=reset_token
    )

    return {
        "message": "If an account exists with this email, you will receive a password reset link.",
        "email": request.email
    }


@router.post("/password-reset/verify-code")
def verify_reset_code(request: PasswordResetVerify, db: Session = Depends(get_db)):
    """
    Verify that the reset code is valid without resetting password.
    This allows the frontend to show the new password form.
    """
    user = db.query(User).filter(User.email == request.email).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Check if code matches
    if user.reset_code != request.code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset code"
        )

    # Check if code has expired
    if user.reset_code_expires and user.reset_code_expires < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset code has expired. Please request a new one."
        )

    return {
        "message": "Code verified successfully",
        "email": user.email
    }


@router.post("/password-reset/confirm")
def reset_password_with_code(request: PasswordResetConfirm, db: Session = Depends(get_db)):
    """
    Reset password using verified code and new password.
    """
    user = db.query(User).filter(User.email == request.email).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Check if code matches
    if user.reset_code != request.code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset code"
        )

    # Check if code has expired
    if user.reset_code_expires and user.reset_code_expires < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset code has expired. Please request a new one."
        )

    # Validate new password
    if len(request.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long"
        )

    # Update password
    user.hashed_password = get_password_hash(request.new_password)

    # Clear reset fields
    user.reset_code = None
    user.reset_code_expires = None
    user.reset_token = None
    user.reset_token_expires = None

    db.commit()

    return {
        "message": "Password reset successfully. You can now login with your new password.",
        "user": {
            "id": user.id,
            "email": user.email,
            "username": user.username
        }
    }


@router.get("/password-reset/verify-token")
def verify_reset_token(token: str, db: Session = Depends(get_db)):
    """
    Verify reset token from magic link.
    Returns user email if valid, for the frontend to show password reset form.
    """
    user = db.query(User).filter(User.reset_token == token).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid reset link"
        )

    # Check if token has expired
    if user.reset_token_expires and user.reset_token_expires < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset link has expired. Please request a new one."
        )

    return {
        "message": "Reset link is valid",
        "email": user.email,
        "code": user.reset_code  # Return code so frontend can use it for password reset
    }