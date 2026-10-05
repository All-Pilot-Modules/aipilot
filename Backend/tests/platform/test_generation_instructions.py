import pytest
from pydantic import ValidationError
from app.schemas.question import QuestionGenerationRequest
from app.services.question_generation import QuestionGenerationService


def test_optional_instructions_reach_prompt():
    service = object.__new__(QuestionGenerationService)
    args = dict(document_content='Document about integrals', document_title='Calculus', num_short=1, num_long=0, num_mcq=0)
    original = service._build_question_generation_prompt(**args)
    assert service._build_question_generation_prompt(**args, instructions='  ') == original
    guided = service._build_question_generation_prompt(**args, instructions='Focus on practical examples')
    assert 'Focus on practical examples' in guided
    assert 'Preserve the requested question counts' in guided


def test_instructions_length_is_bounded():
    assert QuestionGenerationRequest(num_short=1).instructions == ''
    with pytest.raises(ValidationError):
        QuestionGenerationRequest(num_short=1, instructions='a' * 2001)
