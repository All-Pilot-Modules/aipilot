from app.services.dashboard_insights import build_dashboard_insights


def row(student, question, attempt, score, status='completed'):
    return (f'{student}-{question}-{attempt}', student, question, None, attempt, score, status)


def test_retries_do_not_inflate_coverage_and_comparison_is_matched():
    result = build_dashboard_insights([row('a', 'q1', 1, 20), row('a', 'q1', 2, 80), row('a', 'q2', 1, 100)], 2)
    assert result['question_coverage'] == 100
    assert result['repeat_students'] == 1
    assert result['average_score_change'] == 60
    assert result['students'][0]['average_score'] == 90


def test_failed_latest_score_is_not_a_grade_or_replaced_by_old_score():
    result = build_dashboard_insights([row('a', 'q1', 1, 90), row('a', 'q1', 2, 50, 'failed'), row('b', 'q1', 1, 0)], 2)
    assert result['question_coverage'] == 50
    assert result['students_below_60'] == 1
    assert result['students'][1]['average_score'] is None
    assert result['question_difficulty'][0]['student_count'] == 1
    assert result['average_score_change'] is None


def test_empty_module():
    result = build_dashboard_insights([], 0)
    assert result['question_coverage'] == 0
    assert result['students'] == []
    assert result['average_score_change'] is None
