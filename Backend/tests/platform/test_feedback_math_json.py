import json
import pytest
from app.services.ai_feedback import _loads_feedback_json


def test_mixed_escaped_and_bare_latex():
    raw = r'{"explanation":"Use $\\frac{1}{2}$ with $\sqrt{x}$ and $\times$.","score":50}'
    assert _loads_feedback_json(raw) == {'explanation': r'Use $\frac{1}{2}$ with $\sqrt{x}$ and $\times$.', 'score':50}


def test_valid_json_preserves_math_quotes_unicode_and_prose_newlines():
    expected = {'explanation': 'First\nnext line\t"quoted" π ' + r'$$\begin{pmatrix}1&2\\3&4\end{pmatrix}$$'}
    assert _loads_feedback_json(json.dumps(expected)) == expected


@pytest.mark.parametrize('command', ['frac', 'times', 'beta', 'right', 'nabla', 'sqrt', 'int'])
def test_unescaped_math_commands_survive(command):
    raw = '{"explanation":"$' + chr(92) + command + '{x}$"}'
    assert _loads_feedback_json(raw)['explanation'] == '$' + chr(92) + command + '{x}$'


def test_paren_delimited_math_and_bare_commands_survive():
    """Observed live: \\frac and \\right inside \\( \\) came back as 'rac' and 'ight'."""
    b = chr(92)
    raw = ('{"explanation":"is ' + b + '(' + b + 'frac94' + b + ') at ' + b + '(' + b + 'left(-' + b + 'frac{1}{2}, '
           + b + 'pm ' + b + 'frac{' + b + 'sqrt{3}}{2}' + b + 'right)' + b + ') and ' + b + 'theta ' + b + 'neq 0"}')
    expected = ('is ' + b + '(' + b + 'frac94' + b + ') at ' + b + '(' + b + 'left(-' + b + 'frac{1}{2}, '
                + b + 'pm ' + b + 'frac{' + b + 'sqrt{3}}{2}' + b + 'right)' + b + ') and ' + b + 'theta ' + b + 'neq 0')
    assert _loads_feedback_json(raw)['explanation'] == expected


def test_prose_newlines_and_tabs_outside_math_stay_escapes():
    assert _loads_feedback_json(r'{"explanation":"Step one.\nThe next\tthing"}')['explanation'] == 'Step one.\nThe next\tthing'


def test_truncated_response_still_fails():
    with pytest.raises(json.JSONDecodeError):
        _loads_feedback_json('{"explanation":"unfinished')
