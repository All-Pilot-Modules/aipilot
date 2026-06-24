from sqlalchemy import Column, String, Boolean, TIMESTAMP
from app.database import Base
from datetime import datetime
import uuid as uuid_lib

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid_lib.uuid4()))
    banner_id = Column(String, nullable=True, index=True)   # institutional ID, display only
    can_create_modules = Column(Boolean, default=False)
    username = Column(String, unique=True, index=True, nullable=True)
    email = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String, nullable=False)
    profile_image = Column(String, nullable=True)
    role = Column(String, nullable=False)  # student | teacher | admin

    is_email_verified = Column(Boolean, default=False)
    verification_code = Column(String, nullable=True)
    verification_code_expires = Column(TIMESTAMP, nullable=True)
    verification_token = Column(String, nullable=True)
    verification_token_expires = Column(TIMESTAMP, nullable=True)

    reset_code = Column(String, nullable=True)
    reset_code_expires = Column(TIMESTAMP, nullable=True)
    reset_token = Column(String, nullable=True)
    reset_token_expires = Column(TIMESTAMP, nullable=True)

    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = Column(TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)
