from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional


class ModuleBatchBase(BaseModel):
    name: str
    description: Optional[str] = None
    instructions: Optional[str] = None
    batch_type: Optional[str] = "practice"   # "practice" | "quiz" | "exam" | "review"
    batch_order: Optional[int] = 1
    status: Optional[str] = "draft"          # "draft" | "active" | "locked"
    ai_grading_mode: Optional[str] = None    # None = inherit from module
    max_attempts: Optional[int] = None       # None = inherit from module
    show_feedback_after_each: Optional[bool] = None
    due_date: Optional[datetime] = None
    unlock_after_batch_id: Optional[UUID] = None


class ModuleBatchCreate(ModuleBatchBase):
    pass


class ModuleBatchUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    instructions: Optional[str] = None
    batch_type: Optional[str] = None
    batch_order: Optional[int] = None
    status: Optional[str] = None
    ai_grading_mode: Optional[str] = None
    max_attempts: Optional[int] = None
    show_feedback_after_each: Optional[bool] = None
    due_date: Optional[datetime] = None
    unlock_after_batch_id: Optional[UUID] = None


class ModuleBatchOut(ModuleBatchBase):
    id: UUID
    module_id: UUID
    created_at: datetime

    class Config:
        orm_mode = True


class BatchStatusUpdate(BaseModel):
    status: str   # "draft" | "active" | "locked"


class AssignQuestionsPayload(BaseModel):
    question_ids: list[UUID]
