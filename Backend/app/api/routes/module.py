from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Dict, Any
from datetime import datetime, timezone

from app.schemas.module import ModuleCreate, ModuleOut, ConsentFormUpdate
from app.schemas.student_enrollment import WaiverStatusUpdate
from app.crud.module import (
    create_module,
    get_module_by_id,
    get_modules_by_teacher,
    delete_module,
    update_module,
    get_all_modules
)
from app.services.module import delete_module_with_documents
from app.services.rubric import (
    get_module_rubric,
    update_module_rubric,
    apply_template_to_module,
    get_available_templates,
    validate_rubric,
    get_rubric_summary
)
from app.database import get_db

router = APIRouter()

def validate_assignment_config(config: Dict[str, Any]) -> List[str]:
    """Validate assignment configuration and return list of errors"""
    errors = []
    
    if not config or "features" not in config:
        return errors  # Use defaults if no config provided
    
    features = config.get("features", {})
    
    # Validate multiple attempts
    if features.get("multiple_attempts", {}).get("enabled", False):
        max_attempts = features["multiple_attempts"].get("max_attempts", 2)
        if not isinstance(max_attempts, int) or max_attempts < 1 or max_attempts > 5:
            errors.append("Max attempts must be between 1 and 5")
    
    # Validate mastery learning
    if features.get("mastery_learning", {}).get("enabled", False):
        streak_required = features["mastery_learning"].get("streak_required", 3)
        if not isinstance(streak_required, int) or streak_required < 1 or streak_required > 10:
            errors.append("Streak required must be between 1 and 10")
    
    # Validate chatbot feedback
    if features.get("chatbot_feedback", {}).get("enabled", False):
        conversation_mode = features["chatbot_feedback"].get("conversation_mode", "guided")
        ai_model = features["chatbot_feedback"].get("ai_model", "gpt-4")
        
        if conversation_mode not in ["guided", "free_form"]:
            errors.append("Conversation mode must be 'guided' or 'free_form'")
        
        if ai_model not in ["gpt-4", "gpt-3.5"]:
            errors.append("AI model must be 'gpt-4' or 'gpt-3.5'")
    
    return errors

# 🔍 Get all modules (admin-level or dashboard-level use)
@router.get("/modules/all", response_model=List[ModuleOut])
def list_all_modules(db: Session = Depends(get_db)):
    return get_all_modules(db)

# 🔍 List modules by teacher
@router.get("/modules", response_model=List[ModuleOut])
def list_modules(teacher_id: str = Query(...), db: Session = Depends(get_db)):
    return get_modules_by_teacher(db, teacher_id)

# 🔍 Get single module by ID
@router.get("/modules/{module_id}", response_model=ModuleOut)
def get_single_module(module_id: UUID, db: Session = Depends(get_db)):
    module = get_module_by_id(db, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    return module

# ➕ Create new module
@router.post("/modules", response_model=ModuleOut)
def create_new_module(payload: ModuleCreate, db: Session = Depends(get_db)):
    try:
        # Validate assignment configuration
        if payload.assignment_config:
            validation_errors = validate_assignment_config(payload.assignment_config)
            if validation_errors:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Invalid assignment configuration: {'; '.join(validation_errors)}"
                )
        
        return create_module(db, payload)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create module: {str(e)}")

# 🖊️ Update existing module
@router.put("/modules/{module_id}", response_model=ModuleOut)
def update_existing_module(module_id: UUID, payload: ModuleCreate, db: Session = Depends(get_db)):
    try:
        # Validate assignment configuration
        if payload.assignment_config:
            validation_errors = validate_assignment_config(payload.assignment_config)
            if validation_errors:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Invalid assignment configuration: {'; '.join(validation_errors)}"
                )
        
        updated = update_module(db, module_id, payload)
        if not updated:
            raise HTTPException(status_code=404, detail="Module not found")
        return updated
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update module: {str(e)}")

# ❌ Delete module and all associated data
@router.delete("/modules/{module_id}")
def remove_module(module_id: UUID, db: Session = Depends(get_db)):
    try:
        success = delete_module_with_documents(db, str(module_id))
        if not success:
            raise HTTPException(status_code=404, detail="Module not found")
        return {"detail": "Module and all associated data (documents, questions, student answers, enrollments) deleted successfully."}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        _logger.error(f"Error deleting module {module_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete module: {str(e)}")

