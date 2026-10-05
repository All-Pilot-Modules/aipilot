from sqlalchemy.orm import Session
from app.models.student_answer import StudentAnswer
from app.schemas.student_answer import StudentAnswerCreate, StudentAnswerUpdate
from uuid import UUID
from typing import List, Optional

# Create a student answer
def create_student_answer(db: Session, answer_data: StudentAnswerCreate, commit: bool = True) -> StudentAnswer:
    """
    Pass commit=False to add the answer within an already-open transaction
    (e.g. so it lands atomically together with the FeedbackJob it triggers)
    instead of committing immediately — the caller then owns the final
    db.commit(). The id is available on the returned object either way
    since StudentAnswer generates its UUID client-side.
    """
    db_answer = StudentAnswer(**answer_data.dict())
    db.add(db_answer)
    if commit:
        db.commit()
        db.refresh(db_answer)
    else:
        db.flush()
    return db_answer

# Get student answer by ID
def get_student_answer_by_id(db: Session, answer_id: UUID) -> Optional[StudentAnswer]:
    return db.query(StudentAnswer).filter(StudentAnswer.id == answer_id).first()

# Get all answers for a student in a document
def get_student_answers_by_document(db: Session, student_id: str, document_id: UUID, attempt: int = 1) -> List[StudentAnswer]:
    return db.query(StudentAnswer).filter(
        StudentAnswer.student_id == student_id,
        StudentAnswer.document_id == document_id,
        StudentAnswer.attempt == attempt
    ).all()

# Get specific student answer for a question and attempt
def get_student_answer(db: Session, student_id: str, question_id: UUID, attempt: int = 1) -> Optional[StudentAnswer]:
    return db.query(StudentAnswer).filter(
        StudentAnswer.student_id == student_id,
        StudentAnswer.question_id == question_id,
        StudentAnswer.attempt == attempt
    ).first()

# Update student answer
def update_student_answer(db: Session, answer_id: UUID, answer_data: StudentAnswerUpdate, commit: bool = True) -> Optional[StudentAnswer]:
    """Pass commit=False to defer to the caller's own final db.commit() (see create_student_answer)."""
    db_answer = get_student_answer_by_id(db, answer_id)
    if not db_answer:
        return None

    for key, value in answer_data.dict(exclude_unset=True).items():
        setattr(db_answer, key, value)

    if commit:
        db.commit()
        db.refresh(db_answer)
    else:
        db.flush()
    return db_answer

# Delete student answer
def delete_student_answer(db: Session, answer_id: UUID) -> Optional[StudentAnswer]:
    db_answer = get_student_answer_by_id(db, answer_id)
    if not db_answer:
        return None
    
    db.delete(db_answer)
    db.commit()
    return db_answer

# Check if student has completed an attempt for a document
def has_completed_attempt(db: Session, student_id: str, document_id: UUID, attempt: int = 1) -> bool:
    from app.models.question import Question
    
    # Get total questions in document
    total_questions = db.query(Question).filter(Question.document_id == document_id).count()
    
    # Get answered questions for this attempt
    answered_questions = db.query(StudentAnswer).filter(
        StudentAnswer.student_id == student_id,
        StudentAnswer.document_id == document_id,
        StudentAnswer.attempt == attempt
    ).count()
    
    return answered_questions >= total_questions

# Get student's progress for a document
def get_student_progress(db: Session, student_id: str, document_id: UUID, attempt: int = 1) -> dict:
    from app.models.question import Question
    
    # Get total questions in document
    total_questions = db.query(Question).filter(Question.document_id == document_id).count()
    
    # Get answered questions for this attempt
    answered_questions = db.query(StudentAnswer).filter(
        StudentAnswer.student_id == student_id,
        StudentAnswer.document_id == document_id,
        StudentAnswer.attempt == attempt
    ).count()
    
    return {
        "total_questions": total_questions,
        "answered_questions": answered_questions,
        "completion_percentage": (answered_questions / total_questions * 100) if total_questions > 0 else 0,
        "is_complete": answered_questions >= total_questions
    }

