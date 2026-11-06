core of the idea




important command

`ash Backend/scripts/capture_latency.sh`

**Leader election** uses the **`worker_lock` table**

`ThreadPoolExecutor`


* **Heartbeats and leases** track worker ownership and allow recovery after failures.
* The frontend receives progress through **SSE (Server-Sent Events)** and  **polling** .


* `Python PostgreSQL background job queue`
* `database leader election heartbeat lease`
* `Python ThreadPoolExecutor background workers`
* `FastAPI SSE background job progress`





Browser → Local FastAPI → Supabase database stores job
                               ↑
                    Local Python worker picks it up
                               ↓
                    Calls AI → saves feedback in DB
Supabase still hosts the database remotely. Your laptop runs the API and worker.

Right now, localhost and Cloud Run both connect to the same database. Both try to become the worker leader. Cloud Run won, so:

- Your laptop receives answers and queues jobs.
- Cloud Run picks up those jobs and processes them.
- Your laptop reads the results and shows them.
  If the cloud worker stops, the local worker should take












while generating question is it actually lookiing for the thniges that provided  by teacher the costum instruction


---

# Study guide: background workers in this project

Every idea below is used in this codebase. Each section says what the idea is, why it exists, and where to read the real code.
Main files:
- `Backend/app/services/feedback_worker.py`: AI feedback jobs. Uses leader election, heartbeats, leases and a thread pool.
- `Backend/app/services/document_worker.py`: parsing uploaded documents. A simpler queue.
- `Backend/app/database.py`: database connection pools.
- `Backend/app/api/routes/feedback.py`: SSE progress stream.

---

## 0. The big picture

```
Student submits answers
        │
        ▼
FastAPI (/api/...)  ──INSERT──►  feedback_jobs table (status = 'queued')      ◄── the QUEUE
                                         │
                       ┌─────────────────┘  (only the LEADER instance reads it)
                       ▼
            Leader's worker loop  ──claims a batch──►  status = 'processing'
                       │
                       ▼
            ThreadPoolExecutor (4 threads) ── each calls OpenAI ── writes ai_feedback
                       │
                       ▼
            status = 'completed' / 'retry' / 'failed'
                                         │
Browser  ◄── SSE stream or polling ──────┘  (reads progress from the DB every 2s)
```

The database is the single source of truth. The API, the workers and the browser never talk to each other directly. They all read and write rows in the database.

---

## 1. A job queue stored in PostgreSQL

**What it is:** a "job" is one row in a table, here `feedback_jobs`. Each job has a `status`:

```
queued ──claim──► processing ──success──► completed
   ▲                  │
   │                  ├──error, retries left──► queued again (later, see backoff)
   │                  └──error, no retries left──► failed
   └── stale-lock reset (the worker died mid-job)
```

**Why a table and not Redis or RabbitMQ:** it's one fewer system to run. The job is created in the same transaction as the answer that needs it, so you can never end up with an answer that has no job.

**Ordering:** `ORDER BY priority, created_at`. A lower `priority` number runs first.
**Delayed jobs:** `available_at` lets a job wait before it can be claimed again. This is how retry backoff works.

Search terms: *"Postgres as a job queue"*, *"transactional outbox"*.

---

## 2. Row locks: `SELECT … FOR UPDATE SKIP LOCKED`

The most important idea here. See `_claim_next_jobs()` in feedback_worker.py and `run_once()` in document_worker.py.

```python
db.query(FeedbackJob)
  .filter(FeedbackJob.status == "queued")
  .order_by(FeedbackJob.priority, FeedbackJob.created_at)
  .with_for_update(skip_locked=True)   # ← SELECT ... FOR UPDATE SKIP LOCKED
  .limit(limit)
```

- **`FOR UPDATE`** locks the rows you selected until your transaction ends. Nobody else can change them meanwhile.
- **`SKIP LOCKED`**: if another worker already locked a row, skip it instead of waiting.

**Analogy:** a deli counter with ticket numbers. Two clerks never serve the same ticket, and a clerk never stands waiting for a ticket another clerk is holding. They take the next free one.

**Without it:** two workers both read job #7 as "queued", both call OpenAI, and you pay twice and get duplicate feedback. That's a classic *race condition*.

**Plain `FOR UPDATE` without SKIP LOCKED** is used in `_still_owns_job()`, where you *want* to wait for the one row you care about.

Search terms: *"SKIP LOCKED queue"*, *"row-level locking Postgres"*, *"race condition double processing"*.

