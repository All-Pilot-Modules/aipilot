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
