from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    profile_image: Optional[str] = None
    role: Optional[str] = None

class UserCreate(UserBase):
    username: str
    email: str
    password: str
    banner_id: Optional[str] = None           # institutional ID (optional)
    can_create_modules: Optional[bool] = None  # defaults by role if not set

class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    profile_image: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    banner_id: Optional[str] = None
    can_create_modules: Optional[bool] = None

class UserOut(UserBase):
    id: str
    banner_id: Optional[str] = None
    can_create_modules: bool
    created_at: datetime
    updated_at: datetime
    is_active: bool
    is_email_verified: bool

    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    identifier: str  # email or username
    password: str

class Token(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    expires_in: Optional[int] = None
    user: Optional[dict] = None

class TokenData(BaseModel):
    user_id: Optional[str] = None

class PasswordResetRequest(BaseModel):
    email: str

class PasswordResetVerify(BaseModel):
    email: str
    code: str

class PasswordResetConfirm(BaseModel):
    email: str
    code: str
    new_password: str
