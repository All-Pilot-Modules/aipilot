from sqlalchemy import Column, String, TIMESTAMP, ForeignKey, Boolean, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base
import uuid
from datetime import datetime, timezone


DEFAULT_AI_CONFIG = {
    "grading": {
        # "auto"           – AI grades and result is shown to student
        # "teacher_assist" – AI suggests a grade to teacher only; teacher approves before student sees
        # "teacher_only"   – AI grades automatically; result visible to teacher only
        # "disabled"       – no AI grading
        "mode": "auto",
        "show_score_to_student": True,
        "show_explanation_to_student": True,
        "show_hints_to_student": True,
        "teacher_sees_ai_suggestions": True,
        "require_teacher_approval": False,
        "model": "gpt-4"
    },
    "chatbot": {
        "enabled": True,
        "mode": "guided",
        "model": "gpt-4",
        "instructions": None
    },
    "feedback": {
        "immediate": True,
        "show_after_final_attempt": False
    }
}

DEFAULT_AI_SAFETY_CONFIG = {
    "content_filter_level": "moderate",
    "block_harmful_content": True,
    "block_off_topic": False,
    "allowed_topics": [],
    "blocked_topics": [],
    "blocked_keywords": []
}

DEFAULT_ENROLLMENT_CONFIG = {
    "max_students": None,
    "requires_approval": False,
    "allowed_email_domains": [],
    "allow_self_unenroll": True
}

DEFAULT_ASSIGNMENT_CONFIG = {
    "features": {
        "multiple_attempts": {
            "enabled": True,
            "max_attempts": 2,
            "show_feedback_after_each": True
        },
        "mastery_learning": {
            "enabled": False,
            "streak_required": 3,
            "queue_randomization": True,
            "reset_on_wrong": False
        },
        "chatbot_feedback": {
            "enabled": True,
            "conversation_mode": "guided",
            "ai_model": "gpt-4"
        },
        "display": {
            "show_progress_bar": True,
            "show_streak_counter": True,
            "show_attempt_counter": True
        }
    }
}


# ── Default settings template ─────────────────────────────────────────────────

DEFAULT_MODULE_SETTINGS = {
    # ── AI ────────────────────────────────────────────────────────────────────
    "ai": {
        "grading": {
            # mirrors flat column ai_grading_mode — keep in sync
            # "auto" | "teacher_assist" | "teacher_only" | "disabled"
            "mode": "auto",
            "show_score_to_student": True,
            "show_explanation_to_student": True,
            "show_hints_to_student": True,
            "teacher_sees_ai_suggestions": True,
            "require_teacher_approval": False,
            "model": "gpt-4"
        },
        "chatbot": {
            "enabled": True,
            "mode": "guided",           # "guided" | "free_form"
            "model": "gpt-4",
            "instructions": None        # null → use platform default prompt
        },
        "feedback": {
            "immediate": True,
            "show_after_final_attempt": False
        },
        "safety": {
            "content_filter_level": "moderate",  # "strict" | "moderate" | "permissive"
            "block_harmful_content": True,
            "block_off_topic": False,
            "allowed_topics": [],       # [] = no restriction
            "blocked_topics": [],
            "blocked_keywords": []
        },
        "rubric": None                  # rubric config object when enabled
    },

    # ── Attempts ──────────────────────────────────────────────────────────────
    "attempts": {
        "max_attempts": 2,
        "show_feedback_after_each": True
    },

    # ── Mastery learning ──────────────────────────────────────────────────────
    "mastery": {
        "enabled": False,
        "streak_required": 3,
        "queue_randomization": True,
        "reset_on_wrong": False
    },

    # ── Display ───────────────────────────────────────────────────────────────
    "display": {
        "show_progress_bar": True,
        "show_streak_counter": True,
        "show_attempt_counter": True
    },

    # ── Enrollment ────────────────────────────────────────────────────────────
    # enrollment_type flat column drives the gate; this holds the detail rules
    "enrollment": {
        "max_students": None,           # null = unlimited
        "requires_approval": False,
        "allowed_email_domains": [],    # [] = any domain
        "allow_self_unenroll": True
    },

    # ── Research consent ──────────────────────────────────────────────────────
    "consent": {
        "required": True,
        "form_text": None               # null → use platform default consent text
    },

    # ── Student survey ────────────────────────────────────────────────────────
    "survey": {
        "required": False,
        "questions": []                 # [] → use platform default survey questions
    }
}


# ── Batch settings template ───────────────────────────────────────────────────
# Null values inherit from parent module settings.

DEFAULT_BATCH_SETTINGS = {
    "time_limit_minutes": None,         # null = no limit
    "show_timer": True,
    "randomize_question_order": False,
    "random_question_count": None,      # null = all questions in batch
    "allow_back_navigation": True,
    "password": None                    # optional batch-level password
}


class Module(Base):
    __tablename__ = "modules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    teacher_id = Column(String, ForeignKey("users.id"), nullable=False)

    # ── Core identity ──────────────────────────────────────────────────────────
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    slug = Column(String, unique=True, nullable=True)
    thumbnail_url = Column(String, nullable=True)
    instructions = Column(Text, nullable=True)

    # ── Type & lifecycle ───────────────────────────────────────────────────────
    # "learn" | "quiz" | "reflection" | "tech"
    module_type = Column(String, nullable=False, default="learn", server_default="learn")
    # "draft" | "published" | "archived"
    status = Column(String, nullable=False, default="draft", server_default="draft")
    is_active = Column(Boolean, default=True)    # mirrors status == "published"; kept for compat
    is_template = Column(Boolean, default=False, server_default="false")
    due_date = Column(TIMESTAMP(timezone=True), nullable=True)

    # ── Visibility & access ────────────────────────────────────────────────────
    # "class-only" | "public"
    visibility = Column(String, default="class-only")
    access_code = Column(String, unique=True, nullable=False)
    # "open" | "invite_only" | "code_required"
    enrollment_type = Column(String, nullable=False, default="code_required", server_default="code_required")

    # ── AI grading mode (flat — read in hot paths throughout the app) ──────────
    # "auto" | "teacher_assist" | "teacher_only" | "disabled"
    # auto           – AI grades, result shown to student
    # teacher_assist – AI suggests grade to teacher; teacher approves before student sees
    # teacher_only   – AI grades; result visible to teacher only, never student
    # disabled       – no AI grading
    ai_grading_mode = Column(String, nullable=False, default="auto", server_default="auto")

    # ── Per-feature config columns ─────────────────────────────────────────────
    ai_config = Column(JSONB, nullable=True, default=DEFAULT_AI_CONFIG)
    ai_safety_config = Column(JSONB, nullable=True, default=DEFAULT_AI_SAFETY_CONFIG)
    enrollment_config = Column(JSONB, nullable=True, default=DEFAULT_ENROLLMENT_CONFIG)
    assignment_config = Column(JSONB, nullable=True, default=DEFAULT_ASSIGNMENT_CONFIG)
    feedback_rubric = Column(JSONB, nullable=True)
    chatbot_instructions = Column(Text, nullable=True)
    consent_form_text = Column(Text, nullable=True)
    consent_required = Column(Boolean, default=True)

    # ── Unified settings (future use) ─────────────────────────────────────────
    settings = Column(JSONB, nullable=True, default=DEFAULT_MODULE_SETTINGS)

    created_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint('teacher_id', 'name', name='uix_module_teacher_name'),
    )
