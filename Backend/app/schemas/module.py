from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional, Dict, Any, List

from app.models.module import (
    DEFAULT_AI_CONFIG,
    DEFAULT_AI_SAFETY_CONFIG,
    DEFAULT_ENROLLMENT_CONFIG,
    DEFAULT_ASSIGNMENT_CONFIG,
)


class ModuleBase(BaseModel):
    teacher_id: str
    name: str
    description: Optional[str] = None
    slug: Optional[str] = None
    thumbnail_url: Optional[str] = None
    instructions: Optional[str] = None

    # Type & lifecycle
    module_type: Optional[str] = "learn"          # "learn" | "quiz" | "reflection" | "tech"
    status: Optional[str] = "draft"               # "draft" | "published" | "archived"
    is_active: Optional[bool] = True
    is_template: Optional[bool] = False
    due_date: Optional[datetime] = None

    # Visibility & enrollment
    visibility: Optional[str] = "class-only"      # "class-only" | "public"
    enrollment_type: Optional[str] = "code_required"  # "open" | "invite_only" | "code_required"
    enrollment_config: Optional[Dict[str, Any]] = DEFAULT_ENROLLMENT_CONFIG

    # AI
    ai_grading_mode: Optional[str] = "auto"    # "auto" | "teacher_assist" | "teacher_only" | "disabled"
    ai_config: Optional[Dict[str, Any]] = DEFAULT_AI_CONFIG
    ai_safety_config: Optional[Dict[str, Any]] = DEFAULT_AI_SAFETY_CONFIG

    # Grading & assignment
    feedback_rubric: Optional[Dict[str, Any]] = None
    assignment_config: Optional[Dict[str, Any]] = DEFAULT_ASSIGNMENT_CONFIG

    # Research consent
    consent_form_text: Optional[str] = None
    consent_required: Optional[bool] = True

    # Survey
    survey_required: Optional[bool] = False


class ModuleCreate(ModuleBase):
    pass


class ModuleOut(ModuleBase):
    id: UUID
    access_code: str
    created_at: datetime
    consent_form_text: Optional[str] = None
    feedback_rubric: Optional[Dict[str, Any]] = None
    assignment_config: Optional[Dict[str, Any]] = None
    ai_config: Optional[Dict[str, Any]] = None
    ai_safety_config: Optional[Dict[str, Any]] = None
    enrollment_config: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class ConsentFormUpdate(BaseModel):
    consent_form_text: str = ""
    consent_required: bool = True


class ModuleStatusUpdate(BaseModel):
    status: str   # "draft" | "published" | "archived"


class AIConfigUpdate(BaseModel):
    ai_grading_mode: Optional[str] = None
    ai_config: Optional[Dict[str, Any]] = None
    ai_safety_config: Optional[Dict[str, Any]] = None


class GradingSettingsUpdate(BaseModel):
    """
    Dedicated payload for updating teacher grading preferences on a module.

    mode choices:
      "auto"           – AI grades and result is shown to student immediately
      "teacher_assist" – AI surfaces a suggested grade/explanation to teacher only;
                         teacher reviews and approves before anything reaches the student
      "teacher_only"   – AI grades automatically but result is hidden from student;
                         teacher can see and optionally release grades manually
      "disabled"       – AI grading is off; teacher grades entirely on their own
    """
    mode: Optional[str] = None                         # one of the four values above
    show_score_to_student: Optional[bool] = None
    show_explanation_to_student: Optional[bool] = None
    show_hints_to_student: Optional[bool] = None
    teacher_sees_ai_suggestions: Optional[bool] = None
    require_teacher_approval: Optional[bool] = None    # gate: teacher must approve before student sees
    model: Optional[str] = None                        # AI model used for grading


class EnrollmentConfigUpdate(BaseModel):
    enrollment_type: Optional[str] = None
    enrollment_config: Optional[Dict[str, Any]] = None
