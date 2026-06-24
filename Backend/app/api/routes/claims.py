import uuid as uuid_lib
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth import get_current_active_user, require_roles
from app.database import get_db
from app.models.enrollment_claim import EnrollmentClaim
from app.models.module import Module
from app.models.student_enrollment import StudentEnrollment
from app.models.user import User

router = APIRouter(prefix="/claims", tags=["Claims"])


def _is_uuid(val: str) -> bool:
    try:
        uuid_lib.UUID(val)
        return True
    except (ValueError, AttributeError):
        return False


class ClaimRequest(BaseModel):
    banner_id: str
    access_code: str


# ── Student endpoints ──────────────────────────────────────────────────────────

@router.post("/request")
def request_claim(
    payload: ClaimRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Student: submit a claim for guest history using Banner ID + access code."""
    enrollment = db.query(StudentEnrollment).filter(
        StudentEnrollment.student_id == payload.banner_id,
        StudentEnrollment.access_code_used == payload.access_code,
    ).first()

    if not enrollment:
        raise HTTPException(404, "No enrollment found for that Banner ID and access code")

    # Already migrated to another account
    if _is_uuid(enrollment.student_id) and enrollment.student_id != current_user.id:
        raise HTTPException(409, "This enrollment was already claimed by another account")

    # Already belongs to this account
    if enrollment.student_id == current_user.id:
        return {"message": "This enrollment already belongs to your account"}

    # Upsert: if a previous denied claim exists, re-open it
    existing = db.query(EnrollmentClaim).filter(
        EnrollmentClaim.user_id == current_user.id,
        EnrollmentClaim.module_id == enrollment.module_id,
    ).first()

    if existing:
        if existing.status == "pending":
            return {"message": "You already have a pending claim for this module",
                    "claim_id": str(existing.id)}
        if existing.status == "approved":
            return {"message": "This module history is already yours"}
        # denied — allow re-submission
        existing.status = "pending"
        existing.banner_id = payload.banner_id
        existing.access_code = payload.access_code
        existing.created_at = datetime.now(timezone.utc)
        existing.reviewed_at = None
        existing.reviewed_by = None
        db.commit()
        return {"message": "Claim re-submitted. Waiting for teacher approval.",
                "claim_id": str(existing.id)}

    claim = EnrollmentClaim(
        user_id=current_user.id,
        banner_id=payload.banner_id,
        module_id=enrollment.module_id,
        access_code=payload.access_code,
    )
    db.add(claim)
    db.commit()
    db.refresh(claim)

    return {
        "message": "Claim submitted. Waiting for teacher approval.",
        "claim_id": str(claim.id),
        "module_id": str(enrollment.module_id),
    }


@router.get("/my-claims")
def get_my_claims(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Student: list all their claims with status."""
    claims = (
        db.query(EnrollmentClaim)
        .filter(EnrollmentClaim.user_id == current_user.id)
        .order_by(EnrollmentClaim.created_at.desc())
        .all()
    )

    module_ids = [c.module_id for c in claims]
    modules = {m.id: m for m in db.query(Module).filter(Module.id.in_(module_ids)).all()}

    return [
        {
            "id": str(c.id),
            "banner_id": c.banner_id,
            "module_id": str(c.module_id),
            "module_name": modules[c.module_id].name if c.module_id in modules else "Unknown",
            "status": c.status,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "reviewed_at": c.reviewed_at.isoformat() if c.reviewed_at else None,
        }
        for c in claims
    ]


# ── Teacher endpoints ──────────────────────────────────────────────────────────

@router.get("/pending")
def get_pending_claims(
    current_user: User = Depends(require_roles(["teacher", "admin"])),
    db: Session = Depends(get_db),
):
    """Teacher: list all pending claims for their modules."""
    teacher_modules = db.query(Module).filter(Module.teacher_id == current_user.id).all()
    module_map = {m.id: m for m in teacher_modules}

    claims = (
        db.query(EnrollmentClaim)
        .filter(
            EnrollmentClaim.module_id.in_(list(module_map.keys())),
            EnrollmentClaim.status == "pending",
        )
        .order_by(EnrollmentClaim.created_at.asc())
        .all()
    )

    user_ids = [c.user_id for c in claims]
    users = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()}

    return [
        {
            "id": str(c.id),
            "banner_id": c.banner_id,
            "module_id": str(c.module_id),
            "module_name": module_map[c.module_id].name if c.module_id in module_map else "Unknown",
            "claimer_email": users[c.user_id].email if c.user_id in users else None,
            "claimer_username": users[c.user_id].username if c.user_id in users else None,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in claims
    ]


@router.post("/{claim_id}/approve")
def approve_claim(
    claim_id: str,
    current_user: User = Depends(require_roles(["teacher", "admin"])),
    db: Session = Depends(get_db),
):
    """Teacher: approve a claim and migrate all guest history to the student's account."""
    claim = db.query(EnrollmentClaim).filter(EnrollmentClaim.id == claim_id).first()
    if not claim:
        raise HTTPException(404, "Claim not found")
    if claim.status != "pending":
        raise HTTPException(400, f"Claim is already {claim.status}")

    module = db.query(Module).filter(
        Module.id == claim.module_id,
        Module.teacher_id == current_user.id,
    ).first()
    if not module and current_user.role != "admin":
        raise HTTPException(403, "You don't own this module")

    banner_id = claim.banner_id
    user_id   = claim.user_id
    module_id = claim.module_id

    # ── Migrate data ──────────────────────────────────────────────────────────
    # The enrollment table has a composite FK referenced by test_submissions.
    # Safe order: insert new enrollment row first (so the FK target exists),
    # update all child tables, then delete the old enrollment row.

    old_enrollment = db.query(StudentEnrollment).filter(
        StudentEnrollment.student_id == banner_id,
        StudentEnrollment.module_id == module_id,
    ).first()

    if old_enrollment:
        # Check there isn't already an enrollment for this user in this module
        existing_new = db.query(StudentEnrollment).filter(
            StudentEnrollment.student_id == user_id,
            StudentEnrollment.module_id == module_id,
        ).first()

        if not existing_new:
            new_enrollment = StudentEnrollment(
                student_id=user_id,
                module_id=module_id,
                enrolled_at=old_enrollment.enrolled_at,
                access_code_used=old_enrollment.access_code_used,
                waiver_status=old_enrollment.waiver_status,
                consent_submitted_at=old_enrollment.consent_submitted_at,
            )
            db.add(new_enrollment)
            db.flush()  # make it visible for FK checks below

        # Update all tables that reference (student_id, module_id)
        from app.models.student_answer import StudentAnswer
        from app.models.test_submission import TestSubmission
        from app.models.question_queue import QuestionQueue
        from app.models.survey_response import SurveyResponse
        from app.models.answer_grade import AnswerGrade
        from app.models.student_module_grade import StudentModuleGrade
        from app.models.chat_conversation import ChatConversation

        for Model in [
            TestSubmission,   # references student_enrollments — update after flush above
            StudentAnswer,
            QuestionQueue,
            SurveyResponse,
            AnswerGrade,
            StudentModuleGrade,
            ChatConversation,
        ]:
            try:
                db.query(Model).filter(
                    Model.student_id == banner_id,
                    Model.module_id == module_id,
                ).update({"student_id": user_id}, synchronize_session=False)
            except Exception:
                pass  # table might not have module_id — skip gracefully

        db.delete(old_enrollment)

    # Save banner_id on the user account if not already set
    claimer = db.query(User).filter(User.id == user_id).first()
    if claimer and not claimer.banner_id:
        claimer.banner_id = banner_id

    claim.status      = "approved"
    claim.reviewed_at = datetime.now(timezone.utc)
    claim.reviewed_by = current_user.id

    db.commit()
    return {"message": "Claim approved. History migrated successfully."}


@router.post("/{claim_id}/deny")
def deny_claim(
    claim_id: str,
    current_user: User = Depends(require_roles(["teacher", "admin"])),
    db: Session = Depends(get_db),
):
    """Teacher: deny a claim."""
    claim = db.query(EnrollmentClaim).filter(EnrollmentClaim.id == claim_id).first()
    if not claim:
        raise HTTPException(404, "Claim not found")
    if claim.status != "pending":
        raise HTTPException(400, f"Claim is already {claim.status}")

    module = db.query(Module).filter(
        Module.id == claim.module_id,
        Module.teacher_id == current_user.id,
    ).first()
    if not module and current_user.role != "admin":
        raise HTTPException(403, "You don't own this module")

    claim.status      = "denied"
    claim.reviewed_at = datetime.now(timezone.utc)
    claim.reviewed_by = current_user.id

    db.commit()
    return {"message": "Claim denied."}
