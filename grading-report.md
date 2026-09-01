# Grading & Dashboard Reports — Current State Audit

Working reference doc. Pure audit of what exists today — no recommendations, no proposed fixes.
File:line refs are relative to repo root. Backend = FastAPI/SQLAlchemy under `Backend/`, Frontend = Next.js App Router under `Frontend/`.

---

## 1. Grading modes & pipeline

### Two modes only: `auto` / `manual`

`Module.ai_grading_mode` (`Backend/app/models/module.py:204`) is a flat string column, default `"auto"`, mirrored inside the `ai_config.grading.mode` JSONB blob (`Backend/app/models/module.py:8-20`) and again inside `assignment_config.grading.mode` (consumed by `Frontend/components/AssignmentFeaturesSelector.jsx`).

- **`auto`** — AI grades, feedback shown to student immediately.
- **`manual`** — AI still grades every answer, but nothing reaches the student until a teacher reviews and releases it (comment at `Backend/app/models/module.py:11-12`).

`Backend/alembic/versions/41958e8223a0_collapse_grading_modes_to_auto_manual.py` collapsed a former 4-way enum (`auto | teacher_assist | teacher_only | disabled`) down to these two:
- `teacher_assist` and `teacher_only` → `manual`. This **intentionally dropped** the old "hidden from student forever" behavior of `teacher_only` (migration docstring, lines 9-11).
- `disabled` (AI never grades) → `manual` too — AI now *always* grades; a teacher can still fully overwrite the grade before releasing (lines 11-13).
- Migration also backfills the `ai_config`/`assignment_config` JSONB mirrors and a `module_batches.ai_grading_mode` override column so stale enum values don't linger (lines 15-17, 41-64).
- **Downgrade is a no-op** — the original 4-way distinction is unrecoverable once collapsed (lines 67-72).

There's also a separate `require_teacher_approval` boolean (`ai_config.grading.require_teacher_approval`, default `False`, `Backend/app/models/module.py:18`) that acts as a safety net on top of `auto` mode: if set, the student's **final attempt only** is gated for teacher review even though earlier attempts show feedback immediately (see gating logic below).

### End-to-end submit → grade → release flow

1. **Autosave** (`POST /save-answer`, `Backend/app/api/routes/student.py:598-707`) — saves a draft answer, no grading by default.
   - `speculative=true` query param additionally calls `_maybe_queue_speculative_job()` (`student.py:710-771`), which enqueues a **priority=3 "background-upgrade"** `FeedbackJob` so the answer starts grading before the student submits.
     - Note: `Backend/plan.md` describes this as a *proposed future feature* ("Speculative/background AI feedback grading... priority=3, 'background-upgrade' - already defined... but unused"). **That note is stale** — the feature is fully implemented: content-hash dedup against in-flight jobs (`student.py:737-758`), reuse of already-completed same-content feedback (`student.py:728-735`), and silent failure (never breaks the autosave request, `student.py:770-771`).
2. **Submit** (`POST /modules/{module_id}/submit-test`, `student.py:774-969`):
   - Validates attempt count against `assignment_config.features.multiple_attempts.max_attempts` (default 2, `student.py:818-829`).
   - For every answer, computes `compute_answer_hash()` and compares against any already-completed `AIFeedback.content_hash` (`student.py:869-926`):
     - Exact match, not a fallback → **reused instantly**, no new AI call (`student.py:900-906`, `reused_count`).
     - A same-content job is already in flight (queued/processing, e.g. the speculative one) → **priority bumped to 1** instead of duplicating work (`student.py:908-926`, `bumped_count`).
     - Otherwise → new `priority=1` job created via `create_feedback_jobs_batch()` (`student.py:939-950`).
   - If **every** answer was reused (nothing left in flight), `calculate_test_score()` is called synchronously here because the worker will never fire it (`student.py:951-954`).
   - `needs_review_gate` is true when `ai_grading_mode == "manual"`, or when `ai_grading_mode == "auto"` **and** this is the final attempt **and** `require_teacher_approval` is set (`student.py:883-889`). If gated, reused feedback rows are marked `released=False` / `requires_teacher_review=True` right here too (`student.py:903-905`).

### Background worker (`Backend/app/services/feedback_worker.py`)