---

## 3. Leader election with the `worker_lock` table

**Problem:** Cloud Run may run many copies of the backend, up to 25 per DEPLOY.md, and your laptop is one more. If all of them ran a feedback worker with 4 threads, that's up to 100 OpenAI calls at once. You'd hit rate limits (HTTP 429).
**Solution:** only one instance, the **leader**, runs the feedback worker.

`worker_lock` has exactly **one row (id = 1)**. Whoever's `instance_id` is in it is the leader. See `_try_claim_leadership()`:

```sql
INSERT INTO worker_lock (id, instance_id, heartbeat, acquired_at)
VALUES (1, :me, NOW(), NOW())
ON CONFLICT (id) DO UPDATE
   SET instance_id = :me, heartbeat = NOW(), ...
 WHERE worker_lock.heartbeat < NOW() - INTERVAL '90 seconds'   -- old leader looks dead
    OR worker_lock.instance_id = :me                            -- it's already me
    OR worker_lock.instance_id IS NULL;                         -- leader resigned cleanly
-- then: SELECT instance_id FROM worker_lock WHERE id = 1  → is it me?
```

That single SQL statement is atomic, so two instances can never both win.

- Each process gets a random `INSTANCE_ID` (a UUID) at startup.
- A loser logs **"lost leader election — retrying in 30s"**, the message from your logs. That's normal, not an error.
- On clean shutdown, `_release_leadership()` sets `instance_id = NULL` so the next leader doesn't wait 90 seconds.

⚠️ **Your situation:** your laptop and Cloud Run share one database, so they compete in the *same* election. Cloud Run won, so Cloud Run processes jobs your laptop created.

Search terms: *"leader election database lock"*, *"singleton row lock"*, *"split brain"*.

---

## 4. Heartbeats, leases and thresholds

A **lease** is a lock that expires unless you keep renewing it. A **heartbeat** is the renewal ("I'm still alive").
Why expire? If the leader crashes, it can't say "I quit". The lease running out is how everyone else finds out.

| Constant (feedback_worker.py) | Value | Meaning |
|---|---|---|
| `HEARTBEAT_INTERVAL` | 30 s | Leader updates `worker_lock.heartbeat` this often |
| `LEADER_TAKEOVER_SECONDS` | 90 s | Heartbeat older than this means the leader is considered dead and can be replaced |
| `LEADERSHIP_RETRY_SECONDS` | 30 s | How often non-leaders try again |
| `LOOP_HEALTH_TIMEOUT` | 60 s | If the worker loop hasn't ticked for this long, stop sending heartbeats |
| `WORKER_LIVENESS_CHECK_SECONDS` | 5 s | How often the supervisor checks its threads are alive |
| `STALE_LOCK_SECONDS` | 120 s | A job "processing" longer than this, with no renewal, goes back to the queue |
| `JOB_HEARTBEAT_SECONDS` | 20 s | Per-job lease renewal interval |
| `MAX_JOB_LEASE_SECONDS` | 600 s | One job may keep renewing for 10 min at most |

**The rule of thumb behind the numbers:** takeover (90 s) is 3 × heartbeat (30 s). One slow heartbeat, a network blip, doesn't trigger a false takeover, but a dead leader is replaced within about 1.5 minutes. The same idea applies to jobs: stale lock (120 s) is 6 × job heartbeat (20 s).

**Crashed vs hung:**
- *Crashed*: the thread is dead. The supervisor notices within 5 s via `_threads_alive()`, gives up leadership, and the threads are restarted.
- *Hung*: the thread is alive but stuck, for example waiting forever. The heartbeat thread checks `_last_loop_tick`. If the loop hasn't ticked for 60 s, it **stops renewing on purpose**, so another instance can take over. Without this, a stuck process would hold leadership forever.

Search terms: *"lease-based locking"*, *"heartbeat failure detection"*, *"liveness vs health check"*.

---

## 5. Job leases and compare-and-swap (CAS)

One job can take a long time; OpenAI is slow. While it runs, `_JobLease` renews the job's `locked_at` every 20 s.

`_renew_job_lease()` is a **compare-and-swap**: "update `locked_at` to now **only if** it still equals the value I saw".

```python
.filter(FeedbackJob.id == job_id,
        FeedbackJob.status == 'processing',
        FeedbackJob.locked_at == locked_at)      # ← the "compare"
.update({FeedbackJob.locked_at: renewed_at})     # ← the "swap"
```

