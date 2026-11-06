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


EXPORTERS = {
    'rtf': "import {buildQuestionsRTF} from './Frontend/lib/testbankExport.mjs'; let s=''; for await(const c of process.stdin) s+=c; process.stdout.write(buildQuestionsRTF(JSON.parse(s),'Calculus'));",
    'pdf': ("import {createRequire} from 'module'; const require=createRequire(process.cwd()+'/Frontend/package.json');"
            "const pdfMake=require('pdfmake/build/pdfmake.js'); const fonts=require('pdfmake/build/vfs_fonts.js');"
            "pdfMake.vfs=fonts.pdfMake?fonts.pdfMake.vfs:fonts;"
            "const {buildQuestionsPdfDefinition}=await import(process.cwd()+'/Frontend/lib/testbankExport.mjs');"
            "let s=''; for await(const c of process.stdin) s+=c;"
            "pdfMake.createPdf(buildQuestionsPdfDefinition(JSON.parse(s),'Calculus')).getBuffer(b=>process.stdout.write(Buffer.from(b)));"),
}


def export(rows, fmt):
    """Run the real frontend serializer so the test tracks what teachers download."""
    root = Path(__file__).resolve().parents[3]
    return subprocess.run(['node', '--input-type=module', '-e', EXPORTERS[fmt]],
                          input=json.dumps(rows).encode(), capture_output=True, cwd=root, check=True).stdout


@pytest.mark.parametrize('fmt', ['rtf', 'pdf'])
def test_export_import_preserves_keys_and_math(tmp_path, monkeypatch, fmt):
    long_text = 'Which statement about relational keys is true when ' + 'the table has many attributes and constraints ' * 4 + '?'
    rows = [
        {'type': 'mcq', 'text': r'What is $\\frac{1}{2}$?', 'options': {'A': '½', 'B': '2'}, 'correct_option_id': 'A'},
        {'type': 'mcq_multiple', 'text': 'Select primes', 'options': {'A': '2', 'B': '4', 'C': '7'}, 'extended_config': {'correct_option_ids': ['A', 'C']}},
        {'type': 'short', 'text': 'Explain café and λ', 'correct_answer': 'A written answer with {braces} and λ.'},
        {'type': 'mcq', 'text': long_text, 'options': {'A': 'A key that ' + 'wraps onto a second line ' * 4, 'B': 'No'}, 'correct_option_id': 'A'},
    ]
    content = export(rows, fmt)
    assert validate_upload(content, f'questions.{fmt}', True) == fmt
    path = tmp_path / f'questions.{fmt}'
    path.write_bytes(content)
    from app.utils import text_extractor
    monkeypatch.setattr(text_extractor, 'extract_text_with_llamaparse',
                        MagicMock(side_effect=AssertionError('own exports must not go through LlamaParse')))
    text = extract_text_from_file(str(path), fmt, is_testbank=True)['text']
    ai = MagicMock(side_effect=AssertionError('export/import must not call AI'))
    monkeypatch.setattr(parser, 'parse_testbank_with_ai', ai)
    questions = validate_questions(parser.parse_testbank_hybrid(text, uuid4()))
    assert len(questions) == 4
    assert questions[0].text == rows[0]['text']
    assert questions[0].options == rows[0]['options']
    assert questions[0].correct_option_id == 'A'
    assert questions[1].type == 'mcq_multiple'
    assert questions[1].extended_config['correct_option_ids'] == ['A', 'C']
    assert questions[2].text == rows[2]['text']
    assert questions[2].correct_answer == rows[2]['correct_answer']
    # Wrapped lines rejoin exactly (single spaces, nothing lost).
    assert questions[3].text == ' '.join(long_text.split())
    assert questions[3].options['A'] == ' '.join(rows[3]['options']['A'].split())
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


@pytest.mark.parametrize('fmt', ['rtf', 'pdf'])
def test_export_import_preserves_fill_blank_and_multi_part(tmp_path, monkeypatch, fmt):
    rows = [
        {'type': 'fill_blank', 'text': 'The ___ key identifies a row; a ___ key references another table.',
         'extended_config': {'blanks': [{'position': 0, 'correct_answers': ['primary', 'main']},
                                        {'position': 1, 'correct_answers': ['foreign']}]}},
        {'type': 'multi_part', 'text': 'Answer both parts.', 'extended_config': {'sub_questions': [
            {'id': 'a', 'type': 'short', 'text': 'Define a superkey.', 'correct_answer': 'A set of attributes that identifies rows'},
            {'id': 'b', 'type': 'mcq', 'text': 'Is a candidate key minimal?', 'options': {'A': 'Yes', 'B': 'No'}, 'correct_option_id': 'A'},
        ]}},
        {'type': 'mcq', 'text': 'Plain question after the rich types', 'options': {'A': 'x', 'B': 'y'}, 'correct_option_id': 'B'},
    ]
    path = tmp_path / f'questions.{fmt}'
    path.write_bytes(export(rows, fmt))
    text = extract_text_from_file(str(path), fmt, is_testbank=False)['text']
    monkeypatch.setattr(parser, 'parse_testbank_with_ai', MagicMock(side_effect=AssertionError('no AI')))
    questions = validate_questions(parser.parse_testbank_hybrid(text, uuid4()))

    blank, multi, plain = questions
    assert blank.type == 'fill_blank'
    assert blank.text == rows[0]['text']
    assert blank.extended_config['blanks'] == rows[0]['extended_config']['blanks']

    assert multi.type == 'multi_part'
    assert multi.text == rows[1]['text']
    parts = multi.extended_config['sub_questions']
    assert [(p['id'], p['type'], p['text']) for p in parts] == [('a', 'short', 'Define a superkey.'), ('b', 'mcq', 'Is a candidate key minimal?')]
    assert parts[0]['correct_answer'] == rows[1]['extended_config']['sub_questions'][0]['correct_answer']
    assert parts[1]['options'] == {'A': 'Yes', 'B': 'No'} and parts[1]['correct_option_id'] == 'A'

    assert plain.type == 'mcq' and plain.correct_option_id == 'B'


def test_fill_blank_missing_key_is_rejected():
    text = '1. The ___ key.\nBlank 1: ___\nAnswer: Blank 1:'
    with pytest.raises(ValueError, match=r'question\(s\): 1'):
        parser.parse_testbank_hybrid(text, uuid4(), use_ai_fallback=False)