- Persistent DB-backed queue (`feedback_jobs` table) — survives restarts (module docstring, lines 1-7).
- Single-leader election via a `worker_lock` singleton row (`_try_claim_leadership`, lines 175-202) so only one Cloud Run replica runs the worker; heartbeat every 30s (`HEARTBEAT_INTERVAL`), stale-leader takeover after 90s (`LEADER_TAKEOVER_SECONDS`), and a replica that loses the initial election keeps retrying every 30s forever rather than giving up (`_leadership_election_loop`, lines 243-267).
- `ThreadPoolExecutor(max_workers=10)` — 10 concurrent OpenAI calls per leader instance (line 44).
- Jobs claimed with `FOR UPDATE SKIP LOCKED`, ordered by `(priority, created_at)` (`_claim_next_jobs`, lines 391-430) — so `priority=1` (submit-time) jumps ahead of `priority=3` (speculative) automatically.
- Jobs stuck in `processing` for >120s (`STALE_LOCK_SECONDS`) are unlocked and requeued (`_unlock_stale_jobs`, lines 460-485); on startup, anything left in `processing`/`retry` is reset to `queued` (`recover_stale_jobs`, lines 143-172 — this is what `main.py` calls per `CLAUDE.md`).
- `_generate_feedback_for_job` (lines 488-757):
  - Resets a stale/failed/fallback `AIFeedback` row before regenerating so a prior bad result doesn't short-circuit (lines 502-521).
  - Detects **fallback results with a real error** (OpenAI failure, JSON parse error, etc.) and retries up to `max_retries` (default 5, `Backend/app/models/feedback_job.py:36`) with exponential backoff (`time.sleep(min(2 ** retry_count, 10))`, line 584); once exhausted, accepts the fallback as final rather than looping forever (lines 564-573).
  - After a successful/accepted result, stamps `AIFeedback.content_hash` from the **content actually graded**, not the job's `content_hash` captured at enqueue time — explicitly to avoid a race where a second edit during processing would stamp the wrong hash (comment, lines 597-604).
  - Applies the **release gate**: re-reads `module.ai_grading_mode` and `require_teacher_approval` fresh at completion time (not from the job) and sets `released=False` / `requires_teacher_review=True` accordingly (lines 610-641).
  - Calls `calculate_test_score()` after every job completes (line 644), which is a no-op until all jobs for that `(student, module, attempt)` are done (lines 683-695).

### `calculate_test_score()` (lines 676-757)

- Single JOIN query (`Question` + `StudentAnswer` + outer-joined `AIFeedback`) to avoid N+1 (comment, line 701).
- `percentage_score = total_points_earned / total_points_possible * 100`, written onto the `TestSubmission` row (lines 740-744). **This value is never read by any API route or schema — see §4.**

### Batch-level override (mostly disconnected)

`ModuleBatch.ai_grading_mode` (`Backend/app/models/module_batch.py:38`) lets a specific batch/phase override the module's grading mode, validated against `{"auto","manual"}` (`Backend/app/api/routes/batch.py:23,39-40,70-71`) and exposed via `GET .../batches/{batch_id}/effective-config` (`batch.py:154-190`, line 181: `batch.ai_grading_mode or module.ai_grading_mode or "auto"`).

**However**, neither `submit_test()` (`student.py:858`: `getattr(module, "ai_grading_mode", "auto")`) nor `_generate_feedback_for_job()` (`feedback_worker.py:617`: `getattr(module_obj, "ai_grading_mode", "auto")`) ever look up the batch's override — both read only the module-level value. The migration docstring itself flags this: *"the (unused-in-gating) module_batches override"* (`41958e8223a0...py:17`). So a batch can report a different `ai_grading_mode` via `effective-config` than what actually gates its feedback.

---

## 2. Rubric system

### Templates (`Backend/app/config/feedback_templates.py`)

Six named templates, each a full `config` dict: `default` (line 7), `stem_course` (85), `humanities` (163), `language_learning` (241), `professional_skills` (319), `strict_grading` (397). Each config has five sections:
- `grading_criteria` — named criteria with `weight` + `description` (e.g. `default`: accuracy 40, completeness 30, clarity 20, depth 10 — lines 12-16).
- `feedback_style` — `tone`, `detail_level`, `include_examples`, `reference_course_material` (lines 18-23).
- `rag_settings` — `enabled`, `max_context_chunks`, `similarity_threshold`, `include_source_references`, `include_document_locations` (lines 25-31).
- `question_type_settings` — per-type (`mcq`, `short`, `long`, etc.) `strictness`, `default_points`, and type-specific flags (lines 33+).
- `grading_thresholds` — present in every template (e.g. line 78) but **never read** by `prompt_builder.py` or `ai_feedback.py` (grep confirms zero references outside `feedback_templates.py`). Dead field.

