from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional
import logging

from app.schemas.student_answer import StudentAnswerCreate, StudentAnswerOut, StudentAnswerUpdate
from app.schemas.module import ModuleOut
from app.schemas.document import DocumentOut
from app.schemas.question import QuestionOut
from app.schemas.ai_feedback import AIFeedbackResponse
from app.crud.student_answer import (
    create_student_answer,
    get_student_answer,
    get_student_answers_by_document,
    update_student_answer,
    delete_student_answer,
    get_student_progress,
    has_completed_attempt
)
from app.crud.module import get_module_by_access_code, get_module_by_id
from app.models.module import Module
from app.crud.document import get_documents_by_module, get_documents_by_module_for_students
from app.database import get_db
from app.services.feedback_worker import create_feedback_job

router = APIRouter()
logger = logging.getLogger(__name__)


# 🔍 Join module with access code
@router.post("/join-module", response_model=ModuleOut)
def join_module_with_code(
    access_code: str = Query(..., description="Module access code"),
    student_id: str = Query(None, description="Student Banner ID"),
    module_id: str = Query(None, description="Module ID (optional)"),
    db: Session = Depends(get_db)
):
    """
    Allow students to join a module using access code.
    Creates an enrollment record if student_id is provided.
    """
    from app.models.student_enrollment import StudentEnrollment
    from datetime import datetime, timezone

    print(f"🔍 Searching for access code: '{access_code}' (length: {len(access_code)})")

    # Debug: Check all modules and their access codes
    all_modules = db.query(Module).all()
    print(f"📊 Total modules in database: {len(all_modules)}")
    for i, mod in enumerate(all_modules[:5]):  # Show first 5 modules
        print(f"  Module {i+1}: name='{mod.name}', access_code='{mod.access_code}', active={mod.is_active}")

    # Try exact match first
    module = get_module_by_access_code(db, access_code.strip())
    if not module:
        # Try uppercase match
        module = get_module_by_access_code(db, access_code.strip().upper())
        if not module:
            # Try case-insensitive search
            module = db.query(Module).filter(Module.access_code.ilike(access_code.strip())).first()
            if not module:
                print(f"❌ No module found with access code: '{access_code}'")
                raise HTTPException(status_code=404, detail="Invalid access code")

    print(f"✅ Found module: '{module.name}' with access code: '{module.access_code}'")

    if not module.is_active:
        raise HTTPException(status_code=400, detail="Module is not active")

    # Create enrollment record if student_id is provided
    if student_id:
        # Check if already enrolled
        existing_enrollment = db.query(StudentEnrollment).filter(
            StudentEnrollment.student_id == student_id,
            StudentEnrollment.module_id == module.id
        ).first()

        if not existing_enrollment:
            # Create new enrollment
            enrollment = StudentEnrollment(
                student_id=student_id,
                module_id=module.id,
                access_code_used=access_code.strip().upper(),
                enrolled_at=datetime.now(timezone.utc)
            )
            db.add(enrollment)
            db.commit()
            db.refresh(enrollment)
            print(f"✅ Created enrollment for student {student_id} in module {module.name}")
        else:
            print(f"ℹ️ Student {student_id} already enrolled in module {module.name}")

    return module