If 0 rows changed, someone else owns the job now, so stop.
Before saving results, `_still_owns_job()` does the same check. That way a slow, "presumed dead" worker can't overwrite the result of the worker that took over. `locked_at` works like a **fencing token**: a value that changes on every claim, so an old owner can't act on a job it no longer holds.

Search terms: *"compare and swap optimistic concurrency"*, *"fencing token"*.

---

## 6. ThreadPoolExecutor (the execution pool)

```python
executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="fb-worker")
future = executor.submit(_process_single_job, job_id)
```

- A **pool** is a fixed set of reusable threads, here **4**. You hand it tasks, and it runs at most 4 at once.
- `submit()` returns a **Future**: a handle to a result that isn't ready yet. `future.done()` and `future.result()` read it later.
- The loop tracks free **slots**: `available_slots = MAX_WORKERS - len(active_futures)`. It only claims as many jobs as it has free threads, so it never grabs work it can't start.

**Why threads, given Python's GIL?** The GIL stops two threads running Python code *at the same time*. But these jobs mostly **wait on the network** (OpenAI, the database). While one thread waits, it releases the GIL and another runs. Threads are great for I/O-bound work and poor for CPU-bound work, where you'd use processes.

**Each thread gets its own DB session** (`SessionLocal()` inside `_process_single_job`). SQLAlchemy sessions are *not* thread-safe, so they must never be shared between threads.

**Shutdown:** `executor.shutdown(wait=True)` lets running jobs finish instead of killing them halfway.

Search terms: *"Python ThreadPoolExecutor futures"*, *"GIL I/O-bound vs CPU-bound"*, *"SQLAlchemy session per thread"*.

---

## 7. Database connection pools

Opening a Postgres connection is slow, about 50–200 ms. A **connection pool** keeps some connections open and reuses them. See `database.py`:

| Setting | Value | Meaning |
|---|---|---|
| `pool_size` | 5 | Connections kept open permanently |
| `max_overflow` | 5 | Extra temporary connections allowed during a burst, so 10 max |
| `pool_timeout` | 30 s | How long a request waits for a free connection before erroring |
| `pool_pre_ping` | True | Test a connection before using it, which drops dead ones |
| `pool_recycle` | 1800 s | Replace connections older than 30 min |

**The separate lease pool** (`new_lease_session()`, `pool_size=1, max_overflow=0`) exists because the 4 job threads can occupy every normal connection while they wait for OpenAI. If heartbeats used the same pool, a heartbeat could wait for a free connection, miss its deadline, and lose leadership while the leader is healthy. So heartbeats get **one reserved connection** of their own.

**Total connections = pool limit × number of processes.** Supabase caps the total, and port 6543 (PgBouncer) is a pooler in front of Postgres that shares connections between clients.

Search terms: *"SQLAlchemy connection pool pool_size max_overflow"*, *"pool exhaustion"*, *"PgBouncer transaction pooling"*.

---

## 8. Retries, exponential backoff and jitter

When a job fails, retry it, but **wait longer each time** (`_compute_backoff_seconds`):

```
delay = min(2 ** retry_count, 60) + random(0..1 s)
retry 1 → ~2 s,  2 → ~4 s,  3 → ~8 s,  4 → ~16 s,  5 → stop (max_retries = 5) → 'failed'
```

- **Exponential**: gives a struggling service, like OpenAI under a rate limit, time to recover.
- **Cap (60 s)**: never wait absurdly long.
- **Jitter (a random 0–1 s)**: if 50 jobs fail at once and all retry at exactly 2 s, they hit OpenAI together again. That's the *thundering herd*. Random jitter spreads them out.
- The wait is stored as `available_at` on the row, not as a `sleep()`, so no thread is blocked while it waits.
- The **worker loop** also backs off when the *database* is unreachable: `min(2 ** failures, 60)`.

Same idea in the frontend: `Frontend/lib/auth.js` → `apiClient.request` retries on 502/503/504 with `1000 * 2^attempt` ms, but **never retries** uploads, AI generation or mastery answers. Retrying those could create duplicates.

**Idempotent** means doing it twice has the same effect as doing it once. Only retry things that are idempotent, or that you've made safe to repeat.

Search terms: *"exponential backoff with jitter"*, *"thundering herd"*, *"idempotency"*.

---

## 9. Timeouts