### Resolution (`Backend/app/services/rubric.py`)

- `get_module_rubric()` (lines 14-43) reads `Module.feedback_rubric` (dedicated JSONB column), falling back to the legacy `assignment_config.feedback_rubric` location for backward compat, then to the `"default"` template if nothing is configured.
- `merge_with_defaults()` (lines 46-130) deep-merges a custom rubric over the `default` template so partial customizations still have every field populated. Applies to `grading_criteria`, `feedback_style`, `rag_settings`, `question_type_settings` (per sub-key: mcq/short/long/mcq_multiple/fill_blank/multi_part), `grading_thresholds`, plus top-level `enabled`/`custom_instructions`.
- `apply_template_to_module()` (lines 181-242) — what the frontend "Rubric Quick Selector" calls (`POST /modules/{module_id}/rubric/apply-template`, `Backend/app/api/routes/module.py:276`). Optionally preserves existing `custom_instructions` across a template switch (lines 208-223).
- `validate_rubric()` (lines 245-327) enforces weights sum to 99-101 (rounding tolerance), valid `tone` (`encouraging|neutral|strict`), valid `detail_level` (`brief|moderate|detailed`), `similarity_threshold` in [0,1], `max_context_chunks` in [1,10], `passing_score` in [0,100].

### Actual influence on the AI prompt (`Backend/app/services/ai_feedback.py` + `prompt_builder.py`)

- `AIFeedbackService.generate_instant_feedback()` calls `get_module_rubric(db, module_id)` (`ai_feedback.py:183`), then `_get_ai_model_from_rubric()` (line 186, currently just reads a fixed default — comment at line 403: *"In future, could support model selection per rubric"*).
- `grading_criteria` and `feedback_style` (`tone`, `detail_level`, `include_examples`) are threaded into both `build_mcq_feedback_prompt()` and `build_text_feedback_prompt()` (`prompt_builder.py:35-42, 91-126, 222-232, 279-323`) — genuinely shapes prompt text, not decorative.
- `question_type_settings` per question type is pulled and used for grading strictness settings (e.g. `mcq_multiple` at `ai_feedback.py:1141-1142`).
- `grading_thresholds` — confirmed unused (see above).

### RAG — real, not a stub

- `should_include_context(rubric, question_type)` gate (`prompt_builder.py:479`) decides whether to attempt retrieval at all.
- `get_context_for_feedback()` (`Backend/app/services/rag_retriever.py:51+`) does real vector search via `app.services.embedding.search_similar_chunks()` over `Document` chunks, filtered by `rubric.rag_settings.max_context_chunks` / `similarity_threshold`.
- In-memory cache keyed by `(module_id, question_text)` hash, 30-minute TTL, capped at 500 entries with oldest-eviction (`rag_retriever.py:18-46`) — because course material doesn't change between students answering the same question.
- On retrieval failure, logs and falls back to `rag_context = None` rather than failing the whole feedback generation (`ai_feedback.py:220-224`).
- Retrieved context is injected into the MCQ/short/long/fill-blank/mcq_multiple prompts and the model is instructed to cite an exact document + page when context is present (e.g. `ai_feedback.py:1028`).

---

## 3. Feedback job lifecycle (state machine)

```
queued --(claimed, FOR UPDATE SKIP LOCKED)--> processing --(success/accepted fallback)--> done
                                                    |--(fallback w/ real error, retries left)--> queued (re-queued)
                                                    |--(unhandled exception)--> queued (retry_count++) or failed (retries exhausted)
processing --(locked_at older than 120s)--> queued   [worker died mid-job]
processing / retry --(server restart)--> queued      [recover_stale_jobs() at startup]
```

