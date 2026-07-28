i

# What are my plans for now then

Round-Robin Load Balancer to use multiple api keys

Speculative/background AI feedback grading (start grading before student submits)

- Hook into /save-answer autosave (Backend/app/api/routes/student.py:578) with a client-side debounce (~3s idle) to enqueue a low-priority FeedbackJob (priority=3, "background-upgrade" - already defined in Backend/app/models/feedback_job.py:31 but unused)
- Solve stale-answer problem with content hashing: hash the answer at speculative-grade time, compare to current answer hash at /submit-test (student.py:682). Match = reuse cached result instantly. Mismatch/none = fall back to today's priority=1 job.
- If speculative job still queued/processing at submit time, just bump its priority to 1 instead of duplicating.
- If answer edited again after a speculative job queued, cancel it if still queued, or let it finish and discard via hash mismatch.
- Tradeoff to weigh before building: trades AI-API cost for latency - every draft-then-changed or draft-then-abandoned answer is a wasted paid AI call. Need debounce tuning to bound cost.

Fix GoDaddy SMTP auth failure for cs@brockportsigai.org (Backend/app/core/email.py)
- test_email.py (Backend/scripts/test_email.py) fails with 535 authentication rejected from smtpout.secureserver.net, even though the same password logs into GoDaddy webmail fine - so it's an account-side SMTP block, not a bad password or .env issue
- Check GoDaddy dashboard (My Products > Workspace Email > Manage) for cs@brockportsigai.org for a suspended/limited/security-hold status - repeated failed SMTP attempts may have triggered an anti-abuse hold
- If nothing shows in the dashboard, contact GoDaddy support directly - this pattern (webmail works, SMTP rejected, password confirmed correct) is usually an account-level hold only support can lift
- Once unblocked, re-run: cd Backend && source venv/bin/activate && python3 scripts/test_email.py <email> --type all
