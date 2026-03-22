from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional

from app.schemas.student_answer import StudentAnswerCreate, StudentAnswerOut, StudentAnswerUpdate
from app.schemas.feedback import AIFeedbackResponse
from app.crud.student_answer import (
    create_student_answer,
    get_student_answer_by_id,
    get_student_answers_by_module,
    update_student_answer,
    delete_student_answer,
    delete_student_assignment,
    get_student_answers_by_document,
    get_student_answer
)
from app.services.ai_feedback import AIFeedbackService
from app.database import get_db

router = APIRouter()

# Get all student answers with optional module filtering
@router.get("/", response_model=List[dict])
def get_all_student_answers(
    module_id: Optional[UUID] = Query(None, description="Filter by module ID"),
    question_id: Optional[UUID] = Query(None, description="Filter by question ID"),
    student_id: Optional[str] = Query(None, description="Filter by student ID"),
    db: Session = Depends(get_db)
):
    """
    Get all student answers, optionally filtered by module, question, or student
    """
    try:
        if module_id:
            # Get answers for specific module
            answers = get_student_answers_by_module(db, module_id)
            return answers
        else:
            # Get all answers (you might want to add pagination here)
            from app.models.student_answer import StudentAnswer
            from app.models.question import Question

            query = db.query(
                StudentAnswer,
                Question.text,
                Question.options,
                Question.correct_answer,
                Question.correct_option_id
            ).join(Question, StudentAnswer.question_id == Question.id)

            if student_id:
                query = query.filter(StudentAnswer.student_id == student_id)

            if question_id:
                query = query.filter(StudentAnswer.question_id == question_id)

            results = query.all()

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
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch student answers: {str(e)}")

