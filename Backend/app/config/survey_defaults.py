"""Original platform survey, restored from the pre-settings model."""
DEFAULT_SURVEY_QUESTIONS = [
    {
        "id": "q1",
        "question": "What did you find most helpful in this module?",
        "type": "long",
        "required": True,
        "placeholder": "Please share what aspects helped you learn effectively..."
    },
    {
        "id": "q2",
        "question": "What aspects of the module were challenging?",
        "type": "long",
        "required": False,
        "placeholder": "Describe any difficulties or areas for improvement..."
    },
    {
        "id": "q3",
        "question": "How would you rate your overall learning experience? (Please explain)",
        "type": "short",
        "required": True,
        "placeholder": "Your rating and brief explanation..."
    },
    {
        "id": "q4",
        "question": "Any suggestions for improvement?",
        "type": "long",
        "required": False,
        "placeholder": "Share your ideas..."
    },
    {
        "id": "q5",
        "question": "Additional comments:",
        "type": "long",
        "required": False,
        "placeholder": "Any other feedback you'd like to share..."
    }
]