- `max_retries` default 5 (`Backend/app/models/feedback_job.py:36`); each retry backs off `min(2**retry_count, 10)` seconds (`feedback_worker.py:584`).
- On final failure (`_process_single_job` catch block, `feedback_worker.py:646-673`) the job is marked `failed` and `mark_feedback_failed()` (`Backend/app/crud/ai_feedback.py`) writes an error onto the `AIFeedback` row so the UI can show something rather than hang.
- `is_final_attempt` flag (set at submit-time, `student.py:856,948`) drives the `require_teacher_approval` safety-net gate described in §1.
- **Batch grading** (`Backend/app/api/routes/batch.py`): batches are organizational containers (phase/type: practice/quiz/exam/review, statuses draft/active/locked) with per-batch overrides for `ai_grading_mode` (unused-in-gating, see §1), `max_attempts`, `show_feedback_after_each`, and an `unlock_after_batch_id` prerequisite chain (`get_student_batches`, lines 195-240). Batches don't have their own separate grading pipeline — questions assigned to a batch still go through the same `FeedbackJob` queue per-answer.

---

## 4. Dashboard / reporting surfaces

### Teacher-facing

| Page | Data shown | Source | Computed where |
|---|---|---|---|
| `Frontend/app/dashboard/analytics/page.js` | "Overall Performance", "Completion Rate", "Active Students", "Avg Time", 2 chart placeholders, "Recent Activity", "AI-Generated Insights" | **None** — zero `apiClient` calls in the whole 222-line file | 100% hardcoded placeholder text (`"-"`, `"0"`, "No data yet", "No trend data available") — see lines 74-96 for the metric cards. This page is a **static shell**, not wired to any backend data. |
| `Frontend/app/dashboard/tests/page.js` | List of "tests" | `const [tests, setTests] = useState([])` with comment `// Will be fetched from API` (line 20) but **no `useEffect` ever calls an API** | Never populated — permanently empty state. |
| `Frontend/app/dashboard/students/page.js` | Per-student `avg_score`, `progress`, `correct_answers`, `attempt_count`, `grade_status`, `score_trend`; class-wide average at top | `GET /api/student-answers/?module_id=` + `GET /api/student/modules/{id}/feedback` (lines 110-111) — **raw answer + feedback rows for the whole module** | **Entirely client-side** (lines 150-236): `avg_score = round(correctAnswers / answeredQuestions * 100)` where "correct" is a **binary** MCQ-exact-match or feedback-score-vs-60%-threshold check (`isAnswerCorrectForScoring`, lines 150-169) — see §5 for why this diverges from the backend's own score. |
| `Frontend/app/dashboard/students/[studentId]/page.js` | Single student's per-question answers/feedback, survey responses | `GET /api/student-answers?module_id=` + `GET /api/student/modules/{id}/feedback?student_id=` + module survey endpoints (lines 104-118) | Client-side aggregation, same raw-data pattern as the list page. |
| `Frontend/app/dashboard/grading/page.js` (1637 lines) | Teacher review/grading UI: pending submissions, per-answer teacher override, bulk release | `GET /api/modules`, `GET /api/student-answers`, `GET /api/student/modules/{id}/questions`, `GET .../teacher-grades/module/{id}/student/{id}`, `GET .../final-submissions`; writes via `POST .../teacher-grade`, `POST .../review/release`, `POST .../review/release-bulk` (lines 245-780) | Mix — reads raw data client-side, but the actual grade-override/release actions are real backend writes (this is the one dashboard page with genuine write-side plumbing). |
| `Frontend/app/dashboard/rubric/page.js` | Rubric editor | `rubric.py` service endpoints (`get/update/apply-template`) | Backend-driven, matches §2 exactly. |

### Student-facing

- `Frontend/app/student/test/[moduleId]/page.js` — per-question `fb.score` display (line 830) is per-answer, not an aggregate.
- `Frontend/app/student/module/[moduleId]/page.js` — computes an aggregate **client-side** too: `totalPoints = questions.reduce(...)`, `earnedPoints = teacherGradedQuestions.reduce((sum,f) => sum + f.teacher_grade.points_awarded, 0)` (lines 2875-2876) — same pattern as the teacher dashboard, reconstructing a score from raw per-question data in the browser rather than reading a precomputed value.

### The disconnect

