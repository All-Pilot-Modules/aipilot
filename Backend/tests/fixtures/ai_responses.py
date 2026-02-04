"""
Canned AI JSON responses for testing feedback generation.
These are realistic responses that match what the AI services expect.
"""
import json
from typing import Dict, Any

# ---------------------------------------------------------------------------
# MCQ Feedback Responses
# ---------------------------------------------------------------------------
MCQ_CORRECT_RESPONSE = json.dumps({
    "is_correct": True,
    "score": 100,
    "total_percentage": 100,
    "explanation": "Excellent! You correctly identified Paris as the capital of France. Paris has been the capital since the 10th century and is known for landmarks like the Eiffel Tower and the Louvre.",
    "improvement_hint": "Great job! To deepen your understanding, explore the historical significance of Paris as a European capital.",
    "concept_explanation": "Capital cities are typically the seat of government and often the largest city in a country. Paris serves as both the political and cultural center of France.",
    "confidence": "high",
    "criterion_scores": {
        "accuracy": {"score": 100, "out_of": 100, "reasoning": "Correct answer selected"}
    }
})

MCQ_INCORRECT_RESPONSE = json.dumps({
    "is_correct": False,
    "score": 0,
    "total_percentage": 0,
    "explanation": "The selected answer is not correct. Consider what you know about European capitals and French history.",
    "improvement_hint": "Think about famous French landmarks and where they are located. Which city is known as the 'City of Light'?",
    "concept_explanation": "Capital cities serve as the administrative center of a country. They usually house government buildings and national institutions.",
    "confidence": "high",
    "criterion_scores": {
        "accuracy": {"score": 0, "out_of": 100, "reasoning": "Incorrect answer selected"}
    }
})

# ---------------------------------------------------------------------------
# Text/Essay Feedback Responses
# ---------------------------------------------------------------------------
TEXT_GOOD_RESPONSE = json.dumps({
    "is_correct": None,
    "score": 85,
    "total_percentage": 85,
    "explanation": "Your answer demonstrates a solid understanding of polymorphism. You correctly explained that it allows objects to take multiple forms and be treated through a common interface.",
    "improvement_hint": "Consider adding specific examples of polymorphism in practice, such as method overriding in inheritance hierarchies.",
    "concept_explanation": "Polymorphism is one of the four pillars of OOP, enabling code flexibility and reusability through interface abstraction.",
    "confidence": "high",
    "strengths": [
        "Clear definition of the concept",
        "Good use of technical terminology",
        "Logical structure in explanation"
    ],
    "weaknesses": [
        "Could include concrete code examples",
        "Did not mention compile-time vs runtime polymorphism"
    ],
    "missing_concepts": [
        "Method overloading vs overriding distinction"
    ],
    "criterion_scores": {
        "accuracy": {"score": 35, "out_of": 40, "reasoning": "Mostly accurate explanation with minor gaps"},
        "completeness": {"score": 25, "out_of": 30, "reasoning": "Covered main points but missing some depth"},
        "clarity": {"score": 25, "out_of": 30, "reasoning": "Well-written and easy to understand"}
    }
})

TEXT_POOR_RESPONSE = json.dumps({
    "is_correct": None,
    "score": 35,
    "total_percentage": 35,
    "explanation": "Your answer shows some awareness of the topic but contains significant gaps in understanding. The core concept of polymorphism was not clearly articulated.",
    "improvement_hint": "Review the four pillars of OOP and focus on how polymorphism differs from inheritance. Consider how it enables writing flexible, reusable code.",
    "concept_explanation": "Polymorphism allows objects of different classes to be treated as objects of a common superclass, enabling flexible and extensible code design.",
    "confidence": "medium",
    "strengths": [
        "Attempted to address the question"
    ],
    "weaknesses": [
        "Confused polymorphism with inheritance",
        "Missing key aspects of the concept",
        "Unclear explanation"
    ],
    "missing_concepts": [
        "Interface-based polymorphism",
        "Method overriding",
        "Liskov substitution principle"
    ],
    "criterion_scores": {
        "accuracy": {"score": 15, "out_of": 40, "reasoning": "Several inaccuracies in the explanation"},
        "completeness": {"score": 10, "out_of": 30, "reasoning": "Missing most key concepts"},
        "clarity": {"score": 10, "out_of": 30, "reasoning": "Difficult to follow the reasoning"}
    }
})

