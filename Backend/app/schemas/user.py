from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    profile_image: Optional[str] = None
    role: Optional[str] = None  # ✅ Now optional

class UserCreate(UserBase):
    id: Optional[str] = None  # Auto-generated if not provided
    username: str  # Required
    email: str     # Required
    password: str  # Required password for registration

class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    profile_image: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None

class UserOut(UserBase):
    id: str
    created_at: datetime
    updated_at: datetime
    is_active: bool
    is_email_verified: bool

    class Config:
        from_attributes = True

# Auth-specific schemas
class UserLogin(BaseModel):
    identifier: str  # Can be Banner ID or email
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    user_id: Optional[str] = None

# Password Reset schemas
class PasswordResetRequest(BaseModel):
    email: str

class PasswordResetVerify(BaseModel):
    email: str
    code: str

class PasswordResetConfirm(BaseModel):
    email: str
    code: str
    new_password: str