# 🔄 Regenerate access code for module
@router.post("/modules/{module_id}/regenerate-code", response_model=ModuleOut)
def regenerate_access_code(module_id: UUID, db: Session = Depends(get_db)):
    """
    Regenerate a new access code for the module
    """
    import secrets

    module = get_module_by_id(db, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    # Generate new access code (uppercase for consistency and readability)
    new_access_code = secrets.token_hex(3).upper()  # 6-character uppercase hex code

    # Update module with new access code
    module.access_code = new_access_code
    db.commit()
    db.refresh(module)

    return module

# 📋 Get module rubric configuration
@router.get("/modules/{module_id}/rubric")
def get_rubric(module_id: UUID, db: Session = Depends(get_db)):
    """
    Get the feedback rubric configuration for a module
    """
    try:
        rubric = get_module_rubric(db, str(module_id))
        summary = get_rubric_summary(rubric)

        return {
            "module_id": str(module_id),
            "rubric": rubric,
            "summary": summary
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get rubric: {str(e)}")

# 🖊️ Update module rubric
@router.put("/modules/{module_id}/rubric")
def update_rubric(
    module_id: UUID,
    rubric_config: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """
    Update the feedback rubric configuration for a module
    """
    try:
        updated_module = update_module_rubric(db, str(module_id), rubric_config)
        rubric = get_module_rubric(db, str(module_id))

        return {
            "success": True,
            "message": "Rubric updated successfully",
            "module_id": str(updated_module.id),
            "rubric": rubric
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update rubric: {str(e)}")

# 📑 List available rubric templates
@router.get("/rubric-templates")
def list_rubric_templates():
    """
    Get list of available rubric templates
    """
    try:
        templates = get_available_templates()
        return {
            "templates": templates,
            "count": len(templates)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list templates: {str(e)}")

# 🔄 Apply rubric template to module
@router.post("/modules/{module_id}/rubric/apply-template")
def apply_rubric_template(
    module_id: UUID,
    template_name: str = Query(..., description="Template name to apply"),
    preserve_custom_instructions: bool = Query(True, description="Keep existing custom instructions"),
    db: Session = Depends(get_db)
):
    """
    Apply a rubric template to a module
    """
    try:
        updated_module = apply_template_to_module(
            db,
            str(module_id),
            template_name,
            preserve_custom_instructions
        )
        rubric = get_module_rubric(db, str(module_id))

        return {
            "success": True,
            "message": f"Template '{template_name}' applied successfully",
            "module_id": str(updated_module.id),
            "rubric": rubric
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to apply template: {str(e)}")

# ✅ Validate rubric configuration
@router.post("/rubric/validate")
def validate_rubric_config(rubric_config: Dict[str, Any]):
    """
    Validate a rubric configuration without saving
    """
    try:
        errors = validate_rubric(rubric_config)

        return {
            "valid": len(errors) == 0,
            "errors": errors
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")

# 📝 Update module consent form
@router.put("/modules/{module_id}/consent-form")
def update_consent_form(
    module_id: UUID,
    payload: ConsentFormUpdate,
    db: Session = Depends(get_db)
):
    """
    Update the consent form text for a module (teacher only)
    """
    try:
        module = get_module_by_id(db, module_id)
        if not module:
            raise HTTPException(status_code=404, detail="Module not found")

        # Update consent form text if provided
        if payload.consent_form_text is not None:
            module.consent_form_text = payload.consent_form_text

        # Update consent required setting
        module.consent_required = payload.consent_required

        db.commit()
        db.refresh(module)

        return {
            "success": True,
            "message": "Consent form updated successfully",
            "module_id": str(module.id),
            "consent_required": module.consent_required
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update consent form: {str(e)}")

# 📋 Get consent status for a student in a module
@router.get("/modules/{module_id}/consent/{student_id}")
def get_student_consent_status(
    module_id: UUID,
    student_id: str,
    db: Session = Depends(get_db)
):
    """
    Check if a student has submitted consent for a module
    """
    from app.models.student_enrollment import StudentEnrollment

    enrollment = db.query(StudentEnrollment).filter(
        StudentEnrollment.module_id == module_id,
        StudentEnrollment.student_id == student_id
    ).first()

    if not enrollment:
        return {
            "has_consented": False,
            "consent_status": None,
            "is_enrolled": False
        }

    return {
        "has_consented": enrollment.waiver_status is not None,
        "consent_status": enrollment.waiver_status,
        "consented_at": enrollment.consent_submitted_at,
        "is_enrolled": True
    }

# ✍️ Submit student consent for a module
@router.put("/modules/{module_id}/consent/{student_id}")
def submit_module_consent(
    module_id: UUID,
    student_id: str,
    waiver_data: WaiverStatusUpdate,
    db: Session = Depends(get_db)
):
    """
    Submit or update student consent for a module
    1 = Agree to research
    2 = Not agree
    3 = Not eligible
    """
    from app.models.student_enrollment import StudentEnrollment

    # Validate consent status
    if waiver_data.waiver_status not in [1, 2, 3]:
        raise HTTPException(status_code=400, detail="Invalid consent status. Must be 1, 2, or 3")

    # Check if module exists
    module = get_module_by_id(db, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    # Find student enrollment
    enrollment = db.query(StudentEnrollment).filter(
        StudentEnrollment.module_id == module_id,
        StudentEnrollment.student_id == student_id
    ).first()

    if not enrollment:
        raise HTTPException(status_code=404, detail="Student not enrolled in this module")

    # Update consent status
    enrollment.waiver_status = waiver_data.waiver_status
    enrollment.consent_submitted_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(enrollment)

    return {
        "success": True,
        "message": "Consent status updated successfully",
        "waiver_status": enrollment.waiver_status,
        "consent_submitted_at": enrollment.consent_submitted_at
    }

# 🤖 Get chatbot instructions for a module
@router.get("/modules/{module_id}/chatbot-instructions")
def get_chatbot_instructions(
    module_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Get the custom chatbot instructions for a module
    """
    module = get_module_by_id(db, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    # Get chatbot settings from assignment_config
    chatbot_config = module.assignment_config.get("features", {}).get("chatbot_feedback", {})
    chatbot_enabled = chatbot_config.get("enabled", True)

    # Default instructions if none set
    default_instructions = """You are a helpful and encouraging AI tutor for this course.

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

    return {
        "module_id": str(module_id),
        "module_name": module.name,
        "chatbot_enabled": chatbot_enabled,
        "chatbot_instructions": module.chatbot_instructions or default_instructions,
        "is_custom": module.chatbot_instructions is not None and module.chatbot_instructions.strip() != ""
    }

# 🤖 Update chatbot instructions for a module
@router.put("/modules/{module_id}/chatbot-instructions")
def update_chatbot_instructions(
    module_id: UUID,
    instructions_data: dict,
    db: Session = Depends(get_db)
):
    """
    Update the custom chatbot instructions for a module
    Only allowed if chatbot is enabled
    """
    module = get_module_by_id(db, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    # Check if chatbot is enabled
    chatbot_config = module.assignment_config.get("features", {}).get("chatbot_feedback", {})
    chatbot_enabled = chatbot_config.get("enabled", True)

    if not chatbot_enabled:
        raise HTTPException(
            status_code=400,
            detail="Chatbot is disabled for this module. Enable it first before customizing instructions."
        )

    # Get instructions from request
    new_instructions = instructions_data.get("instructions", "").strip()

    if not new_instructions:
        raise HTTPException(status_code=400, detail="Instructions cannot be empty")

    if len(new_instructions) > 5000:
        raise HTTPException(status_code=400, detail="Instructions too long. Maximum 5000 characters.")

    # Update the instructions
    module.chatbot_instructions = new_instructions
    db.commit()
    db.refresh(module)

    return {
        "success": True,
        "message": "Chatbot instructions updated successfully",
        "module_id": str(module_id),
        "chatbot_instructions": module.chatbot_instructions
    }


# ─── Cached dashboard metrics ────────────────────────────────────────────────
import time, threading, logging
from sqlalchemy import func

_dashboard_cache: Dict[str, Dict[str, Any]] = {}
_dashboard_cache_lock = threading.Lock()
_DASHBOARD_CACHE_TTL = 30  # 30 seconds — fresh enough for a dashboard

_logger = logging.getLogger(__name__)


@router.get("/modules/{module_id}/dashboard-metrics")
def get_dashboard_metrics(
    module_id: UUID,
    teacher_id: str = Query(..., description="Teacher user ID"),
    db: Session = Depends(get_db)
):
    """
    Single endpoint returning all dashboard data for a module.
    Cached for 30s so rapid refreshes don't hammer the DB.
    Uses JOINs instead of N+1 queries for speed.
    """
    cache_key = f"{module_id}:{teacher_id}"
    with _dashboard_cache_lock:
        cached = _dashboard_cache.get(cache_key)
        if cached and (time.time() - cached["ts"]) < _DASHBOARD_CACHE_TTL:
            return cached["data"]

    from app.models.student_answer import StudentAnswer
    from app.models.question import Question
    from app.models.document import Document
    from app.models.ai_feedback import AIFeedback
    from datetime import timedelta
    from sqlalchemy import case, cast, Date
    from sqlalchemy.orm import aliased

    module = get_module_by_id(db, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    # ── Core counts (3 fast queries) ──
    total_answers = db.query(func.count(StudentAnswer.id)).filter(
        StudentAnswer.module_id == module_id
    ).scalar() or 0

    unique_student_count = db.query(func.count(func.distinct(StudentAnswer.student_id))).filter(
        StudentAnswer.module_id == module_id
    ).scalar() or 0

    questions_count = db.query(func.count(Question.id)).filter(
        Question.module_id == module_id
    ).scalar() or 0

    documents_count = db.query(func.count(Document.id)).filter(
        Document.module_id == module_id
    ).scalar() or 0

    # ── Single JOIN query: answers + feedback scores ──
    # This replaces 3 separate N+1 loops with one query
    rows = db.query(
        StudentAnswer.id,
        StudentAnswer.student_id,
        StudentAnswer.question_id,
        StudentAnswer.submitted_at,
        StudentAnswer.attempt,
        AIFeedback.score,
        AIFeedback.generation_status,
    ).outerjoin(
        AIFeedback, AIFeedback.answer_id == StudentAnswer.id
    ).filter(
        StudentAnswer.module_id == module_id
    ).all()

    # ── Process results in Python (single pass) ──
    scored_answers = []
    score_ranges = [
        {"range": "0-20%", "min": 0, "max": 20, "count": 0},
        {"range": "21-40%", "min": 21, "max": 40, "count": 0},
        {"range": "41-60%", "min": 41, "max": 60, "count": 0},
        {"range": "61-80%", "min": 61, "max": 80, "count": 0},
        {"range": "81-100%", "min": 81, "max": 100, "count": 0},
    ]
    pending_grades = 0
    question_scores: Dict[str, Dict] = {}

    # Activity chart prep
    now = datetime.now(timezone.utc)
    day_counts = {}
    for i in range(7):
        day = (now - timedelta(days=i)).date()
        day_counts[day] = 0

    # Recent activity (track top 10 by submitted_at)
    recent_rows = []

    for row in rows:
        answer_id, student_id, question_id, submitted_at, attempt, score, gen_status = row

        # Score distribution
        if score is not None:
            scored_answers.append(score)
            for r in score_ranges:
                if r["min"] <= score <= r["max"]:
                    r["count"] += 1
                    break

        # Pending grades
        if gen_status != 'completed':
            pending_grades += 1

        # Question-level scores for low performance detection
        if score is not None:
            qid = str(question_id)
            if qid not in question_scores:
                question_scores[qid] = {"total": 0, "count": 0}
            question_scores[qid]["total"] += score
            question_scores[qid]["count"] += 1

        # Activity chart
        if submitted_at:
            day = submitted_at.date()
            if day in day_counts:
                day_counts[day] += 1

        # Recent activity (collect all, sort later)
        recent_rows.append({
            "id": str(answer_id),
            "student_id": student_id,
            "question_id": str(question_id),
            "timestamp": submitted_at.isoformat() if submitted_at else None,
            "score": score,
            "attempt": attempt,
            "_submitted_at": submitted_at,
        })

    avg_score = round(sum(scored_answers) / len(scored_answers)) if scored_answers else 0

    # ── Completion rate ──
    total_possible = unique_student_count * questions_count if questions_count else 0
    completion_rate = round((total_answers / total_possible) * 100) if total_possible > 0 else 0

    # ── Low performance questions ──
    low_perf_questions = sum(
        1 for q in question_scores.values()
        if q["count"] > 0 and q["total"] / q["count"] < 60
    )

    # ── Activity chart (last 7 days) ──
    activity_chart = []
    for i in range(6, -1, -1):
        day = (now - timedelta(days=i)).date()
        activity_chart.append({
            "dateKey": day.isoformat(),
            "dayName": day.strftime("%a"),
            "count": day_counts.get(day, 0)
        })

    # ── Recent activity (last 10) ──
    recent_rows.sort(key=lambda r: r["_submitted_at"] or datetime.min, reverse=True)
    recent = [
        {k: v for k, v in r.items() if k != "_submitted_at"}
        for r in recent_rows[:10]
    ]

    # ── Rubric summary ──
    try:
        rubric_summary = get_rubric_summary(db, module_id)
    except Exception:
        rubric_summary = None

    data = {
        "module_id": str(module_id),
        "access_code": module.access_code,
        "total_students": unique_student_count,
        "total_questions": questions_count,
        "total_documents": documents_count,
        "average_score": avg_score,
        "completion_rate": completion_rate,
        "total_submissions": total_answers,
        "ai_feedback_count": len(scored_answers),
        "score_distribution": score_ranges,
        "activity_chart": activity_chart,
        "recent_activity": recent,
        "action_items": {
            "pending_grades": pending_grades,
            "inactive_students": 0,
            "low_performance_questions": low_perf_questions,
        },
        "rubric_summary": rubric_summary,
    }

    with _dashboard_cache_lock:
        # Evict old entries
        stale = [k for k, v in _dashboard_cache.items() if time.time() - v["ts"] > _DASHBOARD_CACHE_TTL * 10]
        for k in stale:
            del _dashboard_cache[k]
        _dashboard_cache[cache_key] = {"data": data, "ts": time.time()}

    return data