| Where | Timeout | Why |
|---|---|---|
| `SET LOCAL statement_timeout = '5s'` (lease renewal) | 5 s | A heartbeat query must never hang |
| `SET LOCAL lock_timeout = '2s'` | 2 s | Don't wait forever for a row lock |
| Frontend `apiClient` default | 15 s | Normal API calls |
| Frontend uploads | 120 s | Storage upload, plus one retry on the server |
| Supabase storage client | 60 s | Set in `document_storage.py` |
| SSE stream | 6 min | Stop streaming eventually |

Rule: **every network call needs a timeout**. Without one, a stuck call blocks a thread forever.

---

## 10. Polling vs SSE: getting progress to the browser

- **Polling**: the browser asks "done yet?" every N seconds. Simple and works everywhere, but wasteful.
- **SSE (Server-Sent Events)**: the browser opens *one* long HTTP connection (`EventSource`), and the server *pushes* messages down it.

`feedback.py` streams `text/event-stream` events: `progress`, `complete`, `heartbeat`, `timeout`, `error`.
The server checks the DB every **2 s** (`POLL_DB_INTERVAL`), so the server polls the database and pushes to the browser.
SSE `heartbeat` events stop proxies from closing an idle connection. It's the same word as section 4, used for a different purpose.
`EventSource` can't send headers, so the token goes in the URL query string, which is a known trade-off.
If SSE fails, the frontend falls back to polling.

(WebSockets are two-way. SSE is one-way, server to browser, and simpler. One-way is all this needs.)

Search terms: *"Server-Sent Events FastAPI StreamingResponse"*, *"SSE vs WebSocket vs polling"*.

---

## 11. The document worker: same queue idea, no leader

`document_worker.py` uses the SKIP LOCKED queue from section 2 on the `documents` table (`processing_status = 'queued'`).
But it has **no leader election**. **Every** backend running it competes for queued documents. That's safe, because SKIP LOCKED prevents double processing.

### Case study: the RTF bug (Nov 6)

1. Your laptop backend had RTF support and accepted the upload: `POST /api/upload → 202`, file saved to storage.
2. The document row became `queued` in the **shared** Supabase database.
3. **Cloud Run**, running *older code* without RTF support, claimed it first and failed in 0.8 s: "Supported formats: docx, pdf, txt".
4. Your laptop never got to process it.

**Lesson:** in a shared-queue system, *every worker must run the same code version*. Otherwise whichever worker grabs a job decides how it's handled. The fixes: deploy first, give each environment its own database, or turn workers off (`DOCUMENT_WORKER_ENABLED=false`) where they shouldn't run.

---

## 12. Glossary (quick revision)

- **Worker**: a background loop that takes jobs and does them, outside any HTTP request.
- **Queue**: the list of work waiting to be done. Here, rows with `status='queued'`.
- **Lock**: exclusive ownership of something. *Row lock* = Postgres-level, held until the transaction ends. *Lease* = time-limited ownership that must be renewed.
- **Heartbeat**: a periodic "I'm alive" update.
- **Threshold**: the cutoff where behaviour changes, like 90 s for leader takeover or 120 s for a stale job.
- **Leader election**: picking exactly one instance to do a job.
- **Split brain**: two instances both think they're the leader. This design prevents it with the atomic upsert, stopping the loop before re-electing, and CAS checks.
- **Thread pool / executor**: a fixed set of reusable threads that run submitted tasks.
- **Future**: a placeholder for a result that isn't ready yet.
- **Connection pool**: reusable open DB connections.
- **Backoff / jitter**: waiting longer between retries, with randomness.
- **Idempotent**: safe to run more than once.
- **CAS (compare-and-swap)**: update only if the value is still what you expect.
- **Fencing token**: a value that changes on every claim, so an old owner can't overwrite new work (`locked_at`).
- **SSE**: a server-to-browser stream over one HTTP connection.

---

## 13. Test yourself

1. Two workers run `_claim_next_jobs` at the same moment. What stops them both claiming job #7?
2. The leader's laptop lid closes. How long until Cloud Run becomes leader, and why that number?
3. Why is the leader-takeover threshold 3× the heartbeat interval, not 1×?
4. A job takes 4 minutes on OpenAI. Why isn't it reset as "stale" after 120 s?
5. What breaks if the heartbeat used the main connection pool instead of `new_lease_session()`?
6. Why is `ThreadPoolExecutor` fine here despite the GIL?
7. 100 jobs fail at the same second. What does jitter change?
8. Why does the frontend never retry `/api/upload`, but does retry a normal GET?
9. Why could Cloud Run fail your RTF upload even though your laptop's code supported RTF?
10. What would happen if two threads shared one SQLAlchemy session?