# Get student's progress for all questions in a module
def get_student_progress_by_module(db: Session, student_id: str, module_id: UUID, attempt: int = 1) -> dict:
    from app.models.question import Question

    # Get total questions in this module (direct relationship)
    total_questions = db.query(Question).filter(Question.module_id == module_id).count()

    # Get answered questions for this attempt in the module
    answered_questions = db.query(StudentAnswer).filter(
        StudentAnswer.student_id == student_id,
        StudentAnswer.module_id == module_id,
        StudentAnswer.attempt == attempt
    ).count()

    return {
        "total_questions": total_questions,
        "answered_questions": answered_questions,
        "completion_percentage": (answered_questions / total_questions * 100) if total_questions > 0 else 0,
        "is_complete": answered_questions >= total_questions
    }

# Get all student answers for a module (teacher function)
def get_student_answers_by_module(db: Session, module_id: UUID) -> List[dict]:
    from app.models.question import Question

    # Join with Question to get question text, options, and correct answer (direct module relationship)
    results = db.query(
        StudentAnswer,
        Question.text,
        Question.options,
        Question.correct_answer,
        Question.correct_option_id
    ).join(Question, StudentAnswer.question_id == Question.id).filter(
        StudentAnswer.module_id == module_id
    ).all()

    # Convert to list of dictionaries with question_text, options, and correct answer included
    answer_list = []
    for answer, question_text, question_options, correct_answer, correct_option_id in results:
        answer_dict = {
            "id": answer.id,
            "student_id": answer.student_id,
            "question_id": answer.question_id,
            "module_id": answer.module_id,
            "document_id": answer.document_id,
            "answer": answer.answer,
            "attempt": answer.attempt,
            "submitted_at": answer.submitted_at,
            "question_text": question_text,
            "question_options": question_options,
            "correct_answer": correct_answer,
            "correct_option_id": correct_option_id
        }
        answer_list.append(answer_dict)

    return answer_list

# Delete all answers for a student in a specific module (teacher function)
def delete_student_assignment(db: Session, student_id: str, module_id: UUID) -> int:
    """
    Delete all data for a student in a specific module including:
    - Student answers (and AI feedback will cascade delete)
    - Student enrollment
    - Survey responses
    - Test submissions
    - Chat conversations
    """
    from app.models.student_enrollment import StudentEnrollment
    from app.models.survey_response import SurveyResponse
    from app.models.test_submission import TestSubmission
    from app.models.chat_conversation import ChatConversation

    total_deleted = 0

    # Delete student answers (AI feedback will cascade delete automatically)
    answers = db.query(StudentAnswer).filter(
        StudentAnswer.student_id == student_id,
        StudentAnswer.module_id == module_id
    ).all()

    for answer in answers:
        db.delete(answer)
        total_deleted += 1

    # Delete student enrollment
    enrollments = db.query(StudentEnrollment).filter(
        StudentEnrollment.student_id == student_id,
        StudentEnrollment.module_id == module_id
    ).all()

    for enrollment in enrollments:
        db.delete(enrollment)
        total_deleted += 1

    # Delete survey responses
    surveys = db.query(SurveyResponse).filter(
        SurveyResponse.student_id == student_id,
        SurveyResponse.module_id == module_id
    ).all()

    for survey in surveys:
        db.delete(survey)
        total_deleted += 1

    # Delete test submissions
    submissions = db.query(TestSubmission).filter(
        TestSubmission.student_id == student_id,
        TestSubmission.module_id == module_id
    ).all()

    for submission in submissions:
        db.delete(submission)
        total_deleted += 1

    # Delete chat conversations (messages will cascade delete)
    conversations = db.query(ChatConversation).filter(
        ChatConversation.student_id == student_id,
        ChatConversation.module_id == module_id
    ).all()

    for conversation in conversations:
        db.delete(conversation)
        total_deleted += 1

    db.commit()
    return total_deleted