from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List

from app.schemas.survey import (
    ModuleSurveyConfig,
    ModuleSurveyUpdate,
    SurveyResponseCreate,
    SurveyResponseOut,
    StudentSurveyView
)
from app.crud.survey_response import (
    get_survey_response,
    upsert_survey_response,
    get_module_survey_responses,
    has_submitted_survey
)
from app.crud.module import get_module_by_id
from app.database import get_db
from app.models.module import Module

router = APIRouter()


# ========================================
# TEACHER ENDPOINTS
# ========================================

@router.get("/modules/{module_id}/survey", response_model=ModuleSurveyConfig)
def get_module_survey_config(
    module_id: UUID,
    db: Session = Depends(get_db)
):
    """Get survey configuration for a module (teacher view)"""
    module = get_module_by_id(db, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    return ModuleSurveyConfig(
        survey_questions=module.survey_questions or [],
        survey_required=module.survey_required
    )


@router.put("/modules/{module_id}/survey", response_model=ModuleSurveyConfig)
def update_module_survey_config(
    module_id: UUID,
    survey_update: ModuleSurveyUpdate,
    db: Session = Depends(get_db)
):
    """Update survey configuration for a module (teacher endpoint)"""
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    # Update survey questions if provided
    if survey_update.survey_questions is not None:
        # Convert Pydantic models to dict for JSONB storage
        module.survey_questions = [q.dict() for q in survey_update.survey_questions]

    # Update survey required status if provided
    if survey_update.survey_required is not None:
        module.survey_required = survey_update.survey_required

    db.commit()
    db.refresh(module)

    print(f"✅ Updated survey config for module {module_id}")
    return ModuleSurveyConfig(
        survey_questions=module.survey_questions or [],
        survey_required=module.survey_required
    )


@router.get("/modules/{module_id}/survey/responses", response_model=List[SurveyResponseOut])
def get_all_survey_responses(
    module_id: UUID,
    db: Session = Depends(get_db)
):
    """Get all survey responses for a module (teacher view)"""
    # Verify module exists
    module = get_module_by_id(db, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    responses = get_module_survey_responses(db, module_id)
    print(f"📊 Retrieved {len(responses)} survey responses for module {module_id}")
    return responses


# ========================================
# STUDENT ENDPOINTS
# ========================================

@router.get("/student/modules/{module_id}/survey", response_model=StudentSurveyView)
def get_student_survey_view(
    module_id: UUID,
    student_id: str = Query(..., description="Student Banner ID"),
    db: Session = Depends(get_db)
):
    """Get survey for a student (includes questions and their response if exists)"""
    # Get module
    module = get_module_by_id(db, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    # Get student's existing response if any
    my_response = get_survey_response(db, student_id, module_id)
    has_submitted = my_response is not None

    my_response_pydantic = SurveyResponseOut.model_validate(my_response) if my_response else None

    return StudentSurveyView(
        survey_questions=module.survey_questions or [],
        survey_required=module.survey_required,
        my_response=my_response_pydantic,
        has_submitted=has_submitted
    )


@router.post("/student/modules/{module_id}/survey", response_model=SurveyResponseOut)
def submit_student_survey(
    module_id: UUID,
    student_id: str = Query(..., description="Student Banner ID"),
    response_data: SurveyResponseCreate = ...,
    db: Session = Depends(get_db)
):
    """Submit or update survey response (student endpoint)"""
    # Verify module exists
    module = get_module_by_id(db, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    # Validate that all required questions are answered
    survey_questions = module.survey_questions or []
    for question in survey_questions:
        if question.get('required', False):
            question_id = question.get('id')
            if not response_data.responses.get(question_id):
                raise HTTPException(
                    status_code=400,
                    detail=f"Required question '{question_id}' must be answered"
                )

    # Create or update response
    survey_response = upsert_survey_response(db, student_id, module_id, response_data)

    print(f"✅ Survey response saved for student {student_id} in module {module_id}")
    return survey_response


@router.get("/student/modules/{module_id}/survey/my-response", response_model=SurveyResponseOut)
def get_my_survey_response(
    module_id: UUID,
    student_id: str = Query(..., description="Student Banner ID"),
    db: Session = Depends(get_db)
):
    """Get student's own survey response"""
    response = get_survey_response(db, student_id, module_id)
    if not response:
        raise HTTPException(status_code=404, detail="Survey response not found")

    return response


@router.get("/student/modules/{module_id}/survey/status")
def check_survey_status(
    module_id: UUID,
    student_id: str = Query(..., description="Student Banner ID"),
    db: Session = Depends(get_db)
):
    """Check if student has submitted survey"""
    has_submitted = has_submitted_survey(db, student_id, module_id)
    return {
        "has_submitted": has_submitted,
        "student_id": student_id,
        "module_id": str(module_id)
    }
