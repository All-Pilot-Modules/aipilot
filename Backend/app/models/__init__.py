# noqa: F401 — all imports here are side-effect registrations with SQLAlchemy Base.
# They must be imported so Base.metadata.create_all() knows about every table.
from app.database import Base  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.module import Module  # noqa: F401
from app.models.document import Document  # noqa: F401
from app.models.document_chunk import DocumentChunk  # noqa: F401
from app.models.document_embedding import DocumentEmbedding  # noqa: F401
from app.models.question import Question  # noqa: F401
from app.models.student_enrollment import StudentEnrollment  # noqa: F401
from app.models.student_answer import StudentAnswer  # noqa: F401
from app.models.feedback_job import FeedbackJob  # noqa: F401
from app.models.ai_feedback import AIFeedback  # noqa: F401
from app.models.teacher_grade import TeacherGrade  # noqa: F401
from app.models.answer_grade import AnswerGrade  # noqa: F401
from app.models.test_submission import TestSubmission  # noqa: F401
from app.models.student_module_grade import StudentModuleGrade  # noqa: F401
from app.models.survey_response import SurveyResponse  # noqa: F401
from app.models.feedback_critique import FeedbackCritique  # noqa: F401
from app.models.question_queue import QuestionQueue  # noqa: F401
from app.models.chat_conversation import ChatConversation  # noqa: F401
from app.models.chat_message import ChatMessage  # noqa: F401
from app.models.enrollment_claim import EnrollmentClaim  # noqa: F401
from app.models.module_batch import ModuleBatch  # noqa: F401
from app.models.module_collaborator import ModuleCollaborator  # noqa: F401
