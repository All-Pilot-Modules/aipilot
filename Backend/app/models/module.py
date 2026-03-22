from sqlalchemy import Column, String, TIMESTAMP, ForeignKey, Boolean, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base
import uuid
from datetime import datetime


# Default consent form template
DEFAULT_CONSENT_FORM = """
# Research Consent Form

## Purpose of the Study
This study aims to improve educational outcomes using AI-assisted learning tools. Your participation will help advance educational research and improve this platform for future students.

## What to Expect
- Your responses and interactions will be collected for research purposes
- All data will be anonymized and kept confidential
- Participation will not affect your grades or academic standing
- You may withdraw from the study at any time without penalty

## Your Rights
- Your participation is completely voluntary
- You can choose not to participate without any consequences
- All data collected will remain confidential and anonymous
- The research has been approved by the institutional review board

## Questions?
If you have any questions about this research, please contact your instructor.
"""

# Default survey questions template
DEFAULT_SURVEY_QUESTIONS = [
    {
        "id": "q1",
        "question": "What did you find most helpful in this module?",
        "type": "long",
        "required": True,
        "placeholder": "Please share what aspects helped you learn effectively..."
    },
    {
        "id": "q2",
        "question": "What aspects of the module were challenging?",
        "type": "long",
        "required": False,
        "placeholder": "Describe any difficulties or areas for improvement..."
    },
    {
        "id": "q3",
        "question": "How would you rate your overall learning experience? (Please explain)",
        "type": "short",
        "required": True,
        "placeholder": "Your rating and brief explanation..."
    },
    {
        "id": "q4",
        "question": "Any suggestions for improvement?",
        "type": "long",
        "required": False,
        "placeholder": "Share your ideas..."
    },
    {
        "id": "q5",
        "question": "Additional comments:",
        "type": "long",
        "required": False,
        "placeholder": "Any other feedback you'd like to share..."
    }
]
DEAFULT_CHATBOT_INSTRUCTIONS="""You are a helpful and encouraging AI tutor for this course.

Response Style:
- Be clear, concise, and patient
- Use simple language appropriate for students
- Provide examples when explaining concepts
- Encourage critical thinking by asking guiding questions
- Be supportive and positive in your tone

Guidelines:
- Always base your answers on the course materials provided
- If you don't know something or it's not in the materials, say so honestly
- Break down complex topics into simpler parts
- Help students learn, don't just give direct answers
- Reference specific pages or sections from course materials when relevant"""

class Module(Base):
    __tablename__ = "modules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    teacher_id = Column(String, ForeignKey("users.id"), nullable=False)

    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    access_code = Column(String, unique=True, nullable=False)
    is_active = Column(Boolean, default=True)
    due_date = Column(TIMESTAMP, nullable=True)
    visibility = Column(String, default="class-only")  # e.g., 'class-only', 'public'
    # class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"), nullable=True)
    slug = Column(String, unique=True, nullable=True)
    instructions = Column(String, nullable=True)

    # Consent form for research participation (customizable per module)
    consent_form_text = Column(Text, nullable=True, default=DEFAULT_CONSENT_FORM)
    consent_required = Column(Boolean, default=True)  # Whether students must fill consent before accessing

    # Survey questions for student feedback (customizable per module)
    survey_questions = Column(JSONB, nullable=True, default=DEFAULT_SURVEY_QUESTIONS)
    survey_required = Column(Boolean, default=False)  # Whether students must complete survey

    # Chatbot custom instructions (teacher-defined response style and behavior)
    chatbot_instructions = Column(Text, nullable=True, default=DEAFULT_CHATBOT_INSTRUCTIONS)

    # Dedicated column for feedback rubric configuration (easier to query and manage)
    feedback_rubric = Column(JSONB, nullable=True)

    assignment_config = Column(JSONB, default={
        "features": {
            "multiple_attempts": {
                "enabled": True,
                "max_attempts": 2,
                "show_feedback_after_each": True
            },
            "chatbot_feedback": {
                "enabled": True,
                "conversation_mode": "guided",
                "ai_model": "gpt-4"
            },
            "mastery_learning": {
                "enabled": False,
                "streak_required": 3,
                "queue_randomization": True,
                "reset_on_wrong": False
            }
        },
        "display_settings": {
            "show_progress_bar": True,
            "show_streak_counter": True,
            "show_attempt_counter": True
        }
        # Note: feedback_rubric moved to dedicated column for better management
    })

    created_at = Column(TIMESTAMP, default=datetime.utcnow)

    __table_args__ = (
        # A teacher cannot have two modules with the same name; different teachers can reuse names
        UniqueConstraint('teacher_id', 'name', name='uix_module_teacher_name'),
    )