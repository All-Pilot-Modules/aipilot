# Feedback retry verification

The student status endpoint and SSE stream use the same job selection: prefer an
active job; otherwise use the newest job by creation time and ID. Completed
fallback text does not count as ready. Failed jobs finish monitoring but are
counted separately from ready feedback. Active retries remain pending.

Cleanup does not time out feedback owned by an active queue job. Worker stale-job
recovery handles those jobs. While generating, a worker renews its claim every
20 seconds with a compare-and-swap on the previous claim timestamp. Renewal is
bounded to 10 minutes and stops on process shutdown or loss of leadership.
After renewal stops, the existing 120-second stale threshold permits recovery.
Renewals use one reserved database connection per worker process, allocated
lazily, to avoid contention with provider-waiting generation sessions. Renewal
queries have a 5-second statement timeout and a 2-second lock timeout.

The worker retries untagged fallbacks too, and verifies that completed feedback
was saved before marking a job done. OpenAI retry exhaustion preserves the
original exception type for error categorization.

The browser switches from an expired SSE stream to polling and slows to one
status request per 30 seconds after six minutes. Viewing another attempt switches
monitoring to that attempt. Closing the page stops monitoring, not the queue job.

## Local verification

From Backend:

```sh
PYTHONDONTWRITEBYTECODE=1 venv/bin/python -m pytest tests/platform/test_feedback_reliability.py tests/platform/test_worker.py -q
```

From Frontend:

```sh
npm test
```

These tests use SQLite and mocked providers. They cover state transitions,
stream status, cleanup guards, lease ownership, bounded renewal and persistence
failure handling. They do not validate live PostgreSQL locking or OpenAI uptime.

Restart the backend and the actual leader worker with this checkout to apply
changes. No database migration is needed for these reliability changes. A
nonleader's latency log cannot show another process's feedback-generation errors.
Retry an existing failed item after the worker restart, then check the active
worker's log for the job's error category and retry outcome.
