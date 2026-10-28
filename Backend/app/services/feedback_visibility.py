"""Teacher-controlled policy for what a student sees of their feedback, and when.

Four independent axes. Keep them independent — the research pilot varies one at
a time, so no axis may silently imply another.

  timing    show_feedback_after_each — per attempt, or only once the student has
            reached the final attempt. Lives in
            assignment_config.features.multiple_attempts (saved by PUT /modules/:id).

  content   show_score_to_student / show_correct_answer_to_student /
            show_explanation_to_student / show_hints_to_student — which layers of
            a feedback payload reach the student. Lives in ai_config.grading
            (saved by PATCH /modules/:id/grading-settings).

  attempts  final_attempt_mode — whether the last attempt is a submission only
            (no AI feedback; reserved for teacher grading) or also a learning
            step that gets AI feedback like every other attempt.

  release   ai_grading_mode / require_teacher_approval — whether a teacher must
            review before anything reaches the student. Applied at generation
            time in feedback_worker, not here.

Combining the content flags gives the between-attempt conditions:

  nothing              timing off
  correct answer only  timing on,  correct_answer on,  explanation off, hints off
  AI feedback only     timing on,  correct_answer off, explanation on,  hints on
  both                 timing on,  correct_answer on,  explanation on,  hints on
"""
from app.models.module import Module
from app.models.test_submission import TestSubmission

DEFAULT_MAX_ATTEMPTS = 2

# Final-attempt behavior.
FINAL_SUBMIT_ONLY = "submit_only"   # no AI feedback on the last attempt (default)
FINAL_LEARN = "learn"               # last attempt is graded by AI like any other
FINAL_ATTEMPT_MODES = (FINAL_SUBMIT_ONLY, FINAL_LEARN)

# Payload fields owned by each content flag. Redaction nulls them out rather
# than dropping the keys, so response shapes stay stable for the client.
SCORE_FIELDS = (
    "is_correct", "score", "correctness_score", "points_earned", "criterion_scores",
)
EXPLANATION_FIELDS = (
    "explanation", "feedback_text", "concept_explanation", "strengths", "weaknesses",
)
HINT_FIELDS = ("improvement_hint",)
CORRECT_ANSWER_FIELDS = ("correct_option", "correct_options")


def _grading(module) -> dict:
    return ((module.ai_config or {}).get("grading", {}) or {}) if module else {}


def _attempts(module) -> dict:
    config = (module.assignment_config or {}) if module else {}
    return config.get("features", {}).get("multiple_attempts", {}) or {}


def get_max_attempts(module) -> int:
    """Attempts allowed for this module, falling back to the platform default."""
    value = _attempts(module).get("max_attempts", DEFAULT_MAX_ATTEMPTS)
    return value if isinstance(value, int) and value >= 1 else DEFAULT_MAX_ATTEMPTS


def get_final_attempt_mode(module) -> str:
    mode = _grading(module).get("final_attempt_mode", FINAL_SUBMIT_ONLY)
    return mode if mode in FINAL_ATTEMPT_MODES else FINAL_SUBMIT_ONLY


def ai_feedback_allowed_for_attempt(module, attempt: int, max_attempts=None) -> bool:
    """Whether AI feedback may be generated for this attempt.

    Every attempt before the last always qualifies. The last one qualifies only
    when the teacher made it a learning step; by default it is a submission
    reserved for teacher grading.
    """
    if max_attempts is None:
        max_attempts = get_max_attempts(module)
    if attempt < max_attempts:
        return True
    return get_final_attempt_mode(module) == FINAL_LEARN


def student_feedback_is_available(db, module_id, student_id, module=None):
    """Withhold feedback until final submission when per-attempt feedback is off.

    This does not override the separate teacher-release gate or mutate grading.
    Missing configuration retains the legacy immediate-feedback behavior.
    """
    if module is None:
        module = db.query(Module).filter(Module.id == module_id).first()
    attempts = _attempts(module)
    if attempts.get("show_feedback_after_each", True):
        return True
    return db.query(TestSubmission.id).filter(
        TestSubmission.module_id == module_id,
        TestSubmission.student_id == student_id,
        TestSubmission.attempt >= attempts.get("max_attempts", DEFAULT_MAX_ATTEMPTS),
    ).first() is not None


def content_policy(module) -> dict:
    """The four content flags, resolved against their defaults."""
    grading = _grading(module)
    return {
        "score": bool(grading.get("show_score_to_student", True)),
        "correct_answer": bool(grading.get("show_correct_answer_to_student", False)),
        "explanation": bool(grading.get("show_explanation_to_student", True)),
        "hints": bool(grading.get("show_hints_to_student", True)),
    }


def redact_feedback(item: dict, module, policy=None) -> dict:
    """Strip the layers this module's teacher has turned off, in place.

    Applied at every student-facing exit. Teacher-facing endpoints must never
    call this — they always see the complete payload.
    """
    if policy is None:
        policy = content_policy(module)

    if not policy["score"]:
        for field in SCORE_FIELDS:
            if field in item:
                item[field] = None
        grade = item.get("teacher_grade")
        if isinstance(grade, dict):
            item["teacher_grade"] = {**grade, "points_awarded": None}

    if not policy["explanation"]:
        for field in EXPLANATION_FIELDS:
            if field in item:
                item[field] = "" if field in ("explanation", "feedback_text") else None

    if not policy["hints"]:
        for field in HINT_FIELDS:
            if field in item:
                item[field] = None

    if not policy["correct_answer"]:
        for field in CORRECT_ANSWER_FIELDS:
            if field in item:
                item[field] = None

        details = item.get("grading_details")
        if isinstance(details, dict) and details.get("blank_results"):
            item["grading_details"] = {
                **details,
                "blank_results": [
                    {k: v for k, v in blank.items() if k != "accepted_answers"}
                    for blank in details["blank_results"]
                ],
            }

        if item.get("sub_results"):
            item["sub_results"] = [
                {k: v for k, v in result.items()
                 if k not in ("correct_option", "correct_answer")}
                for result in item["sub_results"]
            ]

    return item


def redact_feedback_list(items, module) -> list:
    policy = content_policy(module)
    for item in items:
        redact_feedback(item, module, policy)
    return items
