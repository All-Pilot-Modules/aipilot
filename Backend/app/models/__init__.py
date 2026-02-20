from app.models.user import User
from app.database import Base
# app/models/__init__.py


from app.models.user import User
from app.models.document import Document
from app.models.question import Question
from app.models.document_chunk import DocumentChunk  # ✅ NEW: Uncommented for RAG
from app.models.document_embedding import DocumentEmbedding  # ✅ NEW: For vector embeddings
from app.models.student_answer import StudentAnswer
from app.models.ai_feedback import AIFeedback  # ✅ NEW: AI feedback storage
from app.models.test_submission import TestSubmission  # ✅ NEW: Track test submissions
from app.models.module import Module
from app.models.student_enrollment import StudentEnrollment  # ✅ NEW: Student enrollments with consent
from app.models.survey_response import SurveyResponse  # ✅ NEW: Student survey responses
from app.models.chat_conversation import ChatConversation  # ✅ NEW: Chat conversations
from app.models.chat_message import ChatMessage  # ✅ NEW: Chat messages
from app.models.teacher_grade import TeacherGrade  # ✅ NEW: Teacher manual grades
from app.models.feedback_critique import FeedbackCritique  # ✅ NEW: Student feedback critiques
from app.models.feedback_job import FeedbackJob  # ✅ NEW: Persistent feedback job queue
# from app.models.autosave import Autosave
# from app.models.attempt_summary import AttemptSummary
# from app.models.audio_explanation import AudioExplanation
# from app.models.assignment import Assignment
# from app.models.class_model import Class, ClassMember
# from app.models.rubric import Rubric, RubricScore