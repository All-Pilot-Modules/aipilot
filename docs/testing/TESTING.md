# Platform testing

This adds test cases and test infrastructure, not application fixes. A passing
platform contract suite does **not** mean the entire application is defect-free.

## Automated suites

From `Backend` using its virtual environment:

```sh
python -m pytest tests/platform -ra
python -m pytest tests -ra --junitxml=test-results/backend.xml
```

The first command runs new current-contract tests. The second also runs the older
suite, which currently has stale mocks/assertions and failures. Do not describe
the full suite as passing or remove those tests to get a green result.

From `Frontend` (Node 22.12+):

```sh
npm ci
npm test
npx playwright install chromium
npm run test:e2e
# Or use an already-installed Chrome:
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

Playwright starts its own Next.js server on port 3100. API calls are intercepted
with synthetic responses; all other non-test-server browser traffic is blocked.
These are UI contract tests, **not** full-stack end-to-end certification.

## Safety and isolation

- Backend tests force a SQLite in-memory database and fake provider credentials.
- Local dotenv loading and Infisical credentials are disabled before app imports.
- Network socket connections are rejected during tests. Mock OpenAI, LlamaParse,
  storage, email and other external services explicitly.
- Real feedback-worker startup/recovery/shutdown are disabled in HTTP fixtures.
- Each test gets a transaction with savepoints so application commits do not leak
  into the next test. SQLite UUID adaptation matches string UUIDs accepted by
  the production driver.
- Extractor tests generate real PDF/DOCX/PPTX/TXT samples in pytest temporary paths.
- No production data, real student identifiers, live secrets, or paid model calls
  are required. Browser reports contain only synthetic fixtures.
- SQLite cannot prove Postgres row locking, SKIP LOCKED, partial-index constraints,
  pgvector behavior, migration correctness, or cross-process concurrency. Those
  need a disposable Postgres/pgvector environment, not the production database.

## Coverage map

| Area | Automated coverage | Still needs manual / dedicated integration coverage |
|---|---|---|
| Teacher authentication | Login, incorrect password, refresh, access-token rejection on refresh | Email delivery, password reset UX, SSO if added |
| Student authentication | Missing/expired/wrong-module token, query spoofing | Verify institutional identity at join; multi-tab sessions |
| Frontend session | Refresh retry, 403 without logout, best-effort repeated 401, logout on expired session | Concurrent refresh race across tabs |
| Documents | Real local extraction of PDF/DOCX/PPTX/TXT, parser fallback, control-char sanitation | Scanned/image PDFs, tables, legacy DOC/PPT, large files |
| Document pipeline | Upload orchestration, persisted chunks, embedding stage, temporary-file cleanup | Live storage/provider behavior and restart recovery |
| Questions | Testbank options/answer extraction, generated MCQ/short/long require review, invalid model JSON | Full teacher authoring and approval UI |
| Question safety | All six question types omit answer-key fields from student JSON | Other teacher endpoints need their own authorization audit |
| Embeddings / RAG | Dimensions, batch provider call, error propagation, answer-specific cache keys | Actual pgvector ranking/index plans; changed-document cache invalidation |
| Autosave | All six answer formats, repeated save idempotency, spoofed identity rejection | Offline/reconnect and simultaneous tabs |
| Submission | One submission/job, duplicate submit rejection | Crash between transaction steps, final attempt and concurrent edits |
| Grading | MCQ success/cache, fallback tagging, multiple-choice scoring, fill-blank partial credit | Mathematical-equivalence quality and rubric evaluation |
| Worker | Provider error buckets, scheduled retry, retry exhaustion | Leadership restart, stale-write fencing, claim concurrency |
| Feedback | Unreleased hidden, released visible, cross-student isolation | Teacher release authorization and all rubric-display combinations |
| Chat | Create/read/delete and different-student ownership | Live tutor output, same-student different-module access |
| Surveys | Save/read response | Required fields, edited surveys, exports |
| Browser | Invalid login, invalid join, prose preservation and math render | Complete teacher-to-student journey against test backend |

## Known defects encoded as strict expected failures

`Backend/tests/platform/test_known_defects.py` contains:

- **BUG-MATH-JSON:** valid escaped LaTeX is altered by JSON repair.
- **BUG-TEACHER-AUTH:** released teacher feedback can be requested anonymously.
- **BUG-JOIN-IDENTITY:** a shared class code can mint a session for an existing student.

`xfail(strict=True)` keeps these visible as known defects. An unexpected pass
fails the suite so the marker must be removed after the fix is verified. These
markers are not evidence of working functionality and are not release approval.
To enforce all known expectations as ordinary failures:

```sh
python -m pytest tests/platform --runxfail
```

The browser invalid-code case also exposes **BUG-JOIN-ERROR**: a backend 404
is displayed as a network error. This remains an ordinary failing browser test;
application code was not changed to make it pass.

## CI and reports

Local verification on 2026-10-04:

- New backend suite: 69 passed, 3 expected failures.
- Frontend unit suite: 6 passed.
- Browser cases using installed Chrome: login and math editor passed; invalid
  class code failed (BUG-JOIN-ERROR). Math was rerun after correcting a selector
  that originally targeted a hidden preview.
- Older backend suite: 185 passed, 78 failed, 59 errors. It is not a green baseline.

`.github/workflows/platform-tests.yml` runs backend platform tests, the full older
backend suite as a separate job, frontend unit tests, and Chromium UI tests.
No failing job is allowed to silently pass. JUnit and browser traces are retained.
The full backend job is expected to expose existing failures until they are fixed.
Use the manual cases in `MANUAL_TEST_CASES.md` for release acceptance.

## Suggested performance experiment (not yet an automated load test)

On an isolated deployment, seed 10/50/100 synthetic students, each submitting
10 questions. Measure p50/p95 queue wait, generation time, total feedback latency,
DB pool waits, 429 rate, duplicate jobs, and final feedback counts. Repeat at
10 and 20 worker slots with identical inputs. Do not assert an invented latency
SLA; agree on an acceptance target and measure it. Never load-test production.