# 📄 Get all documents in a module (for assignments)
@router.get("/modules/{module_id}/documents", response_model=List[DocumentOut])
def get_module_documents(
    module_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Get all non-testbank documents in a module (supporting materials only)
    """
    module = get_module_by_id(db, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    
    # Get documents but exclude test banks for student safety
    documents = get_documents_by_module_for_students(db, module_id)
    return documents

# ❓ Get all questions for a module (the assignment)
@router.get("/modules/{module_id}/questions", response_model=List[QuestionOut])
def get_module_questions(
    module_id: UUID,
    include_all: bool = Query(False, description="Include all questions (for teachers viewing critiques)"),
    db: Session = Depends(get_db)
):
    """
    Get all ACTIVE questions for a module (this is the assignment).
    Students only see questions that have been approved by teachers.
    Use include_all=true to fetch all questions including inactive ones (for teacher views).
    """
    from app.crud.question import get_questions_by_status
    from app.models.question import QuestionStatus, Question

    module = get_module_by_id(db, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    if include_all:
        # Return all questions (for teachers viewing feedback critiques)
        questions = db.query(Question).filter(Question.module_id == module_id).all()
        print(f"📚 Teacher endpoint: Returning {len(questions)} total questions for module {module_id}")
        return questions
    else:
        # SECURITY: Only return active questions to students
        questions = get_questions_by_status(db, module_id, QuestionStatus.ACTIVE)
        print(f"🔒 Student endpoint: Returning {len(questions)} active questions for module {module_id}")
        return questions

# ❓ Get all questions for a document (assignment)
@router.get("/documents/{document_id}/questions", response_model=List[QuestionOut])
def get_assignment_questions(
    document_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Get all ACTIVE questions for a specific document/assignment.
    Students only see questions that have been approved by teachers.
    """
    from app.crud.document import get_document_by_id
    from app.models.question import Question, QuestionStatus

    document = get_document_by_id(db, str(document_id))
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # SECURITY: Only return active questions to students
    questions = db.query(Question).filter(
        Question.document_id == document_id,
        Question.status == QuestionStatus.ACTIVE
    ).order_by(Question.question_order.nulls_last(), Question.id).all()

    print(f"🔒 Student endpoint: Returning {len(questions)} active questions for document {document_id}")
    return questions

# ✅ Submit answer for a question with instant AI feedback
@router.post("/submit-answer")
def submit_student_answer(
    answer_data: StudentAnswerCreate,
    db: Session = Depends(get_db)
):
    """
    Submit student answer for a question with instant AI feedback on first attempt
    """
    from app.services.ai_feedback import AIFeedbackService
    from app.crud.question import get_question_by_id
    
    # Check if answer already exists for this attempt
    existing_answer = get_student_answer(
        db, answer_data.student_id, answer_data.question_id, answer_data.attempt
    )
    
    if existing_answer:
        # Update existing answer
        update_data = StudentAnswerUpdate(answer=answer_data.answer)
        updated_answer = update_student_answer(db, existing_answer.id, update_data)
        created_answer = updated_answer
    else:
        # Create new answer
        created_answer = create_student_answer(db, answer_data)
    
    # Get module settings to determine max attempts
    question = get_question_by_id(db, str(answer_data.question_id))
    if not question:
        return {
            "success": True,
            "answer": created_answer,
            "feedback": None,
            "message": "Answer submitted but question not found"
        }

    # SECURITY: Check if question is active before accepting answer
    from app.models.question import QuestionStatus
    if question.status != QuestionStatus.ACTIVE:
        raise HTTPException(
            status_code=403,
            detail="This question is not yet available. Please contact your teacher."
        )

    module_id = str(question.module_id)
    module = get_module_by_id(db, module_id)

    # Get max attempts from module settings (default to 2)
    max_attempts = 2
    if module and module.assignment_config:
        multiple_attempts_config = module.assignment_config.get("features", {}).get("multiple_attempts", {})
        max_attempts = multiple_attempts_config.get("max_attempts", 2)

    # Generate feedback for all attempts EXCEPT the final/last attempt
    # Example: max_attempts=2 → feedback on attempt 1, no feedback on attempt 2
    # Example: max_attempts=3 → feedback on attempts 1 and 2, no feedback on attempt 3
    should_generate_feedback = answer_data.attempt < max_attempts

    if should_generate_feedback:
        try:
            # Build progressive feedback context from previous attempts
            previous_feedback_context = None
            if answer_data.attempt > 1:
                from app.models.student_answer import StudentAnswer
                from app.crud.ai_feedback import get_feedback_by_answer

                prev_answers = db.query(StudentAnswer).filter(
                    StudentAnswer.student_id == answer_data.student_id,
                    StudentAnswer.question_id == answer_data.question_id,
                    StudentAnswer.attempt < answer_data.attempt
                ).order_by(StudentAnswer.attempt).all()

                if prev_answers:
                    previous_feedback_context = []
                    for prev in prev_answers:
                        fb = get_feedback_by_answer(db, prev.id)
                        if fb and fb.generation_status == 'completed' and fb.feedback_data:
                            previous_feedback_context.append({
                                "attempt": prev.attempt,
                                "ai_feedback": fb.feedback_data.get("explanation", ""),
                                "score": fb.score,
                                "student_answer": str(prev.answer)
                            })
                    if previous_feedback_context:
                        logger.info(f"📚 Built progressive context from {len(previous_feedback_context)} previous attempt(s) for question {answer_data.question_id}")
                    else:
                        previous_feedback_context = None

            # Generate AI feedback
            feedback_service = AIFeedbackService()
            feedback = feedback_service.generate_instant_feedback(
                db=db,
                student_answer=created_answer,
                question_id=str(answer_data.question_id),
                module_id=module_id,
                previous_feedback_context=previous_feedback_context
            )

            # Return enhanced response with feedback
            return {
                "success": True,
                "answer": {
                    "id": str(created_answer.id),
                    "student_id": created_answer.student_id,
                    "question_id": str(created_answer.question_id),
                    "document_id": str(created_answer.document_id),
                    "answer": created_answer.answer,
                    "attempt": created_answer.attempt,
                    "submitted_at": created_answer.submitted_at.isoformat()
                },
                "feedback": feedback,
                "attempt_number": answer_data.attempt,
                "can_retry": not feedback.get("is_correct", False) and answer_data.attempt < max_attempts,
                "max_attempts": max_attempts
            }

        except Exception as e:
            # If feedback generation fails, still return successful answer submission
            return {
                "success": True,
                "answer": created_answer,
                "feedback": None,
                "error": f"Answer submitted but feedback failed: {str(e)}"
            }

    else:
        # For final attempt, return result without feedback
        return {
            "success": True,
            "answer": created_answer,
            "attempt_number": answer_data.attempt,
            "max_attempts": max_attempts,
            "final_submission": True,
            "message": "Final answer submitted successfully"
        }

# 📊 Get student's answers for a document
@router.get("/documents/{document_id}/my-answers", response_model=List[StudentAnswerOut])
def get_my_answers(
    document_id: UUID,
    student_id: str = Query(..., description="Student ID"),
    attempt: int = Query(1, description="Attempt number", ge=1, le=5),
    db: Session = Depends(get_db)
):
    """
    Get student's submitted answers for a document
    """
    answers = get_student_answers_by_document(db, student_id, document_id, attempt)
    return answers

# 📈 Get student's progress for a document
@router.get("/documents/{document_id}/progress")
def get_assignment_progress(
    document_id: UUID,
    student_id: str = Query(..., description="Student ID"),
    attempt: int = Query(1, description="Attempt number", ge=1, le=5),
    db: Session = Depends(get_db)
):
    """
    Get student's progress for an assignment
    """
    progress = get_student_progress(db, student_id, document_id, attempt)
    return progress

# ✏️ Update student answer
@router.put("/answers/{answer_id}", response_model=StudentAnswerOut)
def update_my_answer(
    answer_id: UUID,
    answer_data: StudentAnswerUpdate,
    db: Session = Depends(get_db)
):
    """
    Update student's answer (only if not completed)
    """
    updated_answer = update_student_answer(db, answer_id, answer_data)
    if not updated_answer:
        raise HTTPException(status_code=404, detail="Answer not found")
    
    return updated_answer

# 🗑️ Delete student answer
@router.delete("/answers/{answer_id}")
def delete_my_answer(
    answer_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Delete student's answer (only if not completed)
    """
    deleted_answer = delete_student_answer(db, answer_id)
    if not deleted_answer:
        raise HTTPException(status_code=404, detail="Answer not found")
    
    return {"detail": "Answer deleted successfully"}

# 🎯 Get specific student answer
@router.get("/questions/{question_id}/my-answer")
def get_my_answer_for_question(
    question_id: UUID,
    student_id: str = Query(..., description="Student ID"),
    attempt: int = Query(1, description="Attempt number", ge=1, le=5),
    db: Session = Depends(get_db)
):
    """
    Get student's answer for a specific question
    """
    answer = get_student_answer(db, student_id, question_id, attempt)
    if not answer:
        return None
    return answer

# 📊 Get student's answers for a module (optimized batch loading)
@router.get("/modules/{module_id}/my-answers", response_model=List[StudentAnswerOut])
def get_my_module_answers(
    module_id: UUID,
    student_id: str = Query(..., description="Student ID"),
    attempt: int = Query(1, description="Attempt number", ge=1, le=5),
    db: Session = Depends(get_db)
):
    """
    Get all student's answers for a module in one request (performance optimized)
    """
    from app.models.student_answer import StudentAnswer
    from app.models.question import Question

    # Get all answers for this student in this module
    try:
        # Try new schema first (with module_id)
        answers = db.query(StudentAnswer).filter(
            StudentAnswer.student_id == student_id,
            StudentAnswer.module_id == module_id,
            StudentAnswer.attempt == attempt
        ).all()
    except Exception:
        # Fallback to old schema (via document_id)
        from app.models.document import Document
        answers = db.query(StudentAnswer).join(Question).join(Document).filter(
            StudentAnswer.student_id == student_id,
            Document.module_id == module_id,
            StudentAnswer.attempt == attempt
        ).all()

    return answers

# 📈 Get student's progress for a module
@router.get("/modules/{module_id}/progress")
def get_module_progress(
    module_id: UUID,
    student_id: str = Query(..., description="Student ID"),
    attempt: int = Query(1, description="Attempt number", ge=1, le=5),
    db: Session = Depends(get_db)
):
    """
    Get student's progress for all questions in a module
    """
    from app.crud.student_answer import get_student_progress_by_module

    progress = get_student_progress_by_module(db, student_id, module_id, attempt)
    return progress

# 🧠 Get all AI feedback for a student in a module
@router.get("/modules/{module_id}/feedback")
def get_module_feedback(
    module_id: UUID,
    student_id: str = Query(..., description="Student ID"),
    db: Session = Depends(get_db)
):
    """
    Get all AI feedback for a student in a module (student-friendly view)
    Returns filtered feedback without technical metadata, including teacher grades if available
    IMPORTANT: Also includes teacher-only grades (where teacher graded but no AI feedback exists)
    """
    from app.crud.ai_feedback import get_student_module_feedback
    from app.models.student_answer import StudentAnswer
    from app.models.teacher_grade import TeacherGrade
    from app.models.question import Question

    # Get all feedback for student
    feedback_list = get_student_module_feedback(db, student_id, module_id)

    # Track which answer_ids we've processed (to avoid duplicates)
    processed_answer_ids = set()

    # Transform to student-friendly format
    student_feedback = []
    for feedback in feedback_list:
        # Get the associated answer to find question_id
        answer = db.query(StudentAnswer).filter(StudentAnswer.id == feedback.answer_id).first()
        if not answer:
            continue

        processed_answer_ids.add(feedback.answer_id)

        # Check if teacher has graded this answer
        teacher_grade = db.query(TeacherGrade).filter(
            TeacherGrade.answer_id == feedback.answer_id
        ).first()

        # Extract only student-relevant fields from feedback_data
        data = feedback.feedback_data or {}

        student_view = {
            "id": str(feedback.id),
            "answer_id": str(feedback.answer_id),  # Include answer_id for frontend mapping
            "question_id": str(answer.question_id),
            "attempt": answer.attempt,  # Include attempt number for frontend grouping
            "is_correct": feedback.is_correct,
            "score": feedback.score,
            "correctness_score": feedback.score,  # Alias for frontend compatibility
            "explanation": data.get("explanation", ""),
            "improvement_hint": data.get("improvement_hint"),
            "concept_explanation": data.get("concept_explanation"),
            "strengths": data.get("strengths"),
            "weaknesses": data.get("weaknesses"),
            "generated_at": feedback.generated_at.isoformat() if feedback.generated_at else None,
            # Points and rubric-based scoring
            "points_earned": feedback.points_earned,
            "points_possible": feedback.points_possible,
            "criterion_scores": feedback.criterion_scores,  # Rubric breakdown
            # Only show RAG usage as boolean, not sources
            "has_course_materials": data.get("used_rag", False),
            # For MCQ, include answer info
            "selected_option": data.get("selected_option"),
            "correct_option": data.get("correct_option"),
            "available_options": data.get("available_options"),
            # For new question types, include grading details
            "grading_details": data.get("grading_details"),  # blank_results, sub_results, etc.
            "selected_options": data.get("selected_options"),  # For MCQ Multiple
            "sub_results": data.get("sub_results"),  # For Multi-Part
            # Teacher grade if available
            "teacher_grade": {
                "points_awarded": teacher_grade.points_awarded,
                "feedback_text": teacher_grade.feedback_text,
                "graded_at": teacher_grade.graded_at.isoformat() if teacher_grade.graded_at else None
            } if teacher_grade else None,
            "is_teacher_graded": teacher_grade is not None,
            # Generation status for polling
            "generation_status": feedback.generation_status,
            "generation_progress": feedback.generation_progress,
            "error_message": feedback.error_message,
            "can_retry": feedback.can_retry if feedback.generation_status in ['failed', 'timeout'] else False
        }

        student_feedback.append(student_view)

    # IMPORTANT: Also get teacher grades that don't have AI feedback yet
    # This happens when teacher manually grades without AI feedback being generated
    teacher_only_grades = db.query(TeacherGrade).filter(
        TeacherGrade.student_id == student_id,
        TeacherGrade.module_id == module_id,
        ~TeacherGrade.answer_id.in_(processed_answer_ids) if processed_answer_ids else True
    ).all()

    for teacher_grade in teacher_only_grades:
        # Get the answer and question details
        answer = db.query(StudentAnswer).filter(StudentAnswer.id == teacher_grade.answer_id).first()
        if not answer:
            continue

        question = db.query(Question).filter(Question.id == answer.question_id).first()
        if not question:
            continue

        # Create a feedback entry with only teacher grade (no AI feedback)
        student_view = {
            "id": None,  # No AI feedback ID
            "answer_id": str(answer.id),
            "question_id": str(answer.question_id),
            "attempt": answer.attempt,
            "is_correct": None,  # No AI feedback
            "score": None,
            "correctness_score": None,
            "explanation": "",
            "improvement_hint": None,
            "concept_explanation": None,
            "strengths": None,
            "weaknesses": None,
            "generated_at": None,
            "points_earned": None,  # AI didn't score this
            "points_possible": question.points,
            "criterion_scores": None,
            "has_course_materials": False,
            "selected_option": None,
            "correct_option": None,
            "available_options": None,
            "grading_details": None,
            "selected_options": None,
            "sub_results": None,
            # Teacher grade (the main data here)
            "teacher_grade": {
                "points_awarded": teacher_grade.points_awarded,
                "feedback_text": teacher_grade.feedback_text,
                "graded_at": teacher_grade.graded_at.isoformat() if teacher_grade.graded_at else None
            },
            "is_teacher_graded": True
        }

        student_feedback.append(student_view)

    return student_feedback

# 🧠 Get AI feedback for a specific question
@router.get("/questions/{question_id}/feedback")
def get_question_feedback(
    question_id: UUID,
    student_id: str = Query(..., description="Student ID"),
    attempt: int = Query(1, description="Attempt number", ge=1, le=5),
    db: Session = Depends(get_db)
):
    """
    Get AI feedback for a specific student's answer to a question
    """
    from app.crud.ai_feedback import get_feedback_by_answer

    # First get the student answer
    answer = get_student_answer(db, student_id, question_id, attempt)
    if not answer:
        raise HTTPException(status_code=404, detail="Answer not found")

    # Then get feedback for that answer
    feedback = get_feedback_by_answer(db, answer.id)
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")

    return feedback

# 📝 Save answer (for auto-save, without feedback generation)
@router.post("/save-answer")
def save_student_answer(
    answer_data: StudentAnswerCreate,
    db: Session = Depends(get_db)
):
    """
    Save student answer as draft (auto-save functionality).
    This does NOT generate feedback - it only saves the answer.

    VALIDATION: If answer is empty or whitespace-only, existing answer is deleted
    instead of saving empty data to the database.
    """
    # SECURITY: Verify question is active before allowing save
    from app.crud.question import get_question_by_id
    from app.models.question import QuestionStatus
    from app.crud.student_answer import delete_student_answer

    question = get_question_by_id(db, str(answer_data.question_id))
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    if question.status != QuestionStatus.ACTIVE:
        raise HTTPException(
            status_code=403,
            detail="This question is not yet available. Please contact your teacher."
        )

    # VALIDATION: Check if answer content is empty or whitespace-only
    answer_content = None
    is_empty = False

    if isinstance(answer_data.answer, dict):
        # Check for different answer formats based on question type
        if "blanks" in answer_data.answer:
            # Fill-in-the-Blank: Check if any blanks have non-empty values
            blanks = answer_data.answer.get("blanks", {})
            is_empty = not blanks or not any(str(v).strip() for v in blanks.values())
        elif "selected_options" in answer_data.answer:
            # MCQ Multiple: Check if array is non-empty
            selected_options = answer_data.answer.get("selected_options", [])
            is_empty = not selected_options or len(selected_options) == 0
        elif "sub_answers" in answer_data.answer:
            # Multi-Part: Check if any sub-answers have non-empty values
            sub_answers = answer_data.answer.get("sub_answers", {})
            is_empty = not sub_answers or len(sub_answers) == 0
        else:
            # Traditional answer formats (MCQ, Short, Long)
            answer_content = (
                answer_data.answer.get("text_response") or
                answer_data.answer.get("selected_option_id") or
                answer_data.answer.get("selected_option") or
                ""
            )
            is_empty = not answer_content or not str(answer_content).strip()
    elif isinstance(answer_data.answer, str):
        answer_content = answer_data.answer
        is_empty = not answer_content or not str(answer_content).strip()
    else:
        is_empty = True

    # Check if answer already exists for this attempt
    existing_answer = get_student_answer(
        db, answer_data.student_id, answer_data.question_id, answer_data.attempt
    )

    if is_empty:
        # If answer is empty/whitespace, delete existing record (if any)
        if existing_answer:
            delete_student_answer(db, existing_answer.id)
            logger.info(f"🗑️ Deleted empty answer for question {answer_data.question_id}, attempt {answer_data.attempt}")
            return {
                "success": True,
                "answer": None,
                "message": "Empty answer removed"
            }
        else:
            # No existing answer and new answer is empty - nothing to do
            logger.info(f"⏭️ Skipped saving empty answer for question {answer_data.question_id}")
            return {
                "success": True,
                "answer": None,
                "message": "Empty answer not saved"
            }

    # Answer has content - proceed with normal save logic
    if existing_answer:
        # Update existing answer
        update_data = StudentAnswerUpdate(answer=answer_data.answer)
        updated_answer = update_student_answer(db, existing_answer.id, update_data)
        return {
            "success": True,
            "answer": updated_answer,
            "message": "Answer saved as draft"
        }
    else:
        # Create new answer
        created_answer = create_student_answer(db, answer_data)
        return {
            "success": True,
            "answer": created_answer,
            "message": "Answer saved as draft"
        }

# 🎯 Submit entire test with feedback generation
@router.post("/modules/{module_id}/submit-test")
async def submit_test(
    module_id: UUID,
    request: Request,
    student_id: str = Query(..., description="Student ID"),
    attempt: int = Query(1, description="Attempt number", ge=1),
    db: Session = Depends(get_db)
):
    """
    Mark a test as submitted for a specific attempt.
    Creates a TestSubmission record and inserts FeedbackJob rows into the
    persistent job queue.  The background worker picks them up automatically.
    Accepts optional body: { previous_feedback_context: [...] } for progressive feedback.
    """
    # Parse optional request body for previous feedback context
    previous_feedback_context = None
    try:
        body = await request.json()
        if body and isinstance(body, dict):
            previous_feedback_context = body.get("previous_feedback_context")
            if previous_feedback_context:
                logger.info(f"Received previous_feedback_context with {len(previous_feedback_context)} attempt(s)")
    except Exception:
        pass

    from app.crud.test_submission import (
        create_submission,
        has_submitted_attempt,
        get_current_attempt_number
    )
    from app.models.student_answer import StudentAnswer

    # Check if already submitted
    if has_submitted_attempt(db, student_id, module_id, attempt):
        raise HTTPException(
            status_code=400,
            detail=f"Test already submitted for attempt {attempt}"
        )

    # Get module settings
    module = get_module_by_id(db, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    # Get max attempts from module settings
    max_attempts = 2
    if module.assignment_config:
        multiple_attempts_config = module.assignment_config.get("features", {}).get("multiple_attempts", {})
        max_attempts = multiple_attempts_config.get("max_attempts", 2)

    # Check if attempt number is valid
    if attempt > max_attempts:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {max_attempts} attempts allowed"
        )

    # Get all answers for this attempt
    answers = db.query(StudentAnswer).filter(
        StudentAnswer.student_id == student_id,
        StudentAnswer.module_id == module_id,
        StudentAnswer.attempt == attempt
    ).all()

    if not answers:
        raise HTTPException(
            status_code=400,
            detail="No answers found to submit"
        )

    # Create submission record
    submission = create_submission(
        db=db,
        student_id=student_id,
        module_id=module_id,
        attempt=attempt,
        questions_count=len(answers)
    )

    logger.info(f"Test submitted - {len(answers)} questions")

    # Enqueue feedback jobs ONLY if not final attempt
    if attempt < max_attempts:
        answer_ids = [str(answer.id) for answer in answers]
        logger.info(f"Enqueuing {len(answer_ids)} feedback jobs")

        for answer in answers:
            create_feedback_job(
                db=db,
                answer_id=answer.id,
                student_id=student_id,
                module_id=str(module_id),
                attempt=attempt,
                priority=1,
                previous_feedback_context=previous_feedback_context,
            )

        return {
            "success": True,
            "submission_id": str(submission.id),
            "attempt": attempt,
            "questions_submitted": len(answers),
            "answer_ids": answer_ids,
            "can_retry": True,
            "max_attempts": max_attempts,
            "feedback_status": "generating",
            "message": "Test submitted! Feedback is being generated in the background."
        }
    else:
        # Final attempt - no feedback
        return {
            "success": True,
            "submission_id": str(submission.id),
            "attempt": attempt,
            "questions_submitted": len(answers),
            "can_retry": False,
            "max_attempts": max_attempts,
            "feedback_status": "none",
            "message": "Final attempt submitted successfully!"
        }

# 📊 Get submission status for a student in a module
@router.get("/modules/{module_id}/submission-status")
def get_submission_status(
    module_id: UUID,
    student_id: str = Query(..., description="Student ID"),
    db: Session = Depends(get_db)
):
    """
    Get submission status for a student in a module.
    Returns which attempts have been submitted and current attempt number.
    """
    from app.crud.test_submission import (
        get_all_submissions,
        get_current_attempt_number,
        get_submission_count
    )

    # Get module settings for max attempts
    module = get_module_by_id(db, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    max_attempts = 2
    if module.assignment_config:
        multiple_attempts_config = module.assignment_config.get("features", {}).get("multiple_attempts", {})
        max_attempts = multiple_attempts_config.get("max_attempts", 2)

    # Get all submissions
    submissions = get_all_submissions(db, student_id, module_id)
    current_attempt = get_current_attempt_number(db, student_id, module_id)
    submission_count = get_submission_count(db, student_id, module_id)

    return {
        "student_id": student_id,
        "module_id": str(module_id),
        "submissions": [
            {
                "attempt": sub.attempt,
                "submitted_at": sub.submitted_at.isoformat(),
                "questions_count": sub.questions_count
            }
            for sub in submissions
        ],
        "current_attempt": current_attempt if current_attempt <= max_attempts else max_attempts,
        "submission_count": submission_count,
        "can_submit_again": submission_count < max_attempts,
        "max_attempts": max_attempts,
        "all_attempts_done": submission_count >= max_attempts
    }


# 🔄 Check feedback generation status (for real-time updates)
@router.get("/modules/{module_id}/feedback-status")
def get_feedback_status(
    module_id: UUID,
    student_id: str = Query(..., description="Student ID"),
    attempt: int = Query(1, description="Attempt number", ge=1),
    db: Session = Depends(get_db)
):
    """
    Check the status of feedback generation for a student's test submission.
    Uses the FeedbackJob queue as the source of truth.
    Returns which questions have feedback ready and which are still pending.
    """
    from app.models.student_answer import StudentAnswer
    from app.models.feedback_job import FeedbackJob
    from app.crud.ai_feedback import get_feedback_by_answer

    # Get all answers for this attempt
    answers = db.query(StudentAnswer).filter(
        StudentAnswer.student_id == student_id,
        StudentAnswer.module_id == module_id,
        StudentAnswer.attempt == attempt
    ).all()

    if not answers:
        return {
            "total_questions": 0,
            "feedback_ready": 0,
            "feedback_pending": 0,
            "questions": [],
            "all_complete": True
        }

    # Build answer_id set for quick lookup
    answer_ids = {answer.id for answer in answers}

    # Get all jobs for this student/module/attempt in one query
    jobs = db.query(FeedbackJob).filter(
        FeedbackJob.student_id == student_id,
        FeedbackJob.module_id == module_id,
        FeedbackJob.attempt == attempt,
    ).all()
    jobs_by_answer = {job.answer_id: job for job in jobs}

    feedback_status = []
    ready_count = 0
    queued_count = 0

    for answer in answers:
        feedback = get_feedback_by_answer(db, answer.id)
        job = jobs_by_answer.get(answer.id)

        is_completed = feedback is not None and feedback.generation_status == 'completed'

        if is_completed:
            # Check if this is a FALLBACK that should be upgraded with real AI
            is_fallback = (feedback.feedback_data or {}).get('fallback', False)
            if is_fallback:
                # Check if there's already an active job for this answer
                has_active_job = job and job.status in ('queued', 'processing')
                retries_exhausted = job and job.status == 'failed' and job.retry_count >= job.max_retries

                if retries_exhausted:
                    # All retries failed — accept fallback and stop polling
                    ready_count += 1
                elif not has_active_job:
                    # Enqueue an upgrade job
                    create_feedback_job(
                        db=db,
                        answer_id=answer.id,
                        student_id=student_id,
                        module_id=str(module_id),
                        attempt=attempt,
                        priority=1,
                    )
                    logger.info(f"Auto-upgrading fallback feedback for answer {answer.id}")
                # Don't count fallback as ready — keep polling until real AI replaces it
            else:
                ready_count += 1
        elif feedback and feedback.generation_status in ['failed', 'timeout']:
            # If no active job exists, enqueue a retry
            has_active_job = job and job.status in ('queued', 'processing')
            retries_exhausted = job and job.status == 'failed' and job.retry_count >= job.max_retries

            if retries_exhausted:
                # Accept as done — can't retry further
                ready_count += 1
            elif not has_active_job:
                create_feedback_job(
                    db=db,
                    answer_id=answer.id,
                    student_id=student_id,
                    module_id=str(module_id),
                    attempt=attempt,
                    priority=1,
                )
                queued_count += 1

        # Determine job status for this answer
        job_status = job.status if job else None
        is_fallback = is_completed and (feedback.feedback_data or {}).get('fallback', False)

        feedback_status.append({
            "question_id": str(answer.question_id),
            "answer_id": str(answer.id),
            "has_feedback": feedback is not None,
            "is_completed": is_completed and not is_fallback,
            "is_fallback": is_fallback,
            "generation_status": feedback.generation_status if feedback else None,
            "job_status": job_status,
            "feedback_id": str(feedback.id) if feedback else None,
        })

    total = len(answers)
    pending = total - ready_count
    all_complete = ready_count == total

    return {
        "total_questions": total,
        "feedback_ready": ready_count,
        "feedback_pending": pending,
        "progress_percentage": int((ready_count / total) * 100) if total > 0 else 0,
        "all_complete": all_complete,
        "auto_retried": queued_count,
        "questions": feedback_status,
    }

# 🧹 Cleanup stale feedback (called by frontend after timeout)
@router.post("/modules/{module_id}/cleanup-feedback")
def cleanup_stale_module_feedback(
    module_id: UUID,
    student_id: str = Query(..., description="Student ID"),
    db: Session = Depends(get_db)
):
    """
    Cleanup stale feedback that has been stuck in pending/generating status.
    Called by frontend when polling times out.

    Returns:
        Number of feedback rows marked as failed
    """
    from app.crud.ai_feedback import cleanup_stale_feedback, create_pending_feedback
    from app.models.student_answer import StudentAnswer
    from app.models.ai_feedback import AIFeedback

    logger.info(f"🧹 Cleanup requested for module {module_id}, student {student_id}")

    # First, check if feedback rows even exist
    answers = db.query(StudentAnswer).filter(
        StudentAnswer.student_id == student_id,
        StudentAnswer.module_id == module_id
    ).all()

    logger.info(f"📊 Found {len(answers)} answers for student")

    # Check which answers have feedback
    missing_feedback = []
    for answer in answers:
        feedback = db.query(AIFeedback).filter(AIFeedback.answer_id == answer.id).first()
        if not feedback:
            missing_feedback.append(answer.id)
            logger.warning(f"⚠️ Answer {answer.id} has no feedback row - creating failed placeholder")
            # Create a failed feedback row
            try:
                new_feedback = AIFeedback(
                    answer_id=answer.id,
                    generation_status='timeout',
                    generation_progress=0,
                    error_message="Feedback generation failed - no record found (background task may have crashed before starting)",
                    error_type='timeout',
                    feedback_data=None,
                    is_correct=None,
                    score=None,
                    can_retry=True,
                    retry_count=0
                )
                db.add(new_feedback)
            except Exception as e:
                logger.error(f"Failed to create placeholder feedback: {e}")

    if missing_feedback:
        try:
            db.commit()
            logger.info(f"✅ Created {len(missing_feedback)} placeholder feedback rows")
        except Exception as e:
            logger.error(f"Failed to commit placeholder feedback: {e}")
            db.rollback()

    # Now run the regular cleanup
    marked_failed = cleanup_stale_feedback(db, module_id, student_id)

    total_fixed = len(missing_feedback) + marked_failed
    if total_fixed > 0:
        logger.info(f"🧹 Cleanup: Fixed {total_fixed} feedback rows ({len(missing_feedback)} missing, {marked_failed} stale)")

    return {
        "success": True,
        "marked_failed": marked_failed,
        "created_placeholders": len(missing_feedback),
        "total_fixed": total_fixed,
        "message": f"Fixed {total_fixed} feedback rows"
    }


# 🔄 Regenerate all failed feedback for an attempt
@router.post("/modules/{module_id}/regenerate-all-feedback")
def regenerate_all_failed_feedback(
    module_id: UUID,
    student_id: str = Query(..., description="Student ID"),
    attempt: int = Query(..., description="Attempt number"),
    db: Session = Depends(get_db)
):
    """
    Regenerate all failed/timeout feedback for a specific attempt.
    Inserts new FeedbackJob rows — the worker picks them up automatically.
    """
    from app.models.student_answer import StudentAnswer
    from app.models.ai_feedback import AIFeedback

    logger.info(f"Regenerate all feedback requested for module {module_id}, student {student_id}, attempt {attempt}")

    # Get module to check max_attempts
    module = get_module_by_id(db, str(module_id))
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    max_attempts = 2
    if module.assignment_config:
        multiple_attempts_config = module.assignment_config.get("features", {}).get("multiple_attempts", {})
        max_attempts = multiple_attempts_config.get("max_attempts", 2)

    if attempt >= max_attempts:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot regenerate AI feedback for attempt {attempt}. This is the final attempt reserved for teacher manual grading. AI feedback is only available for attempts 1-{max_attempts - 1}."
        )

    # Find all answers for this attempt
    answers = db.query(StudentAnswer).filter(
        StudentAnswer.student_id == student_id,
        StudentAnswer.module_id == module_id,
        StudentAnswer.attempt == attempt
    ).all()

    if not answers:
        raise HTTPException(status_code=404, detail="No answers found for this attempt")

    # Find which ones have failed/timeout feedback and enqueue retry jobs
    failed_answer_ids = []
    for answer in answers:
        feedback = db.query(AIFeedback).filter(AIFeedback.answer_id == answer.id).first()
        if feedback and feedback.generation_status in ['failed', 'timeout']:
            # Reset the ai_feedback row so the worker can regenerate
            feedback.generation_status = 'pending'
            feedback.generation_progress = 0
            feedback.error_message = None
            feedback.error_type = None
            feedback.completed_at = None
            db.commit()

            create_feedback_job(
                db=db,
                answer_id=answer.id,
                student_id=student_id,
                module_id=str(module_id),
                attempt=attempt,
                priority=1,
            )
            failed_answer_ids.append(str(answer.id))

    if not failed_answer_ids:
        return {
            "success": True,
            "message": "No failed feedback found to retry",
            "total_answers": len(answers),
            "failed_count": 0,
            "retried_count": 0
        }

    logger.info(f"Enqueued {len(failed_answer_ids)} retry jobs")

    return {
        "success": True,
        "message": f"Enqueued {len(failed_answer_ids)} feedback retries",
        "total_answers": len(answers),
        "failed_count": len(failed_answer_ids),
        "retried_count": len(failed_answer_ids),
        "answer_ids": failed_answer_ids,
    }


# 💬 Submit or update feedback critique (student rates AI feedback)
@router.post("/feedback/{feedback_id}/critique")
def create_or_update_feedback_critique(
    feedback_id: UUID,
    student_id: str = Query(..., description="Student ID"),
    rating: int = Query(..., description="Rating from 1-5", ge=1, le=5),
    comment: str = Query(None, description="Optional comment"),
    feedback_type: str = Query(None, description="Category: helpful, not_helpful, incorrect, too_vague, too_harsh"),
    db: Session = Depends(get_db)
):
    """
    Allow students to rate and comment on AI-generated feedback.
    This helps improve feedback quality by collecting student opinions.
    If student has already critiqued this feedback, updates the existing critique.
    """
    from app.models.feedback_critique import FeedbackCritique
    from app.models.ai_feedback import AIFeedback

    # Verify feedback exists
    feedback = db.query(AIFeedback).filter(AIFeedback.id == feedback_id).first()
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")

    # Check if student has already critiqued this feedback
    existing_critique = db.query(FeedbackCritique).filter(
        FeedbackCritique.feedback_id == feedback_id,
        FeedbackCritique.student_id == student_id
    ).first()

    if existing_critique:
        # Update existing critique
        existing_critique.rating = rating
        existing_critique.comment = comment
        existing_critique.feedback_type = feedback_type
        from datetime import datetime, timezone
        existing_critique.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(existing_critique)

        logger.info(f"✏️ Student {student_id} updated critique for feedback {feedback_id}: {rating}/5")

        return {
            "success": True,
            "critique_id": str(existing_critique.id),
            "message": "Feedback critique updated successfully",
            "critique": {
                "id": str(existing_critique.id),
                "feedback_id": str(existing_critique.feedback_id),
                "rating": existing_critique.rating,
                "comment": existing_critique.comment,
                "feedback_type": existing_critique.feedback_type,
                "created_at": existing_critique.created_at.isoformat(),
                "updated_at": existing_critique.updated_at.isoformat()
            }
        }
    else:
        # Create new critique
        critique = FeedbackCritique(
            feedback_id=feedback_id,
            student_id=student_id,
            rating=rating,
            comment=comment,
            feedback_type=feedback_type
        )
        db.add(critique)
        db.commit()
        db.refresh(critique)

        logger.info(f"💬 Student {student_id} critiqued feedback {feedback_id}: {rating}/5")

        return {
            "success": True,
            "critique_id": str(critique.id),
            "message": "Feedback critique submitted successfully",
            "critique": {
                "id": str(critique.id),
                "feedback_id": str(critique.feedback_id),
                "rating": critique.rating,
                "comment": critique.comment,
                "feedback_type": critique.feedback_type,
                "created_at": critique.created_at.isoformat(),
                "updated_at": critique.updated_at.isoformat()
            }
        }

# 📊 Get feedback critique for a specific feedback
@router.get("/feedback/{feedback_id}/critique")
def get_feedback_critique(
    feedback_id: UUID,
    student_id: str = Query(..., description="Student ID"),
    db: Session = Depends(get_db)
):
    """
    Get student's critique of a specific feedback (if it exists)
    """
    from app.models.feedback_critique import FeedbackCritique

    critique = db.query(FeedbackCritique).filter(
        FeedbackCritique.feedback_id == feedback_id,
        FeedbackCritique.student_id == student_id
    ).first()

    if not critique:
        return {
            "has_critique": False,
            "critique": None
        }

    return {
        "has_critique": True,
        "critique": {
            "id": str(critique.id),
            "feedback_id": str(critique.feedback_id),
            "rating": critique.rating,
            "comment": critique.comment,
            "feedback_type": critique.feedback_type,
            "created_at": critique.created_at.isoformat(),
            "updated_at": critique.updated_at.isoformat()
        }
    }

# 📈 Get all feedback critiques for a module (for analytics/teacher view)
@router.get("/modules/{module_id}/feedback-critiques")
def get_module_feedback_critiques(
    module_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Get all feedback critiques for a module with complete context.
    Returns critiques with embedded feedback, student answer, and question data.
    """
    from app.models.feedback_critique import FeedbackCritique
    from app.models.ai_feedback import AIFeedback
    from app.models.student_answer import StudentAnswer
    from app.models.question import Question

    # Get all feedback for this module with joins
    feedbacks = db.query(AIFeedback).join(StudentAnswer).filter(
        StudentAnswer.module_id == module_id
    ).all()

    feedback_ids = [fb.id for fb in feedbacks]

    # Get all critiques for these feedbacks
    critiques = db.query(FeedbackCritique).filter(
        FeedbackCritique.feedback_id.in_(feedback_ids)
    ).all()

    # Calculate statistics
    total_critiques = len(critiques)
    if total_critiques == 0:
        return {
            "module_id": str(module_id),
            "total_critiques": 0,
            "average_rating": None,
            "rating_distribution": {1: 0, 2: 0, 3: 0, 4: 0, 5: 0},
            "feedback_types": {},
            "critiques": []
        }

    # Calculate statistics
    ratings = [c.rating for c in critiques]
    average_rating = sum(ratings) / len(ratings)

    rating_distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    for rating in ratings:
        rating_distribution[rating] += 1

    feedback_types = {}
    for critique in critiques:
        if critique.feedback_type:
            feedback_types[critique.feedback_type] = feedback_types.get(critique.feedback_type, 0) + 1

    # Build critiques with full context (feedback, answer, question)
    critiques_with_context = []
    for c in critiques:
        # Get the feedback
        feedback = db.query(AIFeedback).filter(AIFeedback.id == c.feedback_id).first()
        if not feedback:
            continue

        # Get the student answer
        answer = db.query(StudentAnswer).filter(StudentAnswer.id == feedback.answer_id).first()
        if not answer:
            continue

        # Get the question
        question = db.query(Question).filter(Question.id == answer.question_id).first()

        if not question:
            logger.warning(f"⚠️ Question not found for answer {answer.id}, question_id: {answer.question_id}")

        # Build feedback data
        feedback_data = feedback.feedback_data or {}

        critique_data = {
            "id": str(c.id),
            "feedback_id": str(c.feedback_id),
            "student_id": c.student_id,
            "rating": c.rating,
            "comment": c.comment,
            "feedback_type": c.feedback_type,
            "created_at": c.created_at.isoformat(),
            "updated_at": c.updated_at.isoformat(),
            # Embedded feedback details
            "feedback": {
                "id": str(feedback.id),
                "feedback_text": feedback_data.get("explanation", "") or feedback_data.get("feedback", ""),
                "is_correct": feedback.is_correct,
                "score": feedback.score,
                "points_earned": feedback.points_earned,
                "points_possible": feedback.points_possible
            },
            # Embedded student answer
            "answer": {
                "id": str(answer.id),
                "answer": answer.answer,
                "attempt": answer.attempt,
                "submitted_at": answer.submitted_at.isoformat()
            },
            # Embedded question
            "question": {
                "id": str(question.id),
                "text": question.text,
                "type": question.type,
                "options": question.options,
                "points": question.points
            } if question else {
                "id": str(answer.question_id),
                "text": "Question not found (may have been deleted)",
                "type": "unknown",
                "options": None,
                "points": 0
            }
        }

        logger.info(f"📦 Critique {c.id}: question={'found' if question else 'NOT FOUND'}, answer={answer.id}")
        critiques_with_context.append(critique_data)

    return {
        "module_id": str(module_id),
        "total_critiques": total_critiques,
        "total_feedbacks": len(feedbacks),
        "critique_rate": round((total_critiques / len(feedbacks) * 100), 1) if feedbacks else 0,
        "average_rating": round(average_rating, 2),
        "rating_distribution": rating_distribution,
        "feedback_types": feedback_types,
        "critiques": critiques_with_context
    }