"""
Sample data factories for creating test data.
"""
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List


def generate_uuid() -> uuid.UUID:
    """Generate a random UUID."""
    return uuid.uuid4()


def generate_banner_id(prefix: str = "STU") -> str:
    """Generate a fake banner ID."""
    return f"{prefix}{uuid.uuid4().hex[:6].upper()}"


# ---------------------------------------------------------------------------
# User Data Factories
# ---------------------------------------------------------------------------
def create_user_data(
    role: str = "student",
    email: Optional[str] = None,
    user_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Create user registration data."""
    uid = user_id or generate_banner_id("USR")
    return {
        "id": uid,
        "username": f"user_{uid.lower()}",
        "email": email or f"{uid.lower()}@test.com",
        "password": "TestPassword123!",
        "role": role,
    }


def create_login_data(user_id: str, password: str = "TestPassword123!") -> Dict[str, Any]:
    """Create login request data."""
    return {
        "id": user_id,
        "password": password,
    }


# ---------------------------------------------------------------------------
# Module Data Factories
# ---------------------------------------------------------------------------
def create_module_data(
    name: Optional[str] = None,
    teacher_id: Optional[str] = None,
    access_code: Optional[str] = None,
) -> Dict[str, Any]:
    """Create module creation data."""
    suffix = uuid.uuid4().hex[:6]
    return {
        "name": name or f"Test Module {suffix}",
        "description": "A test module for unit testing.",
        "access_code": access_code or f"CODE{suffix.upper()}",
        "teacher_id": teacher_id or generate_banner_id("TCH"),
        "is_active": True,
        "consent_required": False,
    }


def create_rubric_data(
    tone: str = "encouraging",
    rag_enabled: bool = False,
) -> Dict[str, Any]:
    """Create feedback rubric configuration."""
    return {
        "grading_criteria": {
            "accuracy": {
                "weight": 40,
                "description": "Correctness of the answer"
            },
            "completeness": {
                "weight": 30,
                "description": "Coverage of all key points"
            },
            "clarity": {
                "weight": 30,
                "description": "Clear and coherent expression"
            }
        },
        "feedback_style": {
            "tone": tone,
            "detail_level": "detailed",
            "custom_instructions": None
        },
        "rag_settings": {
            "enabled": rag_enabled,
            "similarity_threshold": 0.7,
            "max_chunks": 5
        }
    }


# ---------------------------------------------------------------------------
# Question Data Factories
# ---------------------------------------------------------------------------
def create_mcq_question_data(
    module_id: uuid.UUID,
    text: str = "What is 2 + 2?",
    correct_option: str = "B",
    document_id: Optional[uuid.UUID] = None,
) -> Dict[str, Any]:
    """Create MCQ question data."""
    return {
        "module_id": str(module_id),
        "document_id": str(document_id) if document_id else None,
        "type": "mcq",
        "text": text,
        "options": {"A": "3", "B": "4", "C": "5", "D": "6"},
        "correct_option_id": correct_option,
        "points": 1.0,
        "status": "active",
    }


def create_short_question_data(
    module_id: uuid.UUID,
    text: str = "Explain the concept briefly.",
    correct_answer: Optional[str] = None,
    document_id: Optional[uuid.UUID] = None,
) -> Dict[str, Any]:
    """Create short answer question data."""
    return {
        "module_id": str(module_id),
        "document_id": str(document_id) if document_id else None,
        "type": "short",
        "text": text,
        "correct_answer": correct_answer or "A brief explanation of the concept.",
        "points": 5.0,
        "status": "active",
    }


def create_long_question_data(
    module_id: uuid.UUID,
    text: str = "Discuss this topic in detail.",
    document_id: Optional[uuid.UUID] = None,
) -> Dict[str, Any]:
    """Create long answer question data."""
    return {
        "module_id": str(module_id),
        "document_id": str(document_id) if document_id else None,
        "type": "long",
        "text": text,
        "points": 10.0,
        "status": "active",
    }


def create_fill_blank_question_data(
    module_id: uuid.UUID,
    text: str = "The ___ is essential for ___.",
    blanks: Optional[List[Dict]] = None,
    document_id: Optional[uuid.UUID] = None,
) -> Dict[str, Any]:
    """Create fill-in-the-blank question data."""
    default_blanks = [
        {"position": 0, "correct_answers": ["answer1", "ans1"], "points": 2.0, "case_sensitive": False},
        {"position": 1, "correct_answers": ["answer2"], "points": 2.0, "case_sensitive": False},
    ]
    return {
        "module_id": str(module_id),
        "document_id": str(document_id) if document_id else None,
        "type": "fill_blank",
        "text": text,
        "points": 4.0,
        "status": "active",
        "extended_config": {"blanks": blanks or default_blanks},
    }


def create_mcq_multiple_question_data(
    module_id: uuid.UUID,
    text: str = "Select all that apply:",
    correct_options: Optional[List[str]] = None,
    document_id: Optional[uuid.UUID] = None,
) -> Dict[str, Any]:
    """Create MCQ with multiple correct answers."""
    return {
        "module_id": str(module_id),
        "document_id": str(document_id) if document_id else None,
        "type": "mcq_multiple",
        "text": text,
        "options": {"A": "Option A", "B": "Option B", "C": "Option C", "D": "Option D"},
        "points": 4.0,
        "status": "active",
        "extended_config": {
            "correct_option_ids": correct_options or ["A", "C"],
            "partial_credit": True,
            "penalty_for_wrong": True,
        },
    }


def create_multi_part_question_data(
    module_id: uuid.UUID,
    text: str = "Answer the following parts:",
    sub_questions: Optional[List[Dict]] = None,
    document_id: Optional[uuid.UUID] = None,
) -> Dict[str, Any]:
    """Create multi-part question data."""
    default_sub_questions = [
        {
            "id": "a",
            "type": "mcq",
            "text": "Part A: Choose the correct answer.",
            "points": 2.0,
            "options": {"A": "Yes", "B": "No"},
            "correct_option_id": "A",
        },
        {
            "id": "b",
            "type": "short",
            "text": "Part B: Explain your reasoning.",
            "points": 3.0,
            "correct_answer": "Expected explanation.",
        },
    ]
    return {
        "module_id": str(module_id),
        "document_id": str(document_id) if document_id else None,
        "type": "multi_part",
        "text": text,
        "points": 5.0,
        "status": "active",
        "extended_config": {"sub_questions": sub_questions or default_sub_questions},
    }


# ---------------------------------------------------------------------------
# Student Answer Data Factories
# ---------------------------------------------------------------------------
def create_mcq_answer_data(
    question_id: uuid.UUID,
    module_id: uuid.UUID,
    selected_option: str = "B",
    attempt: int = 1,
) -> Dict[str, Any]:
    """Create MCQ answer submission data."""
    return {
        "question_id": str(question_id),
        "module_id": str(module_id),
        "answer": {"selected_option": selected_option},
        "attempt": attempt,
    }


def create_text_answer_data(
    question_id: uuid.UUID,
    module_id: uuid.UUID,
    text: str = "This is my answer to the question.",
    attempt: int = 1,
) -> Dict[str, Any]:
    """Create text answer submission data."""
    return {
        "question_id": str(question_id),
        "module_id": str(module_id),
        "answer": {"text": text},
        "attempt": attempt,
    }


def create_fill_blank_answer_data(
    question_id: uuid.UUID,
    module_id: uuid.UUID,
    answers: Optional[Dict[int, str]] = None,
    attempt: int = 1,
) -> Dict[str, Any]:
    """Create fill-in-the-blank answer submission data."""
    return {
        "question_id": str(question_id),
        "module_id": str(module_id),
        "answer": {"blanks": answers or {0: "answer1", 1: "answer2"}},
        "attempt": attempt,
    }


def create_mcq_multiple_answer_data(
    question_id: uuid.UUID,
    module_id: uuid.UUID,
    selected_options: Optional[List[str]] = None,
    attempt: int = 1,
) -> Dict[str, Any]:
    """Create MCQ multiple answer submission data."""
    return {
        "question_id": str(question_id),
        "module_id": str(module_id),
        "answer": {"selected_options": selected_options or ["A", "C"]},
        "attempt": attempt,
    }


def create_multi_part_answer_data(
    question_id: uuid.UUID,
    module_id: uuid.UUID,
    sub_answers: Optional[Dict[str, Any]] = None,
    attempt: int = 1,
) -> Dict[str, Any]:
    """Create multi-part answer submission data."""
    default_sub_answers = {
        "a": {"selected_option": "A"},
        "b": {"text": "My explanation for part B."},
    }
    return {
        "question_id": str(question_id),
        "module_id": str(module_id),
        "answer": {"sub_answers": sub_answers or default_sub_answers},
        "attempt": attempt,
    }


# ---------------------------------------------------------------------------
# Document Data Factories
# ---------------------------------------------------------------------------
def create_document_data(
    module_id: uuid.UUID,
    filename: str = "test_document.pdf",
    status: str = "completed",
) -> Dict[str, Any]:
    """Create document metadata."""
    return {
        "module_id": str(module_id),
        "original_filename": filename,
        "file_hash": uuid.uuid4().hex,
        "storage_path": f"modules/{module_id}/{filename}",
        "file_size": 1024,
        "mime_type": "application/pdf",
        "processing_status": status,
        "parse_status": status,
    }


# ---------------------------------------------------------------------------
# Chat Data Factories
# ---------------------------------------------------------------------------
def create_chat_message_data(
    module_id: uuid.UUID,
    message: str = "Hello, can you help me understand this concept?",
    conversation_id: Optional[uuid.UUID] = None,
) -> Dict[str, Any]:
    """Create chat message data."""
    return {
        "module_id": str(module_id),
        "conversation_id": str(conversation_id) if conversation_id else None,
        "message": message,
    }


# ---------------------------------------------------------------------------
# Survey Data Factories
# ---------------------------------------------------------------------------
def create_survey_response_data(
    module_id: uuid.UUID,
    responses: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """Create survey response data."""
    default_responses = {
        "q1": "The AI feedback was very helpful.",
        "q2": "Sometimes the explanations were too brief.",
        "q3": "4 out of 5 - Good experience overall.",
        "q4": "More examples would be helpful.",
        "q5": "Thank you for this learning platform.",
    }
    return {
        "module_id": str(module_id),
        "responses": responses or default_responses,
    }
