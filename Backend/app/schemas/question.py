from pydantic import BaseModel, Field, validator, model_validator
from typing import Optional, Dict, List, Any, Union
from uuid import UUID
from datetime import datetime

# Extended Config Schemas for New Question Types

class BlankConfig(BaseModel):
    """Configuration for a single blank in fill_blank questions"""
    position: int = Field(..., description="Position of blank in text (0-indexed)")
    correct_answers: List[str] = Field(..., description="List of acceptable answers")
    points: float = Field(default=1.0, description="Points for this blank")
    case_sensitive: bool = Field(default=False, description="Whether answer matching is case-sensitive")

class FillBlankConfig(BaseModel):
    """Extended config for fill_blank question type"""
    blanks: List[BlankConfig] = Field(..., description="List of blanks configuration")
    allow_partial_credit: bool = Field(default=True, description="Award points per blank vs all-or-nothing")

class SubQuestion(BaseModel):
    """Sub-question configuration for multi_part questions"""
    id: str = Field(..., description="Sub-question identifier (e.g., '1a', '1b')")
    type: str = Field(..., description="Type: mcq, short, or long")
    text: str = Field(..., description="Sub-question text")
    points: float = Field(default=1.0, description="Points for this sub-question")
    options: Optional[Dict[str, str]] = Field(None, description="For MCQ sub-questions")
    correct_option_id: Optional[str] = Field(None, description="For MCQ sub-questions")
    correct_answer: Optional[str] = Field(None, description="For short/long sub-questions")

class MultiPartConfig(BaseModel):
    """Extended config for multi_part question type"""
    sub_questions: List[SubQuestion] = Field(..., description="List of sub-questions")

class MCQMultipleConfig(BaseModel):
    """Extended config for mcq_multiple question type"""
    correct_option_ids: List[str] = Field(..., description="List of correct option IDs (e.g., ['A', 'B'])")
    partial_credit: bool = Field(default=True, description="Award partial credit based on selections")
    penalty_for_wrong: bool = Field(default=True, description="Deduct points for incorrect selections")

class QuestionBase(BaseModel):
    module_id: UUID = Field(..., description="ID of the related module")
    document_id: Optional[UUID] = Field(None, description="Optional ID of the source document")
    type: str = Field(..., description="Question type: mcq, short, long, mcq_multiple, fill_blank, or multi_part")
    text: str = Field(..., description="Question text")
    slide_number: Optional[int] = Field(None, description="If from slides, optional slide number")
    points: float = Field(default=1.0, description="Points awarded for correct answer")
    question_order: Optional[int] = Field(None, description="Order/position of question in the module")
    options: Optional[Dict[str, str]] = Field(None, description="Only for MCQs, e.g., {'A': 'Apple', 'B': 'Ball'}")
    correct_answer: Optional[str] = Field(None, description="Legacy: Correct answer text (for short/long questions)")
    correct_option_id: Optional[str] = Field(None, description="For MCQs: Correct option ID (A, B, C, or D)")

    # Extended configuration for new question types
    extended_config: Optional[Dict[str, Any]] = Field(None, description="Type-specific configuration (JSONB)")

    learning_outcome: Optional[str] = Field(None, description="Outcome target if defined")
    bloom_taxonomy: Optional[str] = Field(None, description="Bloom's level like Remember, Analyze, etc.")
    image_url: Optional[str] = Field(None, description="URL to image if the question is visual")
    has_text_input: Optional[bool] = Field(False, description="True if it includes explanation input")

    # Feedback Critique Settings
    allow_critique: Optional[bool] = Field(False, description="Allow students to critique AI feedback for this question")

    # AI Generation and Review Workflow Fields
    status: Optional[str] = Field("active", description="Question status: unreviewed, active, or archived")
    is_ai_generated: Optional[bool] = Field(False, description="Whether this question was AI-generated")
    generated_at: Optional[datetime] = Field(None, description="Timestamp when question was AI-generated")

    @validator('type')
    def validate_question_type(cls, v):
        valid_types = ['mcq', 'short', 'long', 'mcq_multiple', 'fill_blank', 'multi_part']
        if v not in valid_types:
            raise ValueError(f"Invalid question type. Must be one of: {', '.join(valid_types)}")
        return v

    @model_validator(mode='after')
    def validate_extended_config(self):
        qtype = self.type
        extended_config = self.extended_config

        # Validate that new question types have extended_config
        if qtype in ['mcq_multiple', 'fill_blank', 'multi_part']:
            if not extended_config:
                raise ValueError(f"Question type '{qtype}' requires extended_config")

        # Type-specific validation
        if qtype == 'mcq_multiple' and extended_config:
            if 'correct_option_ids' not in extended_config:
                raise ValueError("mcq_multiple requires 'correct_option_ids' in extended_config")
            if not isinstance(extended_config['correct_option_ids'], list):
                raise ValueError("'correct_option_ids' must be a list")
            if len(extended_config['correct_option_ids']) < 1:
                raise ValueError("mcq_multiple must have at least 1 correct option")

        if qtype == 'fill_blank' and extended_config:
            if 'blanks' not in extended_config:
                raise ValueError("fill_blank requires 'blanks' in extended_config")
            if not isinstance(extended_config['blanks'], list):
                raise ValueError("'blanks' must be a list")
            if len(extended_config['blanks']) < 1:
                raise ValueError("fill_blank must have at least 1 blank")

        if qtype == 'multi_part' and extended_config:
            if 'sub_questions' not in extended_config:
                raise ValueError("multi_part requires 'sub_questions' in extended_config")
            if not isinstance(extended_config['sub_questions'], list):
                raise ValueError("'sub_questions' must be a list")
            if len(extended_config['sub_questions']) < 1:
                raise ValueError("multi_part must have at least 1 sub-question")

        return self