# ---------------------------------------------------------------------------
# Fill-in-the-Blank Feedback Responses
# ---------------------------------------------------------------------------
FILL_BLANK_ALL_CORRECT = json.dumps({
    "is_correct": True,
    "score": 100,
    "total_percentage": 100,
    "points_earned": 4.0,
    "points_possible": 4.0,
    "explanation": "Excellent! You correctly identified both blanks. The mitochondria is indeed the powerhouse of the cell, and DNA is stored in the nucleus.",
    "improvement_hint": "Great work! To expand your knowledge, explore how mitochondria generate ATP through cellular respiration.",
    "confidence": "high",
    "blank_results": [
        {"position": 0, "is_correct": True, "student_answer": "mitochondria", "points_earned": 2.0},
        {"position": 1, "is_correct": True, "student_answer": "nucleus", "points_earned": 2.0}
    ]
})

FILL_BLANK_PARTIAL = json.dumps({
    "is_correct": False,
    "score": 50,
    "total_percentage": 50,
    "points_earned": 2.0,
    "points_possible": 4.0,
    "explanation": "You got 1 out of 2 blanks correct. Review the structure of cells to improve your understanding.",
    "improvement_hint": "Consider where genetic material is stored in eukaryotic cells. Think about the membrane-bound organelles.",
    "confidence": "high",
    "blank_results": [
        {"position": 0, "is_correct": True, "student_answer": "mitochondria", "points_earned": 2.0},
        {"position": 1, "is_correct": False, "student_answer": "cytoplasm", "points_earned": 0.0}
    ]
})

# ---------------------------------------------------------------------------
# MCQ Multiple Feedback Responses
# ---------------------------------------------------------------------------
MCQ_MULTIPLE_PERFECT = json.dumps({
    "is_correct": True,
    "score": 100,
    "total_percentage": 100,
    "points_earned": 4.0,
    "points_possible": 4.0,
    "explanation": "Perfect! You correctly identified Python and Java as programming languages. HTML and CSS are markup and styling languages, not programming languages.",
    "improvement_hint": "Great understanding! Explore the differences between compiled and interpreted programming languages.",
    "confidence": "high",
    "breakdown": {
        "correct_selections": 2,
        "wrong_selections": 0,
        "missed_selections": 0
    }
})

MCQ_MULTIPLE_PARTIAL = json.dumps({
    "is_correct": False,
    "score": 62,
    "total_percentage": 62.5,
    "points_earned": 2.5,
    "points_possible": 4.0,
    "explanation": "You selected some correct options but also included an incorrect one. HTML is a markup language, not a programming language.",
    "improvement_hint": "Remember that programming languages have logic, loops, and can perform computations. Markup languages describe document structure.",
    "confidence": "high",
    "breakdown": {
        "correct_selections": 2,
        "wrong_selections": 1,
        "missed_selections": 0
    }
})

# ---------------------------------------------------------------------------
# Multi-Part Question Feedback Responses
# ---------------------------------------------------------------------------
MULTI_PART_COMPLETE = json.dumps({
    "is_correct": False,
    "score": 83,
    "total_percentage": 83.33,
    "points_earned": 5.0,
    "points_possible": 6.0,
    "explanation": "You performed well overall, correctly answering 2 out of 3 parts completely. Part 1c needs more attention.",
    "improvement_hint": "Review the concept of Python decorators - they are a powerful feature for modifying function behavior.",
    "confidence": "high",
    "sub_question_results": [
        {
            "id": "1a",
            "is_correct": True,
            "score": 100,
            "points_earned": 2.0,
            "points_possible": 2.0,
            "explanation": "Correct! Python is indeed a programming language."
        },
        {
            "id": "1b",
            "is_correct": True,
            "score": 100,
            "points_earned": 2.0,
            "points_possible": 2.0,
            "explanation": "Good answer about Python's advantages."
        },
        {
            "id": "1c",
            "is_correct": False,
            "score": 50,
            "points_earned": 1.0,
            "points_possible": 2.0,
            "explanation": "Your answer partially addresses decorators but misses key aspects."
        }
    ]
})

