# Backend Deployment Guide — AI Pilot

## Cloud Run Settings (europe-west1)

| Setting | Value | Why |
|---|---|---|
| Memory | 2 GiB | llama-index + 10 concurrent OpenAI threads + SQLAlchemy pool |
| CPU | 2 | Feedback worker runs 10 parallel threads; 1 CPU starves them |
| Billing | **Instance-based** | Worker runs between requests — request-based throttles CPU to zero between requests, stalling feedback |
| Execution environment | Second generation | Better CPU and network performance |
| Startup CPU boost | On | Python with heavy imports (llama-index, SQLAlchemy) is slow to start |
| Concurrent requests per instance | 40 | Mastery endpoint blocks up to 45s; 80 concurrent would exhaust threads |
| Request timeout | 300s | Covers mastery AI calls (up to 45s) with plenty of headroom |
| Min instances | 2 | Always 2 warm instances — no cold starts for students |
| Max instances | 25 | Handles end-of-deadline bursts |

> **Why Instance-based billing matters:** The feedback worker is a background thread that runs 24/7 processing AI feedback jobs. With request-based billing, Cloud Run throttles the CPU to near-zero when no HTTP request is active. The worker appears to be running but makes no progress. Students submit tests and never get feedback. Instance-based billing keeps the CPU fully available at all times.

---

## Environment Variables (set in Cloud Run → Variables & Secrets)

```
# Required
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://...@aws-1-us-east-1.pooler.supabase.com:6543/postgres
JWT_SECRET=...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=...
FRONTEND_URL=https://your-frontend-domain.com

# Optional — add more OpenAI keys to multiply rate limits
# Each key gets its own rate limit bucket. 3 keys = 3x capacity.
OPENAI_API_KEY_2=sk-...
OPENAI_API_KEY_3=sk-...
OPENAI_API_KEY_4=sk-...
OPENAI_API_KEY_5=sk-...

# Optional
LLM_MODEL=gpt-4o-mini
ENV=production
```

---

## Before Every Deploy — Run Alembic

Schema changes are managed by Alembic. Never add `create_all()`.

```bash
cd Backend
source venv/bin/activate

# After any model change:
alembic revision --autogenerate -m "describe what changed"
# Review the generated file in alembic/versions/ before applying
alembic upgrade head
```

---

## Architecture Notes

### Feedback Worker — Leader Election

With 25 Cloud Run instances, all 25 used to run their own feedback worker (10 threads each = 250 concurrent OpenAI calls → rate limit 429s → students don't get feedback on busy days).

**Fix:** Leader election via `worker_lock` table. Only one instance wins the election and runs the worker. The others handle HTTP requests only.

- Leader holds a row in `worker_lock` (id=1)
- Heartbeat updated every 30s
- If heartbeat goes stale (>90s), any instance can take over
- Total concurrent OpenAI calls: always 10 max → ~200 RPM → no rate limits

```
Instance A → wins election → runs worker (10 threads)
Instance B → loses election → handles HTTP only
Instance C → loses election → handles HTTP only
...
Instance A dies → heartbeat stops
90s later → Instance B steals lock → starts worker
```

### Job Queue — PostgreSQL with SKIP LOCKED

Feedback jobs live in the `feedback_jobs` table. The worker uses `SELECT FOR UPDATE SKIP LOCKED` to claim jobs atomically. Multiple instances can safely poll the same table — they will never pick up the same job twice.

Jobs survive server restarts because they live in the database, not memory.

### Multiple OpenAI Keys

Set `OPENAI_API_KEY_2`, `OPENAI_API_KEY_3`, etc. in Cloud Run env vars. The client round-robins across all available keys automatically. Each key has its own rate limit bucket. 3 keys = 3x throughput.

### Why No Redis

- Job queue: PostgreSQL SKIP LOCKED is production-grade, no Redis needed
- Caching: In-memory question cache removed — caused stale data across instances. Direct DB reads are fast enough with Supabase's PgBouncer
- Distributed locks: Leader election uses the DB directly

### DB Connection Pool

With 25 instances × pool_size=5 = 125 connections max. Supabase's PgBouncer (port 6543) multiplexes these onto fewer actual Postgres connections. Monitor via:

```sql
SELECT count(*) FROM pg_stat_activity;
```

If approaching your Supabase plan limit, reduce in `database.py`:
```python
engine = create_engine(DATABASE_URL, pool_size=2, max_overflow=3)
```

---

## Common Issues

| Error | Cause | Fix |
|---|---|---|
| Students not getting feedback | Request-based billing throttles worker CPU | Switch to Instance-based |
| `UndefinedColumn` | Model changed, migration not run | `alembic upgrade head` |
| `from_orm` error | Pydantic v2 — use `model_validate()` instead | Already fixed |
| Mastery timeout | Synchronous OpenAI call in request thread | Timeout set to 45s in auth.js |
| 429 rate limits on busy days | Too many concurrent OpenAI calls | Add more API keys + leader election limits concurrency to 10 |
| `TypeError: Failed to fetch` | Backend not running or CORS misconfiguration | Check FRONTEND_URL env var |