class QuestionCreate(QuestionBase):
    pass

class QuestionUpdate(BaseModel):
    text: Optional[str] = None
    type: Optional[str] = None
    slide_number: Optional[int] = None
    points: Optional[float] = None
    question_order: Optional[int] = None
    options: Optional[Dict[str, str]] = None
    correct_answer: Optional[str] = None
    correct_option_id: Optional[str] = None
    extended_config: Optional[Dict[str, Any]] = None
    learning_outcome: Optional[str] = None
    bloom_taxonomy: Optional[str] = None
    image_url: Optional[str] = None
    has_text_input: Optional[bool] = None
    allow_critique: Optional[bool] = None
    document_id: Optional[UUID] = None
    status: Optional[str] = None

class QuestionOut(QuestionBase):
    id: UUID

    class Config:
        from_attributes = True


class QuestionStudentOut(BaseModel):
    """
    Student-facing question view. Deliberately does NOT inherit QuestionBase —
    correct_answer and correct_option_id must never be reachable here even if
    a future field gets added to QuestionBase, since hiding the answer in the
    frontend UI does nothing if the API response still contains it.

    extended_config is scrubbed per-type by sanitize_question_for_student()
    before this model is ever constructed, since the answer-revealing fields
    live nested inside it (blanks[].correct_answers, correct_option_ids,
    sub_questions[].correct_answer/correct_option_id) and response_model
    field selection only filters top-level fields, not dict contents.
    """
    id: UUID
    module_id: UUID
    document_id: Optional[UUID] = None
    type: str
    text: str
    slide_number: Optional[int] = None
    points: float
    question_order: Optional[int] = None
    options: Optional[Dict[str, str]] = None
    extended_config: Optional[Dict[str, Any]] = None
    learning_outcome: Optional[str] = None
    bloom_taxonomy: Optional[str] = None
    image_url: Optional[str] = None
    has_text_input: Optional[bool] = False
    allow_critique: Optional[bool] = False
    status: Optional[str] = "active"
    is_ai_generated: Optional[bool] = False
    generated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


