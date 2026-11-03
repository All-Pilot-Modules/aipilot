# Diagnose feedback latency on Cloud Run

Cloud Run captures single-line JSON on stdout in Cloud Logging. No container log
file, new dependency, database migration, or service-account permission is needed.
Deploy this revision to enable timing automatically when K_SERVICE is present.
LATENCY_ENABLED=0 disables it; LATENCY_ENABLED=1 enables it locally. Local logs
retain the LATENCY prefix understood by scripts/latency_report.py.

In Google Cloud Console → Logging → Logs Explorer, select your project:

```
resource.type="cloud_run_revision"
resource.labels.service_name="YOUR_BACKEND_SERVICE"
jsonPayload.component="feedback_latency"
jsonPayload.stage="feedback.submission"
```

Find the submission by timestamp/module_id/submission_id. Its answer_ids link it
to workers, even when autosave and submission run on different replicas. The
submission ID is also returned by submit-test. reused_count tells how many answers
were already graded; in_flight_count counts jobs promoted to urgent; new_job_count
counts answers needing fresh jobs. An enqueue event with committed=false is an
insert in an uncommitted transaction, not proof the transaction succeeded.

Copy an answer ID from the submission, then use:

```
resource.type="cloud_run_revision"
resource.labels.service_name="YOUR_BACKEND_SERVICE"
jsonPayload.component="feedback_latency"
jsonPayload.answer_id="ANSWER_ID"
```

Sort chronologically. feedback.job.enqueued priority=3 means speculative grading;
priority=1 means urgent. feedback.job.started includes job_id, retry_count,
priority, instance_id, and age_at_start_ms. This age is time since creation,
INCLUDING prior execution/backoff on retries; it is NOT pure queue wait on retries.
Nested openai.chat.attempt, openai.chat.total, get_context_for_feedback, and
DB timings carry the same job_id and answer_id. duration_ms is milliseconds.
feedback.job.finished gives status, attempt_duration_ms, retry_count,
error_category, and next_available_at. status=queued means another retry;
status=failed means exhausted/failed; status=done means the worker finished.
A started event with no finished event can indicate a killed/stalled instance;
check that revision's system logs. No enqueue before submission can mean the
speculative request failed, was never sent, or grading was disallowed by policy.

For slow model calls:

```
resource.type="cloud_run_revision"
jsonPayload.component="feedback_latency"
jsonPayload.stage="openai.chat.attempt"
jsonPayload.duration_ms>10000
```

For retrying/failed jobs:

```
resource.type="cloud_run_revision"
jsonPayload.component="feedback_latency"
jsonPayload.stage="feedback.job.finished"
(jsonPayload.status="queued" OR jsonPayload.status="failed")
```

Use the Logs Explorer download action to export matching records as JSON for
analysis. Restrict the time window to the test. These events contain opaque IDs
and operational metadata, not answer text, prompts, credentials, or exception
messages. This is not a privacy audit of existing application logs.

These logs measure backend work, not the moment the browser paints feedback.
http.request includes route/status/duration and a response x-latency-trace header.
An SSE request duration measures the open stream, not model generation latency.
No alerts or cloud resources are created by this change. Consider log retention
and volume (especially db.execute events) when leaving instrumentation enabled.