(Answers are in sections 2, 4, 4, 5, 7, 6, 8, 8, 11, 6.)

## 14. Hands-on

- Watch the election: run the backend locally and look for `lost leader election` or `Feedback worker started`.
- See who's leader: `SELECT instance_id, heartbeat, NOW() - heartbeat AS age FROM worker_lock;`
- See the queue: `SELECT status, count(*) FROM feedback_jobs GROUP BY status;`
- Queue stats endpoint: `get_queue_stats()` in feedback_worker.py, which reports queue wait, generation time and error types.
- Latency script from your notes: `bash Backend/scripts/capture_latency.sh`. That command says `ash` at the top of this file; it should be `bash`.

---

# Learning roadmap

Go in this order; each stage uses the one before it. Plan on about **1 hour a day**. Each stage takes **3–5 days**, so the whole roadmap is roughly **5–7 weeks**.
Finish a stage when you can do its ✅ check without notes.

```
Stage 1  Python concurrency basics ──┐
Stage 2  SQL transactions & locks ───┼──► Stage 4  Job queues ──► Stage 5  Leases & leader election
Stage 3  Connection pools ───────────┘                                   │
                                                                         ▼
                     Stage 7  Real-time to browser  ◄── Stage 6  Retries, backoff, timeouts
                                    │
                                    ▼
                     Stage 8  Running it in production (deploys, environments, monitoring)
```

---

### Stage 1: Python concurrency basics (study guide §6)
**Learn:** what a thread is; the GIL; I/O-bound vs CPU-bound work; `threading.Thread`, `threading.Event`; `ThreadPoolExecutor`, `submit`, `Future`; daemon threads.
**Do:**
1. Write a 20-line script that "downloads" 10 URLs with `time.sleep(1)` each, first one at a time (10 s), then with `ThreadPoolExecutor(max_workers=4)` (about 3 s). Time both.
2. Make one task raise an exception, and see it only appear when you call `future.result()`.
3. Read `_worker_loop()` in `feedback_worker.py` and explain the `available_slots` logic out loud.

✅ *Check:* explain why 4 threads speed up OpenAI calls but wouldn't speed up resizing 1,000 images.

---

