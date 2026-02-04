"""
Mock OpenAI response factories for testing AI services.
"""
import json
from typing import Dict, Any, Optional
from unittest.mock import MagicMock


def create_mock_completion(content: str) -> MagicMock:
    """Create a mock OpenAI completion response."""
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = content
    mock_response.choices[0].finish_reason = "stop"
    mock_response.usage = MagicMock()
    mock_response.usage.prompt_tokens = 100
    mock_response.usage.completion_tokens = 50
    mock_response.usage.total_tokens = 150
    return mock_response


def mcq_feedback_response(
    is_correct: bool = True,
    score: int = 100,
    explanation: str = "Good job!",
    improvement_hint: str = "Keep practicing.",
) -> str:
    """Generate a mock MCQ feedback JSON response."""
    return json.dumps({
        "is_correct": is_correct,
        "score": score,
        "total_percentage": score,
        "explanation": explanation,
        "improvement_hint": improvement_hint,
        "concept_explanation": "This tests your understanding of the topic.",
        "confidence": "high",
        "criterion_scores": {
            "accuracy": {"score": score, "out_of": 100, "reasoning": "Answer correctness"}
        }
    })


def text_feedback_response(
    score: int = 75,
    is_correct: Optional[bool] = None,
    strengths: Optional[list] = None,
    weaknesses: Optional[list] = None,
    missing_concepts: Optional[list] = None,
) -> str:
    """Generate a mock text/essay feedback JSON response."""
    return json.dumps({
        "is_correct": is_correct,
        "score": score,
        "total_percentage": score,
        "explanation": "Your answer demonstrates understanding of the key concepts.",
        "improvement_hint": "Consider adding more specific examples.",
        "concept_explanation": "This topic is fundamental to the subject.",
        "confidence": "medium",
        "strengths": strengths or ["Good structure", "Clear writing"],
        "weaknesses": weaknesses or ["Could use more detail"],
        "missing_concepts": missing_concepts or [],
        "criterion_scores": {
            "accuracy": {"score": 30, "out_of": 40, "reasoning": "Mostly accurate"},
            "completeness": {"score": 25, "out_of": 30, "reasoning": "Covers main points"},
            "clarity": {"score": 20, "out_of": 30, "reasoning": "Well expressed"}
        }
    })


def fill_blank_feedback_response(
    correct_count: int = 1,
    total_blanks: int = 2,
    percentage: float = 50.0,
) -> str:
    """Generate a mock fill-in-the-blank feedback JSON response."""
    return json.dumps({
        "is_correct": correct_count == total_blanks,
        "score": int(percentage),
        "total_percentage": percentage,
        "explanation": f"You got {correct_count} out of {total_blanks} blanks correct.",
        "improvement_hint": "Review the material for the missed blanks.",
        "confidence": "high",
        "blank_results": [
            {"position": i, "is_correct": i < correct_count}
            for i in range(total_blanks)
        ]
    })


def mcq_multiple_feedback_response(
    score: float = 75.0,
    correct_selections: int = 1,
    wrong_selections: int = 1,
    missed_selections: int = 1,
) -> str:
    """Generate a mock MCQ-multiple feedback JSON response."""
    return json.dumps({
        "is_correct": wrong_selections == 0 and missed_selections == 0,
        "score": int(score),
        "total_percentage": score,
        "explanation": f"You selected {correct_selections} correct options.",
        "improvement_hint": "Review all options carefully before selecting.",
        "confidence": "high",
        "breakdown": {
            "correct_selections": correct_selections,
            "wrong_selections": wrong_selections,
            "missed_selections": missed_selections
        }
    })


