"""
Question-specific grading logic for different question types
"""
import logging
from typing import Dict, Any, List, Optional
from app.core.config import OPENAI_API_KEYS, LLM_MODEL
from app.services.openai_client import OpenAIClientWithRetry

logger = logging.getLogger(__name__)

class QuestionGradingService:
    """Service for grading different question types"""

    def __init__(self):
        self.client = OpenAIClientWithRetry(api_keys=OPENAI_API_KEYS, default_model=LLM_MODEL)
        self.default_model = LLM_MODEL

    def grade_fill_blank(
        self,
        student_answers: Dict[int, str],
        blank_configs: List[Dict[str, Any]],
        use_ai_semantic_matching: bool = True
    ) -> Dict[str, Any]:
        """
        Grade fill-in-the-blank question

        Args:
            student_answers: Dict mapping blank position to student's answer
            blank_configs: List of blank configurations from extended_config
            use_ai_semantic_matching: Whether to use AI for semantic matching

        Returns:
            Dict with grading results including per-blank scores and total
        """
        total_points = 0.0
        earned_points = 0.0
        blank_results = []

        for blank_config in blank_configs:
            position = blank_config.get('position')
            correct_answers = blank_config.get('correct_answers', [])
            points = blank_config.get('points', 1.0)
            case_sensitive = blank_config.get('case_sensitive', False)

            total_points += points

            # Get student's answer for this blank
            student_answer = student_answers.get(position, "").strip()

            # Check for exact match first
            is_correct = self._check_exact_match(
                student_answer,
                correct_answers,
                case_sensitive
            )

            # If not exact match and AI semantic matching enabled, use AI
            semantic_match = False
            if not is_correct and use_ai_semantic_matching and student_answer:
                is_correct, semantic_match = self._check_ai_semantic_match(
                    student_answer,
                    correct_answers
                )

            # Award points if correct
            blank_earned = points if is_correct else 0.0
            earned_points += blank_earned

            blank_results.append({
                "position": position,
                "student_answer": student_answer,
                "is_correct": is_correct,
                "semantic_match": semantic_match,
                "points_possible": points,
                "points_earned": blank_earned,
                "accepted_answers": correct_answers
            })

        # Calculate overall correctness
        percentage = (earned_points / total_points * 100) if total_points > 0 else 0

        return {
            "is_correct": earned_points == total_points,
            "partial_credit": earned_points > 0 and earned_points < total_points,
            "total_points": total_points,
            "earned_points": earned_points,
            "percentage": percentage,
            "blank_results": blank_results
        }

    def _check_exact_match(
        self,
        student_answer: str,
        correct_answers: List[str],
        case_sensitive: bool
    ) -> bool:
        """Check if student answer exactly matches any correct answer"""
        if not student_answer:
            return False

        for correct in correct_answers:
            if case_sensitive:
                if student_answer == correct:
                    return True
            else:
                if student_answer.lower() == correct.lower():
                    return True

        return False

    def _check_ai_semantic_match(
        self,
        student_answer: str,
        correct_answers: List[str]
    ) -> tuple[bool, bool]:
        """
        Use AI to check if student answer is semantically equivalent to correct answers

        Returns:
            (is_correct, semantic_match_used)
        """
        try:
            prompt = f"""Determine if the student's answer is semantically equivalent to any of the accepted answers.

Student's answer: "{student_answer}"

Accepted answers: {', '.join([f'"{ans}"' for ans in correct_answers])}

Respond with ONLY "YES" if the student's answer means the same thing as any accepted answer, or "NO" if it doesn't.
Consider:
- Synonyms (e.g., "happy" = "joyful")
- Different word forms (e.g., "running" = "run")
- Equivalent meanings (e.g., "2+2" = "four")

Response (YES or NO):"""

            logger.info(f"🤖 AI Semantic Check: '{student_answer}' vs {correct_answers}")

            response = self.client.create_chat_completion(
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=10
            )

            ai_response = response.choices[0].message.content.strip().upper()
            is_match = "YES" in ai_response

            logger.info(f"   AI Response: {ai_response} → Match: {is_match}")

            return is_match, True

        except Exception as e:
            logger.error(f"AI semantic matching failed: {str(e)}")
            return False, False

    def grade_mcq_multiple(
        self,
        selected_options: List[str],
        correct_option_ids: List[str],
        total_options: int,
        partial_credit: bool = True,
        penalty_for_wrong: bool = True
    ) -> Dict[str, Any]:
        """
        Grade multiple-correct MCQ with partial credit and penalty system

        Args:
            selected_options: List of option IDs student selected
            correct_option_ids: List of correct option IDs
            total_options: Total number of options available
            partial_credit: Whether to award partial credit
            penalty_for_wrong: Whether to penalize wrong selections

        Returns:
            Dict with grading results
        """
        selected_set = set(selected_options)
        correct_set = set(correct_option_ids)

        # Calculate correct and incorrect selections
        correctly_selected = selected_set & correct_set
        incorrectly_selected = selected_set - correct_set
        missed_correct = correct_set - selected_set

        # Full correctness check
        is_fully_correct = (
            len(correctly_selected) == len(correct_set) and
            len(incorrectly_selected) == 0
        )

        if not partial_credit:
            # All or nothing
            score = 100.0 if is_fully_correct else 0.0
        else:
            # Calculate partial credit
            num_correct_options = len(correct_set)

            # Points per correct selection
            points_per_correct = 100.0 / num_correct_options if num_correct_options > 0 else 0

            # Award points for correct selections
            score = len(correctly_selected) * points_per_correct

            # Deduct points for incorrect selections if penalty enabled
            if penalty_for_wrong and len(incorrectly_selected) > 0:
                # Penalty is 25% of the reward (lenient to encourage partial attempts)
                # Example: 2 correct total, select 1 correct + 2 wrong:
                #   Earn: 50 points, Lose: 2 × 12.5 = 25 points → Final: 25%
                penalty_per_wrong = points_per_correct * 0.25
                penalty = len(incorrectly_selected) * penalty_per_wrong
                score = max(0, score - penalty)

        return {
            "is_correct": is_fully_correct,
            "score": round(score, 2),
            "correctly_selected": list(correctly_selected),
            "incorrectly_selected": list(incorrectly_selected),
            "missed_correct": list(missed_correct),
            "total_correct_options": len(correct_set),
            "breakdown": {
                "correct_selections": len(correctly_selected),
                "wrong_selections": len(incorrectly_selected),
                "missed_selections": len(missed_correct)
            }
        }