# ---------------------------------------------------------------------------
# Question Generation Responses
# ---------------------------------------------------------------------------
QUESTION_GENERATION_RESPONSE = json.dumps({
    "questions": [
        {
            "type": "short",
            "text": "Explain the concept of inheritance in object-oriented programming.",
            "correct_answer": "Inheritance allows a class to inherit properties and methods from a parent class.",
            "points": 5.0,
            "bloom_taxonomy": "Understand",
            "learning_outcome": "Explain OOP concepts"
        },
        {
            "type": "long",
            "text": "Compare and contrast procedural programming with object-oriented programming. Discuss the advantages and disadvantages of each paradigm.",
            "points": 10.0,
            "bloom_taxonomy": "Analyze",
            "learning_outcome": "Analyze programming paradigms"
        },
        {
            "type": "mcq",
            "text": "Which of the following is NOT a pillar of OOP?",
            "options": {
                "A": "Encapsulation",
                "B": "Polymorphism",
                "C": "Compilation",
                "D": "Abstraction"
            },
            "correct_option_id": "C",
            "points": 1.0,
            "bloom_taxonomy": "Remember",
            "learning_outcome": "Recall OOP fundamentals"
        }
    ]
})

# ---------------------------------------------------------------------------
# Chatbot Responses
# ---------------------------------------------------------------------------
CHATBOT_HELPFUL_RESPONSE = """Based on the course materials, I can help explain this concept.

Polymorphism in object-oriented programming refers to the ability of objects of different types to be treated through a common interface. There are two main types:

1. **Compile-time polymorphism** (method overloading): Same method name with different parameters
2. **Runtime polymorphism** (method overriding): Subclass provides specific implementation of a parent method

From page 45 of your lecture notes, the key benefit is that it allows writing flexible, reusable code.

Would you like me to provide a specific example or explain any part in more detail?"""

CHATBOT_RAG_RESPONSE = """According to your course materials:

From **Lecture 3, Slide 12**:
"Polymorphism enables objects to be processed differently based on their data type or class."

From **Chapter 5, Page 78**:
"The power of polymorphism lies in its ability to support the same interface for different underlying forms."

This concept is fundamental because it allows you to write code that works with objects of multiple types without knowing the specific type at compile time.

Is there a specific aspect you'd like me to elaborate on?"""

# ---------------------------------------------------------------------------
# Error/Fallback Responses
# ---------------------------------------------------------------------------
FALLBACK_MCQ_RESPONSE = json.dumps({
    "is_correct": False,
    "score": 0,
    "total_percentage": 0,
    "explanation": "Your answer has been recorded. Please review the correct answer.",
    "improvement_hint": "Review the relevant course materials for this topic.",
    "concept_explanation": "This question tests your understanding of a key concept from the course.",
    "confidence": "low"
})

FALLBACK_TEXT_RESPONSE = json.dumps({
    "is_correct": None,
    "score": 50,
    "total_percentage": 50,
    "explanation": "Your answer has been recorded. A detailed analysis is not available at this time.",
    "improvement_hint": "Consider reviewing the relevant course materials and expanding on your answer.",
    "confidence": "low",
    "strengths": [],
    "weaknesses": [],
    "criterion_scores": {}
})


def get_response_for_question_type(question_type: str, is_correct: bool = True) -> str:
    """Get an appropriate canned response based on question type and correctness."""
    responses = {
        ("mcq", True): MCQ_CORRECT_RESPONSE,
        ("mcq", False): MCQ_INCORRECT_RESPONSE,
        ("short", True): TEXT_GOOD_RESPONSE,
        ("short", False): TEXT_POOR_RESPONSE,
        ("long", True): TEXT_GOOD_RESPONSE,
        ("long", False): TEXT_POOR_RESPONSE,
        ("fill_blank", True): FILL_BLANK_ALL_CORRECT,
        ("fill_blank", False): FILL_BLANK_PARTIAL,
        ("mcq_multiple", True): MCQ_MULTIPLE_PERFECT,
        ("mcq_multiple", False): MCQ_MULTIPLE_PARTIAL,
        ("multi_part", True): MULTI_PART_COMPLETE,
        ("multi_part", False): MULTI_PART_COMPLETE,
    }
    return responses.get((question_type, is_correct), FALLBACK_TEXT_RESPONSE)