# Get specific student answer by ID
@router.get("/{answer_id}", response_model=StudentAnswerOut)
def get_student_answer_by_id_route(
    answer_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Get a specific student answer by ID
    """
    answer = get_student_answer_by_id(db, answer_id)
    if not answer:
        raise HTTPException(status_code=404, detail="Student answer not found")
    return answer

# Create new student answer
@router.post("/")
def create_new_student_answer(
    answer_data: StudentAnswerCreate,
    generate_feedback: bool = Query(False, description="Automatically generate AI feedback"),
    db: Session = Depends(get_db)
):
    """
    Create a new student answer, optionally with AI feedback

    Args:
        answer_data: Student answer data
        generate_feedback: If True, automatically generates AI feedback for the answer
        db: Database session

    Returns:
        Dictionary containing:
        - answer: The created/updated student answer
        - feedback: AI feedback (if generate_feedback=True)
    """
    try:
        # Check if answer already exists for this attempt
        existing_answer = get_student_answer(
            db, answer_data.student_id, answer_data.question_id, answer_data.attempt
        )

        if existing_answer:
            # Update existing answer
            update_data = StudentAnswerUpdate(answer=answer_data.answer)
            saved_answer = update_student_answer(db, existing_answer.id, update_data)
        else:
            # Create new answer
            saved_answer = create_student_answer(db, answer_data)

        # Prepare response
        result = {
            "answer": {
                "id": str(saved_answer.id),
                "student_id": saved_answer.student_id,
                "question_id": str(saved_answer.question_id),
                "module_id": str(saved_answer.module_id),
                "document_id": str(saved_answer.document_id) if saved_answer.document_id else None,
                "answer": saved_answer.answer,
                "attempt": saved_answer.attempt,
                "submitted_at": saved_answer.submitted_at.isoformat()
            }
        }

        # Generate feedback if requested (typically for first attempt)
        if generate_feedback:
            try:
                feedback_service = AIFeedbackService()
                feedback = feedback_service.generate_instant_feedback(
                    db=db,
                    student_answer=saved_answer,
                    question_id=str(saved_answer.question_id),
                    module_id=str(saved_answer.module_id)
                )
                result["feedback"] = feedback
                result["feedback_generated"] = not feedback.get("error", False)

            except Exception as feedback_error:
                # Don't fail the entire request if feedback generation fails
                result["feedback"] = None
                result["feedback_generated"] = False
                result["feedback_error"] = str(feedback_error)

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create student answer: {str(e)}")

# Update student answer
@router.put("/{answer_id}", response_model=StudentAnswerOut)
def update_student_answer_route(
    answer_id: UUID,
    answer_data: StudentAnswerUpdate,
    db: Session = Depends(get_db)
):
    """
    Update a student answer
    """
    try:
        updated_answer = update_student_answer(db, answer_id, answer_data)
        if not updated_answer:
            raise HTTPException(status_code=404, detail="Student answer not found")
        return updated_answer
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update student answer: {str(e)}")

# Delete specific student answer
@router.delete("/{answer_id}")
def delete_student_answer_route(
    answer_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Delete a specific student answer
    """
    try:
        deleted_answer = delete_student_answer(db, answer_id)
        if not deleted_answer:
            raise HTTPException(status_code=404, detail="Student answer not found")
        return {"detail": "Student answer deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete student answer: {str(e)}")

# Delete all data for a student in a module (delete student from module)
@router.delete("/modules/{module_id}/students/{student_id}")
def delete_student_assignment_route(
    module_id: UUID,
    student_id: str,
    db: Session = Depends(get_db)
):
    """
    Delete all data for a student in a specific module including:
    - Student answers and AI feedback
    - Student enrollment
    - Survey responses
    - Test submissions
    - Chat conversations
    """
    try:
        deleted_count = delete_student_assignment(db, student_id, module_id)
        if deleted_count == 0:
            raise HTTPException(status_code=404, detail="No data found for this student in this module")
        return {"detail": f"Successfully deleted all data for student {student_id} from module ({deleted_count} records removed)"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete student data: {str(e)}")

# Get student answers for a specific document
@router.get("/documents/{document_id}")
def get_student_answers_by_document_route(
    document_id: UUID,
    student_id: Optional[str] = Query(None, description="Filter by student ID"),
    attempt: int = Query(1, description="Attempt number", ge=1, le=5),
    db: Session = Depends(get_db)
):
    """
    Get student answers for a specific document
    """
    try:
        if student_id:
            answers = get_student_answers_by_document(db, student_id, document_id, attempt)
        else:
            # Get all answers for this document
            from app.models.student_answer import StudentAnswer
            answers = db.query(StudentAnswer).filter(
                StudentAnswer.document_id == document_id,
                StudentAnswer.attempt == attempt
            ).all()

        return answers
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch student answers: {str(e)}")


# Generate AI feedback for a student answer
@router.post("/{answer_id}/feedback", response_model=AIFeedbackResponse)
def generate_feedback_for_answer(
    answer_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Generate AI feedback for a specific student answer using rubric and RAG

    This endpoint:
    1. Retrieves the student answer from the database
    2. Loads the module's rubric configuration
    3. Retrieves relevant course material context (RAG)
    4. Builds a dynamic prompt based on rubric settings
    5. Calls OpenAI API to generate feedback
    6. Returns structured feedback with scores and explanations
    """
    try:
        # Get the student answer
        answer = get_student_answer_by_id(db, answer_id)
        if not answer:
            raise HTTPException(status_code=404, detail="Student answer not found")

        # Initialize AI feedback service
        feedback_service = AIFeedbackService()

        # Generate feedback with rubric and RAG integration
        feedback = feedback_service.generate_instant_feedback(
            db=db,
            student_answer=answer,
            question_id=str(answer.question_id),
            module_id=str(answer.module_id)
        )

        # Check for errors
        if feedback.get("error"):
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate feedback: {feedback.get('message', 'Unknown error')}"
            )

        return feedback

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate feedback: {str(e)}"
        )


# Get feedback for all answers in a module (batch)
@router.post("/modules/{module_id}/feedback/batch")
def generate_batch_feedback(
    module_id: UUID,
    student_id: Optional[str] = Query(None, description="Filter by student ID"),
    attempt: int = Query(1, description="Attempt number", ge=1, le=5),
    db: Session = Depends(get_db)
):
    """
    Generate feedback for multiple student answers in a module (batch operation)
    Useful for generating feedback for all students after they submit
    """
    try:
        # Get all answers for this module
        from app.models.student_answer import StudentAnswer
        query = db.query(StudentAnswer).filter(
            StudentAnswer.module_id == module_id,
            StudentAnswer.attempt == attempt
        )

        if student_id:
            query = query.filter(StudentAnswer.student_id == student_id)

        answers = query.all()

        if not answers:
            return {
                "message": "No answers found",
                "feedback_generated": 0,
                "results": []
            }

        # Generate feedback for each answer
        feedback_service = AIFeedbackService()
        results = []
        success_count = 0

        for answer in answers:
            try:
                feedback = feedback_service.generate_instant_feedback(
                    db=db,
                    student_answer=answer,
                    question_id=str(answer.question_id),
                    module_id=str(answer.module_id)
                )

                results.append({
                    "answer_id": str(answer.id),
                    "student_id": answer.student_id,
                    "question_id": str(answer.question_id),
                    "success": not feedback.get("error", False),
                    "feedback": feedback
                })

                if not feedback.get("error"):
                    success_count += 1

            except Exception as e:
                results.append({
                    "answer_id": str(answer.id),
                    "student_id": answer.student_id,
                    "question_id": str(answer.question_id),
                    "success": False,
                    "error": str(e)
                })

        return {
            "message": f"Generated feedback for {success_count}/{len(answers)} answers",
            "feedback_generated": success_count,
            "total_answers": len(answers),
            "results": results
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate batch feedback: {str(e)}"
        )


# ==================== TEACHER GRADING ENDPOINTS ====================

@router.get("/module/{module_id}/final-submissions")
def get_final_submissions_for_grading(
    module_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Get all LAST attempt submissions for a module that need teacher grading.
    Returns the most recent attempt for each student per question, regardless of max_attempts setting.
    """
    from app.models.student_answer import StudentAnswer
    from app.models.question import Question
    from app.models.ai_feedback import AIFeedback
    from app.models.teacher_grade import TeacherGrade
    from app.models.module import Module

    # Get module
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    # Get max_attempts from module config
    max_attempts = 2  # default
    if module.assignment_config:
        max_attempts = module.assignment_config.get('features', {}).get('multiple_attempts', {}).get('max_attempts', 2)

    # Get all answers for this module
    all_answers = db.query(StudentAnswer).filter(
        StudentAnswer.module_id == module_id
    ).all()

    # Group by (student_id, question_id) and keep only the highest attempt
    answer_map = {}
    for answer in all_answers:
        key = (answer.student_id, str(answer.question_id))
        if key not in answer_map or answer.attempt > answer_map[key].attempt:
            answer_map[key] = answer

    # Group answers by student to check completeness and max attempts
    student_answers = {}
    for key, answer in answer_map.items():
        student_id, question_id = key
        if student_id not in student_answers:
            student_answers[student_id] = []
        student_answers[student_id].append(answer)

    # Filter to only include students who have:
    # Used all their allowed attempts (attempt number == max_attempts)
    # Note: Students don't need to answer ALL questions - just need to have completed their last attempt
    complete_students = []
    for student_id, answers in student_answers.items():
        # Check if all answers are at the max attempt level
        # (student has exhausted all their attempts)
        all_at_max_attempt = all(ans.attempt == max_attempts for ans in answers)

        if all_at_max_attempt:
            complete_students.extend(answers)

    # Get the final answers (only from students who completed their last attempt)
    final_answers = complete_students

    results = []
    for answer in final_answers:
        # Get question details
        question = db.query(Question).filter(Question.id == answer.question_id).first()
        if not question:
            continue

        # Get AI feedback (if exists from previous attempts)
        ai_feedback = db.query(AIFeedback).filter(
            AIFeedback.answer_id == answer.id
        ).first()

        # Check if teacher has already graded this
        teacher_grade = db.query(TeacherGrade).filter(
            TeacherGrade.answer_id == answer.id
        ).first()

        results.append({
            "answer_id": str(answer.id),
            "student_id": answer.student_id,
            "question_id": str(question.id),
            "question_text": question.text,
            "question_type": question.type,
            "question_points": question.points,
            "question_options": question.options,  # Include options for MCQ display
            "question_extended_config": question.extended_config,  # For multi-part and other complex types
            "correct_answer": question.correct_option_id or question.correct_answer,  # For MCQ - correct option ID
            "student_answer": answer.answer,
            "attempt": answer.attempt,  # Include the attempt number
            "submitted_at": answer.submitted_at.isoformat() if answer.submitted_at else None,
            "ai_suggested_score": ai_feedback.points_earned if ai_feedback else None,
            "ai_feedback": ai_feedback.feedback_data if ai_feedback else None,
            "ai_feedback_explanation": (ai_feedback.feedback_data or {}).get("explanation") if ai_feedback else None,
            "released": ai_feedback.released if ai_feedback else True,
            "requires_teacher_review": ai_feedback.requires_teacher_review if ai_feedback else False,
            "ai_generation_status": ai_feedback.generation_status if ai_feedback else None,
            "teacher_grade": {
                "points_awarded": teacher_grade.points_awarded,
                "feedback_text": teacher_grade.feedback_text,
                "graded_by": teacher_grade.graded_by,
                "graded_at": teacher_grade.graded_at.isoformat()
            } if teacher_grade else None,
            "is_graded": teacher_grade is not None
        })

    return {
        "module_id": str(module_id),
        "total_submissions": len(results),
        "graded_count": sum(1 for r in results if r["is_graded"]),
        "ungraded_count": sum(1 for r in results if not r["is_graded"]),
        "submissions": results
    }


@router.post("/teacher-grade")
def create_or_update_teacher_grade(
    answer_id: UUID = Query(..., description="Student answer ID"),
    points_awarded: float = Query(..., description="Points awarded by teacher"),
    feedback_text: Optional[str] = Query(None, description="Teacher's feedback"),
    teacher_id: str = Query(..., description="Teacher user ID"),
    db: Session = Depends(get_db)
):
    """
    Create or update a teacher grade for a student answer.
    This takes precedence over AI-generated grades.
    """
    from app.models.student_answer import StudentAnswer
    from app.models.question import Question
    from app.models.ai_feedback import AIFeedback
    from app.models.teacher_grade import TeacherGrade
    import uuid

    # Get the student answer
    answer = db.query(StudentAnswer).filter(StudentAnswer.id == answer_id).first()
    if not answer:
        raise HTTPException(status_code=404, detail="Student answer not found")

    # Get the question to validate points
    question = db.query(Question).filter(Question.id == answer.question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    # Validate points don't exceed maximum
    if points_awarded > question.points:
        raise HTTPException(
            status_code=400,
            detail=f"Points awarded ({points_awarded}) cannot exceed question points ({question.points})"
        )

    if points_awarded < 0:
        raise HTTPException(status_code=400, detail="Points awarded cannot be negative")

    # Get AI suggested score if exists
    ai_feedback = db.query(AIFeedback).filter(AIFeedback.answer_id == answer_id).first()
    ai_suggested_score = ai_feedback.points_earned if ai_feedback else None

    # Check if teacher grade already exists
    teacher_grade = db.query(TeacherGrade).filter(TeacherGrade.answer_id == answer_id).first()

    if teacher_grade:
        # Update existing grade
        teacher_grade.points_awarded = points_awarded
        teacher_grade.feedback_text = feedback_text
        teacher_grade.ai_suggested_score = ai_suggested_score
        teacher_grade.overridden_ai = (ai_suggested_score is not None and
                                       abs(points_awarded - ai_suggested_score) > 0.01)
        teacher_grade.graded_by = teacher_id
        # graded_at will auto-update if you have onupdate set, otherwise update manually
    else:
        # Create new grade
        teacher_grade = TeacherGrade(
            id=uuid.uuid4(),
            answer_id=answer_id,
            student_id=answer.student_id,
            question_id=answer.question_id,
            module_id=answer.module_id,
            points_awarded=points_awarded,
            feedback_text=feedback_text,
            ai_suggested_score=ai_suggested_score,
            overridden_ai=(ai_suggested_score is not None and
                          abs(points_awarded - ai_suggested_score) > 0.01),
            graded_by=teacher_id
        )
        db.add(teacher_grade)

    db.commit()
    db.refresh(teacher_grade)

    return {
        "success": True,
        "grade_id": str(teacher_grade.id),
        "answer_id": str(answer_id),
        "points_awarded": points_awarded,
        "points_possible": question.points,
        "ai_suggested_score": ai_suggested_score,
        "overridden_ai": teacher_grade.overridden_ai,
        "graded_by": teacher_id,
        "graded_at": teacher_grade.graded_at.isoformat()
    }


@router.get("/teacher-grade/{answer_id}")
def get_teacher_grade(
    answer_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Get teacher grade for a specific student answer.
    """
    from app.models.teacher_grade import TeacherGrade

    teacher_grade = db.query(TeacherGrade).filter(
        TeacherGrade.answer_id == answer_id
    ).first()

    if not teacher_grade:
        raise HTTPException(status_code=404, detail="Teacher grade not found")

    return {
        "grade_id": str(teacher_grade.id),
        "answer_id": str(teacher_grade.answer_id),
        "student_id": teacher_grade.student_id,
        "question_id": str(teacher_grade.question_id),
        "module_id": str(teacher_grade.module_id),
        "points_awarded": teacher_grade.points_awarded,
        "feedback_text": teacher_grade.feedback_text,
        "ai_suggested_score": teacher_grade.ai_suggested_score,
        "overridden_ai": teacher_grade.overridden_ai,
        "graded_by": teacher_grade.graded_by,
        "graded_at": teacher_grade.graded_at.isoformat()
    }


@router.post("/review/release")
def release_final_feedback(
    answer_id: UUID = Query(..., description="Student answer ID"),
    teacher_id: str = Query(..., description="Teacher user ID"),
    feedback_text: Optional[str] = Query(None, description="Teacher's feedback (overrides AI)"),
    points_awarded: Optional[float] = Query(None, description="Points awarded (overrides AI)"),
    db: Session = Depends(get_db)
):
    """
    Release final-attempt feedback to the student.
    - If feedback_text / points_awarded provided: saves a TeacherGrade and releases.
    - Otherwise: approves the AI draft as-is and releases.
    """
    from app.models.ai_feedback import AIFeedback
    from app.models.student_answer import StudentAnswer
    from app.models.question import Question
    from app.models.teacher_grade import TeacherGrade
    import uuid as _uuid

    answer = db.query(StudentAnswer).filter(StudentAnswer.id == answer_id).first()
    if not answer:
        raise HTTPException(status_code=404, detail="Answer not found")

    ai_feedback = db.query(AIFeedback).filter(AIFeedback.answer_id == answer_id).first()
    if not ai_feedback:
        raise HTTPException(status_code=404, detail="No AI feedback found for this answer")

    if not ai_feedback.requires_teacher_review:
        raise HTTPException(status_code=400, detail="This answer does not require teacher review")

    question = db.query(Question).filter(Question.id == answer.question_id).first()

    # Validate points
    if points_awarded is not None:
        max_pts = question.points if question else float('inf')
        if points_awarded < 0 or points_awarded > max_pts:
            raise HTTPException(
                status_code=400,
                detail=f"Points ({points_awarded}) must be between 0 and {max_pts}"
            )

    ai_suggested = ai_feedback.points_earned

    # Create or update TeacherGrade if teacher provided custom values
    has_overrides = feedback_text is not None or points_awarded is not None
    if has_overrides:
        final_points = points_awarded if points_awarded is not None else (ai_suggested or 0)
        teacher_grade = db.query(TeacherGrade).filter(TeacherGrade.answer_id == answer_id).first()

        if teacher_grade:
            teacher_grade.points_awarded = final_points
            if feedback_text is not None:
                teacher_grade.feedback_text = feedback_text
            teacher_grade.ai_suggested_score = ai_suggested
            teacher_grade.overridden_ai = (
                ai_suggested is not None and abs(final_points - ai_suggested) > 0.01
            )
            teacher_grade.graded_by = teacher_id
        else:
            teacher_grade = TeacherGrade(
                id=_uuid.uuid4(),
                answer_id=answer_id,
                student_id=answer.student_id,
                question_id=answer.question_id,
                module_id=answer.module_id,
                points_awarded=final_points,
                feedback_text=feedback_text,
                ai_suggested_score=ai_suggested,
                overridden_ai=(
                    ai_suggested is not None and abs(final_points - ai_suggested) > 0.01
                ),
                graded_by=teacher_id,
            )
            db.add(teacher_grade)

    # Release the feedback
    ai_feedback.released = True
    db.commit()

    return {
        "success": True,
        "answer_id": str(answer_id),
        "released": True,
        "has_teacher_grade": has_overrides,
    }


@router.post("/review/release-bulk")
def release_final_feedback_bulk(
    module_id: UUID = Query(..., description="Module ID"),
    student_id: str = Query(..., description="Student ID"),
    teacher_id: str = Query(..., description="Teacher user ID"),
    db: Session = Depends(get_db)
):
    """
    Approve and release ALL pending-review final-attempt feedback for one student in a module.
    Use this when the teacher wants to approve all AI drafts without changes.
    """
    from app.models.ai_feedback import AIFeedback
    from app.models.student_answer import StudentAnswer

    unreleased = (
        db.query(AIFeedback)
        .join(StudentAnswer, AIFeedback.answer_id == StudentAnswer.id)
        .filter(
            StudentAnswer.student_id == student_id,
            StudentAnswer.module_id == module_id,
            AIFeedback.requires_teacher_review == True,
            AIFeedback.released == False,
            AIFeedback.generation_status == 'completed',
        )
        .all()
    )

    for fb in unreleased:
        fb.released = True

    if unreleased:
        db.commit()

    return {
        "success": True,
        "released_count": len(unreleased),
        "module_id": str(module_id),
        "student_id": student_id,
    }


@router.get("/teacher-grades/module/{module_id}/student/{student_id}")
def get_teacher_grades_for_student(
    module_id: UUID,
    student_id: str,
    db: Session = Depends(get_db)
):
    """
    Get all teacher grades for a specific student in a module.
    Returns teacher grades with question details and answer information.
    """
    from app.models.teacher_grade import TeacherGrade
    from app.models.question import Question
    from app.models.student_answer import StudentAnswer

    # Get all teacher grades for this student in this module
    teacher_grades = db.query(TeacherGrade).filter(
        TeacherGrade.module_id == module_id,
        TeacherGrade.student_id == student_id
    ).all()

    results = []
    for grade in teacher_grades:
        # Get question details
        question = db.query(Question).filter(Question.id == grade.question_id).first()

        # Get the student answer
        answer = db.query(StudentAnswer).filter(StudentAnswer.id == grade.answer_id).first()

        results.append({
            "grade_id": str(grade.id),
            "answer_id": str(grade.answer_id),
            "question_id": str(grade.question_id),
            "question_text": question.text if question else None,
            "question_type": question.type if question else None,
            "question_points": question.points if question else None,
            "student_answer": answer.answer if answer else None,
            "attempt": answer.attempt if answer else None,
            "points_awarded": grade.points_awarded,
            "feedback_text": grade.feedback_text,
            "ai_suggested_score": grade.ai_suggested_score,
            "overridden_ai": grade.overridden_ai,
            "graded_by": grade.graded_by,
            "graded_at": grade.graded_at.isoformat() if grade.graded_at else None
        })

    return {
        "module_id": str(module_id),
        "student_id": student_id,
        "total_grades": len(results),
        "grades": results
    }

