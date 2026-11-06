"""Export uses the actual frontend serializer; import must not need an LLM."""
import json
import subprocess
from pathlib import Path
from uuid import uuid4
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from app.services.document_validation import validate_upload
from app.services.document import validate_questions
from app.utils.text_extractor import extract_text_from_file
from app.utils import question_parser as parser


def test_rtf_export_import_preserves_keys_and_math(tmp_path, monkeypatch):
    rows = [
        {'type': 'mcq', 'text': r'What is $\\frac{1}{2}$?', 'options': {'A': '½', 'B': '2'}, 'correct_option_id': 'A'},
        {'type': 'mcq_multiple', 'text': 'Select primes', 'options': {'A': '2', 'B': '4', 'C': '7'}, 'extended_config': {'correct_option_ids': ['A', 'C']}},
        {'type': 'short', 'text': 'Explain café and λ', 'correct_answer': 'A written answer with {braces} and λ.'},
    ]
    root = Path(__file__).resolve().parents[3]
    result = subprocess.run(['node', '--input-type=module', '-e',
        "import {buildQuestionsRTF} from './Frontend/lib/testbankExport.mjs'; let s=''; for await(const c of process.stdin) s+=c; process.stdout.write(buildQuestionsRTF(JSON.parse(s),'Calculus'));"],
        input=json.dumps(rows), text=True, capture_output=True, cwd=root, check=True)
    content = result.stdout.encode()
    assert validate_upload(content, 'questions.rtf', True) == 'rtf'
    path = tmp_path / 'questions.rtf'
    path.write_bytes(content)
    text = extract_text_from_file(str(path), 'rtf', is_testbank=True)['text']
    ai = MagicMock(side_effect=AssertionError('export/import must not call AI'))
    monkeypatch.setattr(parser, 'parse_testbank_with_ai', ai)
    questions = validate_questions(parser.parse_testbank_hybrid(text, uuid4()))
    assert len(questions) == 3
    assert questions[0].text == rows[0]['text']
    assert questions[0].options == rows[0]['options']
    assert questions[0].correct_option_id == 'A'
    assert questions[1].type == 'mcq_multiple'
    assert questions[1].extended_config['correct_option_ids'] == ['A', 'C']
    assert questions[2].text == rows[2]['text']
    assert questions[2].correct_answer == rows[2]['correct_answer']
    ai.assert_not_called()


@pytest.mark.parametrize('answer,expected', [('a', ['A']), ('A.', ['A']), ('A. Yes', ['A']), ('Yes', ['A']), ('A, B', ['A', 'B']), (['a', 'b'], ['A', 'B'])])
def test_explicit_key_normalization(answer, expected):
    fields = parser._answer_fields({'a': 'Yes', 'b': 'No'}, answer)
    actual = fields.get('extended_config', {}).get('correct_option_ids') or [fields['correct_option_id']]
    assert actual == expected


def test_key_letter_takes_precedence_over_option_text():
    assert parser._answer_fields({'A': 'X', 'B': 'A'}, 'A')['correct_option_id'] == 'A'


def test_missing_answers_are_not_guessed():
    with pytest.raises(ValueError, match=r'question\(s\): 2'):
        parser.parse_testbank_hybrid('1. Good?\nA. Yes\nB. No\nAnswer: A\n2. Missing?\nA. Yes\nB. No', uuid4(), use_ai_fallback=False)


def test_fake_rtf_rejected():
    with pytest.raises(HTTPException) as error:
        validate_upload(b'not rtf', 'bad.rtf', True)
    assert error.value.status_code == 422


def test_ai_answer_keys_are_normalized_and_still_require_review(monkeypatch):
    from types import SimpleNamespace
    from app.services import openai_client
    client = MagicMock()
    client.create_chat_completion.return_value = SimpleNamespace(choices=[SimpleNamespace(
        finish_reason='stop', message=SimpleNamespace(content=json.dumps({'questions': [
            {'text': 'Pick primes', 'options': {'a': '2', 'b': '4', 'c': '7'}, 'correct_answer': ['a', 'c']}
        ]})))])
    monkeypatch.setattr(openai_client, 'OpenAIClientWithRetry', lambda **kwargs: client)
    questions = validate_questions(parser.parse_testbank_with_ai('Question: pick primes', uuid4()))
    assert questions[0].extended_config['correct_option_ids'] == ['A', 'C']
    assert questions[0].status == 'unreviewed'
    assert questions[0].is_ai_generated is True
