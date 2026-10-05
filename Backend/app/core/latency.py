"""Opt-in, content-free duration logs. Enable with LATENCY_ENABLED=1."""
import contextvars
import functools
import json
import logging
import os
import time
import uuid
from contextlib import contextmanager

trace_id = contextvars.ContextVar('latency_trace', default=None)
logger = logging.getLogger('app.latency')


def enabled():
    return os.getenv('LATENCY_ENABLED', '0') == '1'


def record(stage, started, outcome='ok', **labels):
    if enabled():
        logger.info('LATENCY %s', json.dumps(dict(stage=stage,
            duration_ms=round((time.perf_counter() - started) * 1000, 3),
            outcome=outcome, trace_id=trace_id.get(), **labels)))


@contextmanager
def span(stage):
    if not enabled():
        yield
        return
    token = None
    if trace_id.get() is None:
        token = trace_id.set(uuid.uuid4().hex)
    started = time.perf_counter()
    outcome = 'ok'
    try:
        yield
    except BaseException:
        outcome = 'error'
        raise
    finally:
        record(stage, started, outcome)
        if token is not None:
            trace_id.reset(token)


def timed(stage):
    def decorate(fn):
        @functools.wraps(fn)
        def wrapped(*args, **kwargs):
            with span(stage):
                return fn(*args, **kwargs)
        return wrapped
    return decorate


def instrument_engine(engine):
    from sqlalchemy import event

    @event.listens_for(engine, 'before_cursor_execute')
    def before(conn, cursor, statement, parameters, context, executemany):
        if enabled():
            context._latency_start = time.perf_counter()

    @event.listens_for(engine, 'after_cursor_execute')
    def after(conn, cursor, statement, parameters, context, executemany):
        started = getattr(context, '_latency_start', None)
        if started is not None:
            record('db.execute', started)

    @event.listens_for(engine, 'handle_error')
    def error(context):
        started = getattr(context.execution_context, '_latency_start', None)
        if started is not None:
            record('db.execute', started, 'error')


class LatencyMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http' or not enabled():
            return await self.app(scope, receive, send)
        token = trace_id.set(uuid.uuid4().hex)
        started = time.perf_counter()
        status = 500
        async def measured_send(message):
            nonlocal status
            if message['type'] == 'http.response.start':
                status = message['status']
                message = dict(message)
                message['headers'] = list(message.get('headers', [])) + [
                    (b'server-timing', f'app;dur={(time.perf_counter()-started)*1000:.2f}'.encode()),
                    (b'x-latency-trace', trace_id.get().encode())]
            await send(message)
        try:
            await self.app(scope, receive, measured_send)
        finally:
            route = getattr(scope.get('route'), 'path', 'unmatched')
            record('http.request', started, 'error' if status >= 400 else 'ok', route=route, status=status)
            trace_id.reset(token)
