# Document uploads and deletion

Uploads require an active owner account. The owner is checked against the module;
student session tokens can only download non-testbank documents in their enrolled
module. Files are limited to 20 MB; accepted formats are PDF, DOCX, PPTX and TXT
(testbanks exclude PPTX). Legacy DOC/PPT must be converted. Testbank selection is
explicit in the UI; the filename heuristic remains for older clients.

Upload returns HTTP 202 and a document with `processing_status=queued`. Poll
`GET /api/documents/{id}`. Terminal states are `embedded`, `parsed`, and `failed`.
Failures contain a safe explanation in `processing_metadata.error` / `parse_error`.
Retry with POST `/reprocess` (course document) or `/reparse` (testbank). Limits are
5 queued files and 30 new uploads/hour per owner, plus 5 retries/hour/document.
Duplicates return the existing document without replacing storage or adding rows.
An interrupted upload retains a reserved storage key; re-uploading the same file
resumes it without overwriting different content.

The worker starts with the API unless DOCUMENT_WORKER_ENABLED=false. Cloud Run
must allocate CPU outside requests and keep a worker instance alive, or run
`python -m app.services.document_worker` as a dedicated worker. Do not rely on a
scale-to-zero request-only container for background processing. Queued rows survive
restarts. PostgreSQL row locks with SKIP LOCKED serialize processing with module
and document deletion. The processing transaction holds a connection and row
locks during external calls; one worker thread per process bounds concurrency.

Configure SUPABASE_PRIVATE_STORAGE_BUCKET (default documents-private). The service
creates it if absent and refuses a public bucket. It never changes the public
question-image bucket. Download clients first request `/download-url` with their
Authorization header, then open the returned five-minute signed URL.

Before rollout, stop uploads/workers and run from Backend:

```
python -m scripts.migrate_document_storage
python -m scripts.migrate_document_storage --apply
```

The first command previews changes. The second copies existing managed documents
to private storage, repairs filename-detected legacy testbanks, and removes old
public objects and shared parsed-question exports. Source cleanup failures are
recorded for the next run. Local filesystem references require manual re-import;
they are never served or deleted by the API. Verify old public URLs no longer
serve files; CDN cache expiration may also be necessary. No live migration is
performed by application startup. Take a database backup before migration.

Reparse validates all replacement questions before committing and refuses to
replace a bank with existing student answers. Upload a new version instead.
AI-assisted extraction goes to the unreviewed queue. Missing answers, empty/OCR
failures and incomplete embeddings cannot be marked ready. LlamaParse is required
for scanned PDFs and complex image/math DOCX files; failures preserve old results.

Deleting a document with keep-questions detaches questions and student answers
before deleting the source. Deleting a module always removes documents, questions,
answers, feedback/jobs/critiques, grades, queues, chats, submissions, enrollments,
claims, collaborators, batches, surveys, learning memory, chunks and embeddings
through the current schema's foreign-key cascades and ordered deletions. Managed
source files, legacy parsed exports and question images are removed too. Storage
failure leaves the module/document marked deleting with its database records
intact; retry DELETE to finish. Database and object storage cannot commit atomically:
a failed attempt may have removed some objects, but the retained keys make retries
idempotent. Never allow new work on a module marked deleting.

Validation: offline tests exercise authorization, atomic failure paths, storage
references, parser quality and related-record deletion. An isolated PostgreSQL 17 test also verifies concurrent claims, crash rollback,
module deletion locks, atomic question replacement and cascading module deletion.
Deployed schema cascades and Supabase permissions still require rollout verification.
