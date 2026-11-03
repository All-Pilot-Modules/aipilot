import json
import logging
import pytest
from sqlalchemy import create_engine, text
from app.core.latency import span, instrument_engine, trace_id


def events(caplog):
    return [json.loads(r.message.split('LATENCY ', 1)[1]) for r in caplog.records if 'LATENCY ' in r.message]


def test_nested_spans_share_trace_and_record_errors(monkeypatch, caplog):
    monkeypatch.setenv('LATENCY_ENABLED', '1')
    caplog.set_level(logging.INFO, logger='app.latency')
    with pytest.raises(ValueError):
        with span('outer'):
            with span('inner'):
                raise ValueError('private answer should not be logged')
    result = events(caplog)
    assert len(result) == 2
    assert result[0]['trace_id'] == result[1]['trace_id']
    assert all(r['outcome'] == 'error' and r['duration_ms'] >= 0 for r in result)
    assert 'private answer' not in caplog.text
    assert trace_id.get() is None


def test_database_success_and_failure_without_sql(monkeypatch, caplog):
    monkeypatch.setenv('LATENCY_ENABLED', '1')
    caplog.set_level(logging.INFO, logger='app.latency')
    engine = create_engine('sqlite://')
    instrument_engine(engine)
    with engine.connect() as conn:
        conn.execute(text("select 'secret-answer'"))
        with pytest.raises(Exception):
            conn.execute(text('select * from missing_table'))
    assert [e['outcome'] for e in events(caplog)] == ['ok', 'error']
    assert 'secret-answer' not in caplog.text
    engine.dispose()


def test_http_timings_use_route_template(client, monkeypatch, caplog):
    monkeypatch.setenv('LATENCY_ENABLED', '1')
    caplog.set_level(logging.INFO, logger='app.latency')
    result = client.get('/api/student/modules/00000000-0000-0000-0000-000000000001/survey?student_id=private')
    assert 'app;dur=' in result.headers['server-timing']
    assert len(result.headers['x-latency-trace']) == 32
    request = next(e for e in events(caplog) if e['stage'] == 'http.request')
    assert request['route'] == '/api/student/modules/{module_id}/survey'
    assert 'private' not in json.dumps(events(caplog))


def test_cloud_formatter_outputs_searchable_json():
    from app.core.latency import CloudLatencyFormatter
    record = logging.LogRecord('app.latency', logging.INFO, '', 0,
        'LATENCY %s', (json.dumps({'stage': 'feedback.job.started', 'job_id': 'job-1'}),), None)
    payload = json.loads(CloudLatencyFormatter().format(record))
    assert payload['component'] == 'feedback_latency'
    assert payload['severity'] == 'INFO'
    assert payload['job_id'] == 'job-1'


def test_job_correlation_reaches_nested_model_spans_and_resets(monkeypatch, caplog):
    from app.core.latency import correlation, event
    monkeypatch.setenv('LATENCY_ENABLED', '1')
    caplog.set_level(logging.INFO, logger='app.latency')
    with pytest.raises(ValueError):
        with correlation(job_id='job-1', answer_id='answer-1'):
            with span('openai.chat.attempt'):
                raise ValueError('private prompt')
    event('outside')
    nested, outside = events(caplog)
    assert nested['job_id'] == 'job-1'
    assert nested['answer_id'] == 'answer-1'
    assert nested['outcome'] == 'error'
    assert 'job_id' not in outside
    assert 'private prompt' not in caplog.text


def test_cloud_enables_timings_unless_explicitly_disabled(monkeypatch):
    from app.core.latency import enabled
    monkeypatch.delenv('LATENCY_ENABLED', raising=False)
    monkeypatch.setenv('K_SERVICE', 'backend')
    assert enabled()
    monkeypatch.setenv('LATENCY_ENABLED', '0')
    assert not enabled()