### Stage 2: SQL transactions and row locks (§2)
**Learn:** `BEGIN`/`COMMIT`/`ROLLBACK`; isolation levels (just Read Committed for now); `SELECT … FOR UPDATE`; `SKIP LOCKED`; deadlocks; `lock_timeout` and `statement_timeout`.
**Do:**
1. Open **two** `psql` sessions on a local Postgres (not the shared Supabase database).
   - Session A: `BEGIN; SELECT * FROM jobs WHERE id=1 FOR UPDATE;` (don't commit).
   - Session B: run the same query and watch it **wait**. Then try it with `SKIP LOCKED` and watch it **skip**.
2. Create a deadlock on purpose (A locks row 1 then 2, B locks 2 then 1) and read the error.
3. Read `_claim_next_jobs()` and `_still_owns_job()`: why does one skip and the other wait?

✅ *Check:* draw the timeline of two workers racing for the same job, with and without SKIP LOCKED.

---

### Stage 3: Connection pools (§7)
**Learn:** why connections are expensive; `pool_size`, `max_overflow`, `pool_timeout`, `pool_pre_ping`, `pool_recycle`; pool exhaustion; PgBouncer.
**Do:**
1. Set `pool_size=1, max_overflow=0` in a scratch script and run 3 threads that each hold a session for 5 s. Watch the third one hit `pool_timeout`.
2. Explain why `new_lease_session()` has its own one-connection pool.
3. Work out: 25 Cloud Run instances × (5 + 5) connections = ? Compare that with your Supabase connection limit.

✅ *Check:* explain how pool exhaustion could make a *healthy* leader lose leadership.

---

### Stage 4: Job queues (§1, §11)
**Learn:** queue as a table; job status lifecycle; ordering and priority; delayed jobs (`available_at`); at-least-once vs exactly-once delivery; idempotent jobs.
**Do:**
1. Build a **mini queue** yourself, about 60 lines, in a scratch folder: a `jobs` table, a `claim()` using SKIP LOCKED, and 3 worker threads each printing the jobs they processed. Prove no job runs twice.
2. Kill a worker halfway through. What happens to its job? (Answer: it's stuck. That's the motivation for Stage 5.)
3. Compare `document_worker.py` (about 60 lines) with `feedback_worker.py` (about 1,200 lines). List what the big one adds.

✅ *Check:* explain why "exactly once" is very hard, and how idempotency lets you settle for "at least once".

---

### Stage 5: Leases, heartbeats and leader election (§3, §4, §5)
**Learn:** lease vs lock; heartbeat; choosing thresholds (the 3× rule); leader election using one row; split brain; crashed vs hung; compare-and-swap; fencing tokens.
**Do:**
1. Add to your mini queue: a `locked_at` column, a heartbeat thread that renews it, and a reaper that re-queues jobs with `locked_at` older than 30 s. Kill a worker and watch its job come back.
2. Add a `leader` table with one row, and copy the `INSERT … ON CONFLICT … WHERE heartbeat < NOW() - interval` trick from `_try_claim_leadership()`. Run 2 processes and watch only one lead. Kill it and time the takeover.
3. Simulate a *hung* leader: make the loop `sleep(1000)` and confirm leadership is still released, the way `LOOP_HEALTH_TIMEOUT` does it.

✅ *Check:* answer self-test questions 2, 3, 4 and 5 from the study guide.

---

### Stage 6: Retries, backoff and timeouts (§8, §9)
**Learn:** transient vs permanent errors; exponential backoff; jitter; max retries; idempotency keys; timeouts on every network call.
**Do:**
1. Add retries to your mini queue: on failure set `available_at = now + 2^retry + random()`, and give up after 5.
2. Read `_categorize_error()` in feedback_worker.py. Which errors deserve a retry, and which don't?
3. Read `apiClient.request` in `Frontend/lib/auth.js`. List every endpoint with `retries = 0` and say why.

✅ *Check:* explain the thundering herd problem and how jitter fixes it, with a quick sketch.

---

### Stage 7: Real-time progress to the browser (§10)
**Learn:** polling; long polling; SSE (`EventSource`, `text/event-stream` format); WebSockets; reconnecting; keep-alive heartbeats.
**Do:**
1. Write a tiny FastAPI endpoint that streams `data: {i}\n\n` every second, and open it in the browser with `new EventSource(...)`.
2. Read `feedback.py`'s stream: find the disconnect check, the 6-minute cap and the heartbeat event.
3. Find the polling fallback in `Frontend/app/student/module/[moduleId]/page.js` (search for `useSSE`).

✅ *Check:* explain when you'd pick polling, SSE or WebSockets.

---

### Stage 8: Production (deploys, environments, monitoring) (§11 case study)
**Learn:** separate dev, staging and prod databases; rolling deploys; version skew; feature flags and env vars (`DOCUMENT_WORKER_ENABLED`); structured logs; metrics (queue wait time, error rate).
**Do:**
1. Re-read the **RTF case study**. Write down 3 ways it could have been prevented.
2. Create a **separate Supabase project for local dev** and point your laptop's `.env` at it. This fixes the shared-database problem for good.
3. Call `get_queue_stats()` (or its diagnostics endpoint) and interpret `avg_queue_wait_seconds` vs `avg_generation_seconds`.
4. Run `bash Backend/scripts/capture_latency.sh` and read what it measures.

✅ *Check:* explain why every worker sharing a queue must run the same code version.

---

### Further study, once the above feels easy
- **Books:** *Designing Data-Intensive Applications* (Kleppmann). Chapters 7 (transactions), 8 (distributed problems) and 9 (consensus) cover all of this in depth.
- **Ready-made queues:** Celery, RQ, Dramatiq, and Postgres-based ones (pgmq, Procrastinate). Compare them with this hand-built queue.
- **Consensus:** the Raft algorithm, where "real" leader election comes from. This project's single-row lock is a simpler version.
- **Observability:** OpenTelemetry tracing. See `correlation(...)` and `event(...)` in feedback_worker.py.

### Progress tracker
- [ ] Stage 1: concurrency basics
- [ ] Stage 2: transactions and locks
- [ ] Stage 3: connection pools
- [ ] Stage 4: job queues (mini queue built)
- [ ] Stage 5: leases and leader election (takeover timed)
- [ ] Stage 6: retries, backoff, timeouts
- [ ] Stage 7: SSE and polling
- [ ] Stage 8: production (separate dev DB set up)
