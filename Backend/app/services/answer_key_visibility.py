"""Read-only answer-key delivery, independent of the AI worker's progress."""
from app.models.question import Question
from app.models.student_answer import StudentAnswer
from app.models.test_submission import TestSubmission
from app.models.ai_feedback import AIFeedback
from sqlalchemy import or_
from app.services.feedback_visibility import content_policy, get_max_attempts


def answer_key_only(module):
    policy = content_policy(module)
    return policy["correct_answer"] and not policy["explanation"] and not policy["hints"]


def answer_key_entries(question):
    """Only explicitly authored answers; never expose the whole question config."""
    config = question.extended_config or {}
    if question.type == "mcq":
        key = question.correct_option_id or question.correct_answer
        return [{"label": "Correct answer", "text": f"{key}. {(question.options or {}).get(key, '')}"}] if key else []
    if question.type == "mcq_multiple":
        return [{"label": "Correct answer", "text": f"{key}. {(question.options or {}).get(key, '')}"}
                for key in config.get("correct_option_ids", [])]
    if question.type == "fill_blank":
        return [{"label": f"Blank {blank.get('position', i) + 1}",
                 "text": " / ".join(blank.get("correct_answers", []))}
                for i, blank in enumerate(config.get("blanks", [])) if blank.get("correct_answers")]
    if question.type == "multi_part":
        entries = []
        for part in config.get("sub_questions", []):
            key = part.get("correct_option_id") or part.get("correct_answer")
            if key:
                text = f"{key}. {part['options'][key]}" if key in (part.get("options") or {}) else str(key)
                entries.append({"label": f"Part {part.get('id', '')}", "text": text})
        return entries
    return [{"label": "Reference answer", "text": question.correct_answer}] if question.correct_answer else []


def immediate_answer_keys(db, module, student_id, attempt=None):
    """Return keys only for submitted learning attempts with automatic release.

    Final attempts, saved drafts, mastery practice, and teacher-held results must
    not gain a new route around the existing visibility/release policy.
    """
    if not module or not answer_key_only(module) or (module.ai_grading_mode or "auto") != "auto":
        return []
    attempts = ((module.assignment_config or {}).get("features", {}).get("multiple_attempts", {}) or {})
    if not attempts.get("show_feedback_after_each", True):
        return []
    submitted = db.query(TestSubmission.attempt).filter(
        TestSubmission.module_id == module.id,
        TestSubmission.student_id == student_id,
    )
    query = db.query(StudentAnswer, Question).join(Question, StudentAnswer.question_id == Question.id).outerjoin(
        AIFeedback, AIFeedback.answer_id == StudentAnswer.id,
    ).filter(
        StudentAnswer.module_id == module.id,
        StudentAnswer.student_id == student_id,
        StudentAnswer.is_mastery == False,
        StudentAnswer.attempt < get_max_attempts(module),
        StudentAnswer.attempt.in_(submitted),
        or_(AIFeedback.id.is_(None), AIFeedback.released == True),
    )
    if attempt is not None:
        query = query.filter(StudentAnswer.attempt == attempt)
    return [{
        "id": None, "answer_id": str(answer.id), "question_id": str(question.id),
        "attempt": answer.attempt, "answer_key": answer_key_entries(question),
        "answer_key_only": True, "generation_status": "completed",
        "score": None, "correctness_score": None, "is_correct": None,
        "points_earned": None, "points_possible": question.points,
        "explanation": "", "improvement_hint": None,
        "fallback": False, "can_retry": False, "released": True,
        "selected_option": (answer.answer or {}).get("selected_option") if isinstance(answer.answer, dict) else None,
        "selected_options": (answer.answer or {}).get("selected_options") if isinstance(answer.answer, dict) else None,
        "available_options": question.options or {},
        "student_answer": answer.answer,
        "correct_option": (question.correct_option_id or question.correct_answer) if question.type == "mcq" else None,
        "correct_options": (question.extended_config or {}).get("correct_option_ids") if question.type == "mcq_multiple" else None,
    } for answer, question in query.all()]
