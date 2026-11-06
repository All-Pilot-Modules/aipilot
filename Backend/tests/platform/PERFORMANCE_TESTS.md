# Performance regression checks

Run from Backend using the project's Python environment:

```sh
python -m pytest tests/platform/test_performance_contracts.py tests/platform/test_feedback_runtime_recovery.py tests/platform/test_worker.py -q
```

These tests run offline. They assert behavior that caused the observed latency,
not a wall-clock response time that varies by CI machine:

- A 10-question pregraded quiz does not generate feedback again on submission.
- Editing one answer queues only that answer; submission does not invoke AI.
- Repeated speculative saves, including edits, reuse one queued job.
- Pregraded submissions stay within a fixed SELECT query budget for 1 and 10
  answers, detecting per-answer query growth. Scoring is isolated in this check.
- During an AI call, another request can borrow the only connection in a real
  SQLAlchemy QueuePool. Holding a connection across the provider call fails this
  test. It uses a disposable SQLite database, not Supabase.
- Existing runtime tests check RAG connection release, stalled-worker leadership
  release, and retention of a live thread handle during shutdown.
- Existing worker tests check scheduled retry backoff and exhausted failures.

The Platform tests workflow runs these on relevant PRs. Backend Deploy also runs
this subset before building/deploying; failure blocks that workflow's deploy job.
This does not configure repository branch protection or block manual cloud deploys.

This suite cannot guarantee every change is fast. It does not measure real
OpenAI/network latency, PostgreSQL lock contention, Cloud Run CPU allocation,
large-class throughput, or browser rendering. Use structured production timings
for those; see ../../docs/feedback-latency.md. No live credentials are needed here.
