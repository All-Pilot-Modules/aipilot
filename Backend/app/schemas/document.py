from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID

class DocumentBase(BaseModel):
    title: str
    file_name: str
    file_hash: str  # SHA256 hash for duplicate detection
    file_type: str
    teacher_id: str
    module_id: UUID  # ✅ Changed from module_name to module_id
    storage_path: str
    index_path: Optional[str] = None
    slide_count: Optional[int] = None

class DocumentCreate(DocumentBase):
    processing_status: Optional[str] = "uploaded"
    processing_metadata: Optional[Dict[str, Any]] = {}
    parse_status: Optional[str] = None
    parse_error: Optional[str] = None
    is_testbank: Optional[bool] = False

class DocumentOut(DocumentBase):
    id: UUID
    uploaded_at: datetime
    processing_status: str
    processing_metadata: Dict[str, Any]
    parse_status: Optional[str] = None
    parse_error: Optional[str] = None
    is_testbank: bool

    class Config:
        orm_mode = True

class DocumentUpdate(BaseModel):
    # Storage keys, ownership, hashes and processing state are server-managed.
    model_config = {"extra": "forbid"}
    title: str = Field(min_length=1, max_length=255)