`Backend/app/services/feedback_worker.py:calculate_test_score()` computes and persists a weighted, points-based score (`total_points_earned / total_points_possible * 100`) onto `TestSubmission.percentage_score` — this respects each question's point value and any partial credit awarded. **No API route or Pydantic schema anywhere in `Backend/app/api/routes/` or `Backend/app/schemas/` reads or returns `TestSubmission.percentage_score` / `total_points_earned` / `total_points_possible`** (confirmed via repo-wide grep — zero matches outside the model/CRUD/worker files, and there is no `Backend/app/schemas/test_submission.py` at all). Every score shown to a teacher or student in the frontend is a **separate, independently-computed, client-side reconstruction** from raw `student_answers` + `ai_feedback` rows:
- Teacher students-list: binary correct/incorrect ratio (§4 table above), not points-weighted.
- Student module page: points-weighted, but only counts `teacher_grade.points_awarded` (misses ungraded/AI-only scores in that particular reduce).

These are two different formulas, computed in two different places, and neither one is the value the backend already computed and stored for exactly this purpose.

---

## 5. Known rough edges visible in the code (factual list, no fixes proposed)

- `TestSubmission.percentage_score` / `total_points_earned` / `total_points_possible` are computed and stored (`feedback_worker.py:740-744`) but never exposed via any API — dead data (§4).
- `grading_thresholds` rubric field is defined in all 6 templates and validated by `validate_rubric()` but never consumed by prompt building or grading logic (§2).
- `ModuleBatch.ai_grading_mode` override is validated, stored, and exposed via `effective-config`, but not actually consulted by the grading-gate logic in `submit_test()` or `_generate_feedback_for_job()` — self-documented as "unused-in-gating" in the migration file (§1).
- `_get_ai_model_from_rubric()` (`ai_feedback.py:400-404`) is a stub — comment says model-per-rubric selection is a future feature; currently always returns the same default.
- `Frontend/components/AssignmentFeaturesSelector.jsx` — AI Chatbot "Mode" and "AI Model" selectors are rendered `disabled` with a "Soon" badge (lines ~336-354 pre-recent-edits; confirmed still present) — chatbot conversation_mode/ai_model config fields exist in the data model (`Backend/app/models/module.py:62-66`) but aren't yet user-configurable from this UI.
- `Frontend/app/dashboard/analytics/page.js` is a fully static placeholder (§4) — no data wiring at all, despite being reachable from the main nav.
- `Frontend/app/dashboard/tests/page.js` has a `tests` state that's initialized empty with a "will be fetched" comment but no fetch call exists.
- `Backend/plan.md`'s description of speculative background grading as an unbuilt idea is stale — it's fully implemented (`student.py:710-771`, `feedback_worker.py` priority handling). Worth reconciling that note.
- Two independent client-side scoring formulas exist across teacher and student pages (§4) — binary-correct-ratio on the teacher students-list vs. teacher-grade-points-only on the student module page — neither matches the backend's own weighted `percentage_score`.
- `Backend/app/models/module.py` defines **two** separate default-config dicts covering overlapping ground: `DEFAULT_AI_CONFIG`/`DEFAULT_ASSIGNMENT_CONFIG` (lines 8-73) and a second `DEFAULT_MODULE_SETTINGS["ai"]` block (lines 78-100+) with a comment noting it "mirrors flat column ai_grading_mode — keep in sync" (line 82) — two sources of truth for the same defaults, manually kept in sync by comment convention only.
- `dashboard/students/page.js`'s `isAnswerCorrectForScoring()` (lines 150-169) hardcodes a `passingThreshold = moduleData?.assignment_config?.passing_score || 60` fallback of 60% — this key doesn't appear in `DEFAULT_ASSIGNMENT_CONFIG` (§ module.py:49-73), i.e. it's reading a config path that's never actually set anywhere by the backend defaults.

---

## Open Questions

- Is `TestSubmission.percentage_score` intended to become the single source of truth for reporting, or is per-question client-side aggregation intentional (e.g. because it needs to reflect *live* teacher overrides that haven't triggered a recompute)?
- Should the `ModuleBatch.ai_grading_mode` override actually gate grading, or is batch-level mode meant to be informational/UI-only for now?
- Is the discrepancy between "binary correct ratio" (teacher students-list) and "points-weighted" (student module page) scoring intentional, or did they just drift apart?
- What's the intended state of `dashboard/analytics/page.js` and `dashboard/tests/page.js` — in-progress features, deprecated, or placeholders waiting on the reporting rework this conversation is about?
- Is `grading_thresholds` (rubric field) meant to gate something (e.g. auto-fail below a threshold, or trigger `require_teacher_approval` dynamically) that just hasn't been wired up yet?
- For the `AI Chatbot` mode/model "Soon" fields — is a near-term target for that already decided, relevant to scoping the grading rework?