def _sanitize_extended_config(qtype: str, extended_config: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Strip answer-revealing fields from extended_config while keeping everything the student UI needs to render the question."""
    if not extended_config:
        return extended_config

    cfg = dict(extended_config)

    if qtype == 'fill_blank' and isinstance(cfg.get('blanks'), list):
        cfg['blanks'] = [
            {k: v for k, v in blank.items() if k != 'correct_answers'}
            for blank in cfg['blanks']
        ]
    elif qtype == 'mcq_multiple':
        cfg.pop('correct_option_ids', None)
    elif qtype == 'multi_part' and isinstance(cfg.get('sub_questions'), list):
        cfg['sub_questions'] = [
            {k: v for k, v in sub_q.items() if k not in ('correct_option_id', 'correct_answer')}
            for sub_q in cfg['sub_questions']
        ]

    return cfg


def sanitize_question_for_student(question) -> QuestionStudentOut:
    """Build the student-safe view of a Question ORM object for any student-facing endpoint."""
    return QuestionStudentOut(
        id=question.id,
        module_id=question.module_id,
        document_id=question.document_id,
        type=question.type,
        text=question.text,
        slide_number=question.slide_number,
        points=question.points,
        question_order=question.question_order,
        options=question.options,
        extended_config=_sanitize_extended_config(question.type, question.extended_config),
        learning_outcome=question.learning_outcome,
        bloom_taxonomy=question.bloom_taxonomy,
        image_url=question.image_url,
        has_text_input=question.has_text_input,
        allow_critique=question.allow_critique,
        status=question.status,
        is_ai_generated=question.is_ai_generated,
        generated_at=question.generated_at,
    )


# AI Question Generation Schemas

class QuestionGenerationRequest(BaseModel):
    """Request schema for AI question generation"""
    instructions: str = Field("", max_length=2000, description="Optional teacher guidance for generated questions")
    num_short: int = Field(0, ge=0, le=50, description="Number of short answer questions to generate (0-50)")
    num_long: int = Field(0, ge=0, le=50, description="Number of long answer questions to generate (0-50)")
    num_mcq: int = Field(0, ge=0, le=50, description="Number of multiple choice questions to generate (0-50)")
    num_mcq_multiple: int = Field(0, ge=0, le=50, description="Number of multiple correct MCQ questions to generate (0-50)")
    num_fill_blank: int = Field(0, ge=0, le=50, description="Number of fill-in-the-blank questions to generate (0-50)")
    num_multi_part: int = Field(0, ge=0, le=50, description="Number of multi-part questions to generate (0-50)")

    @validator('num_short', 'num_long', 'num_mcq', 'num_mcq_multiple', 'num_fill_blank', 'num_multi_part')
    def validate_counts(cls, v):
        if v < 0:
            raise ValueError("Question count cannot be negative")
        if v > 50:
            raise ValueError("Cannot generate more than 50 questions of one type at a time")
        return v

    @validator('num_multi_part')
    def validate_total(cls, v, values):
        total = (values.get('num_short', 0) + values.get('num_long', 0) +
                values.get('num_mcq', 0) + values.get('num_mcq_multiple', 0) +
                values.get('num_fill_blank', 0) + v)
        if total == 0:
            raise ValueError("Must request at least 1 question")
        if total > 100:
            raise ValueError("Cannot generate more than 100 total questions at a time")
        return v


class QuestionGenerationResponse(BaseModel):
    """Response schema after AI question generation"""
    generated_count: int = Field(..., description="Total number of questions generated")
    num_short: int = Field(..., description="Number of short answer questions generated")
    num_long: int = Field(..., description="Number of long answer questions generated")
    num_mcq: int = Field(..., description="Number of MCQ questions generated")
    num_mcq_multiple: int = Field(0, description="Number of multiple correct MCQ questions generated")
    num_fill_blank: int = Field(0, description="Number of fill-in-the-blank questions generated")
    num_multi_part: int = Field(0, description="Number of multi-part questions generated")
    document_id: UUID = Field(..., description="ID of the source document")
    module_id: UUID = Field(..., description="ID of the module")
    review_url: str = Field(..., description="URL to review the generated questions")
    message: str = Field(..., description="Success message")


class BulkApproveRequest(BaseModel):
    """Request schema for bulk approving questions"""
    question_ids: List[UUID] = Field(..., description="List of question IDs to approve")

    @validator('question_ids')
    def validate_ids(cls, v):
        if not v:
            raise ValueError("Must provide at least one question ID")
        if len(v) > 200:
            raise ValueError("Cannot approve more than 200 questions at once")
        return v


class BulkApproveResponse(BaseModel):
    """Response schema after bulk approving questions"""
    approved_count: int = Field(..., description="Number of questions successfully approved")
    failed_count: int = Field(0, description="Number of questions that failed to approve")
    message: str = Field(..., description="Success message")