def multi_part_feedback_response(
    sub_scores: Optional[list] = None,
    total_points: float = 6.0,
    earned_points: float = 4.0,
) -> str:
    """Generate a mock multi-part question feedback JSON response."""
    default_sub_scores = [
        {"id": "1a", "is_correct": True, "score": 100, "points_earned": 2.0, "points_possible": 2.0},
        {"id": "1b", "is_correct": True, "score": 80, "points_earned": 1.6, "points_possible": 2.0},
        {"id": "1c", "is_correct": False, "score": 20, "points_earned": 0.4, "points_possible": 2.0},
    ]
    return json.dumps({
        "is_correct": False,
        "score": int((earned_points / total_points) * 100),
        "total_percentage": (earned_points / total_points) * 100,
        "points_earned": earned_points,
        "points_possible": total_points,
        "explanation": "You answered most parts correctly.",
        "improvement_hint": "Review part 1c for improvement.",
        "confidence": "high",
        "sub_question_results": sub_scores or default_sub_scores
    })


def question_generation_response(
    num_short: int = 2,
    num_long: int = 1,
    num_mcq: int = 3,
) -> str:
    """Generate a mock question generation JSON response."""
    questions = []

    for i in range(num_short):
        questions.append({
            "type": "short",
            "text": f"Short question {i+1}: Explain concept X.",
            "correct_answer": f"Answer for short question {i+1}",
            "points": 5.0,
            "bloom_taxonomy": "Understand",
            "learning_outcome": "Demonstrate understanding"
        })

    for i in range(num_long):
        questions.append({
            "type": "long",
            "text": f"Long question {i+1}: Discuss topic Y in detail.",
            "points": 10.0,
            "bloom_taxonomy": "Analyze",
            "learning_outcome": "Analyze complex concepts"
        })

    for i in range(num_mcq):
        questions.append({
            "type": "mcq",
            "text": f"MCQ question {i+1}: What is Z?",
            "options": {
                "A": f"Option A for MCQ {i+1}",
                "B": f"Option B for MCQ {i+1}",
                "C": f"Option C for MCQ {i+1}",
                "D": f"Option D for MCQ {i+1}"
            },
            "correct_option_id": "A",
            "points": 1.0,
            "bloom_taxonomy": "Remember",
            "learning_outcome": "Recall key facts"
        })

    return json.dumps({"questions": questions})


def semantic_match_response(is_match: bool = True) -> str:
    """Generate a mock semantic matching response (YES/NO)."""
    return "YES" if is_match else "NO"


def chatbot_response(message: str = "Here's my response based on the course materials.") -> str:
    """Generate a mock chatbot response."""
    return message


def embedding_response(dimensions: int = 1536) -> list:
    """Generate a mock embedding vector."""
    import random
    return [random.uniform(-1, 1) for _ in range(dimensions)]


class MockOpenAIClient:
    """A configurable mock OpenAI client for testing."""

    def __init__(self):
        self.responses = []
        self.call_count = 0
        self.last_request = None

    def set_response(self, content: str):
        """Set a single response."""
        self.responses = [content]

    def set_responses(self, contents: list):
        """Set multiple responses for sequential calls."""
        self.responses = contents

    def create_chat_completion(self, **kwargs):
        """Mock chat completion method."""
        self.last_request = kwargs
        self.call_count += 1

        if not self.responses:
            return create_mock_completion('{"error": "No mock response configured"}')

        response_idx = min(self.call_count - 1, len(self.responses) - 1)
        return create_mock_completion(self.responses[response_idx])


def create_timeout_error():
    """Create a mock OpenAI timeout error."""
    import openai
    return openai.APITimeoutError(request=MagicMock())


def create_rate_limit_error():
    """Create a mock OpenAI rate limit error."""
    import openai
    response = MagicMock()
    response.status_code = 429
    response.headers = {"Retry-After": "5"}
    return openai.RateLimitError(
        message="Rate limit exceeded",
        response=response,
        body={"error": {"message": "Rate limit exceeded"}}
    )


def create_api_error(message: str = "API Error"):
    """Create a mock OpenAI API error."""
    import openai
    response = MagicMock()
    response.status_code = 500
    return openai.APIError(
        message=message,
        request=MagicMock(),
        body={"error": {"message": message}}
    )
