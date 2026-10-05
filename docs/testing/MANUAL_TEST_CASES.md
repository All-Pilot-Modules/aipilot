# Manual platform test cases

Run against an isolated test deployment. Use two teachers (T1/T2), two students
(S1/S2), two modules (M1/M2), and synthetic documents. T1 owns M1, T2 owns M2.
Record build/commit, browser, case ID, actual result, pass/fail, and evidence.
A case below is an expectation, not a claim the current application passes it.

## Authentication and access

| ID | Steps | Expected |
|---|---|---|
| AUTH-01 | Register T1, verify email, log in, log out | Verification required; authenticated views work; logout removes session |
| AUTH-02 | Log in with wrong password and unknown user | Clear error; no session; no disclosure of password or token |
| AUTH-03 | Expire access token while teacher Students page is open | Refresh succeeds; feedback loads; no forced logout |
| AUTH-04 | Expire refresh token too | Login required; no retry loop |
| AUTH-05 | Open T2's module/feedback/export as T1 | Access denied; no other teacher's data returned |
| AUTH-06 | Join M1 as S1, alter student_id in requests to S2 | No S2 data read or changed |
| AUTH-07 | Use M1 student session to access M2, including conversation IDs | Access denied on every route |
| AUTH-08 | Use shared access code to claim an existing student's ID | Identity proof required; cannot impersonate existing student (known gap) |
| AUTH-09 | Access teacher release/update endpoints without teacher token | Access denied; no mutation |
| AUTH-10 | Open two modules in separate tabs | Each tab retains correct module/identity; no cross-module disclosure |

## Documents, extraction and processing

| ID | Steps | Expected |
|---|---|---|
| DOC-01 | Upload readable PDF, DOCX, PPTX, TXT | Correct text/page/slide metadata and terminal processing status |
| DOC-02 | Upload multipage document with headers, tables and columns | Reading order and useful content preserved; no silent missing sections |
| DOC-03 | Upload scanned PDF | OCR/parser fallback or explicit actionable failure; no fake success |
| DOC-04 | Upload equations, fractions, matrices and Greek symbols | Usable formulas; no NUL bytes or replacement-character corruption |
| DOC-05 | Upload blank, corrupt and unsupported files | Clear validation/failure; no stuck processing state |
| DOC-06 | Upload identical file twice to same module | Defined duplicate behavior; no duplicate chunks/embeddings |
| DOC-07 | Upload same file to different owned module | Correct ownership and independent module association |
| DOC-08 | Simulate storage, parser, and embedding failure independently | Stage/error visible; safe retry; temporary files cleaned |
| DOC-09 | Restart backend during processing | Recovery or retry possible; no permanently stuck status |
| DOC-10 | Upload a large file while other students submit | UI responsive; bounded resources; no unrelated request starvation |

## Questions and embeddings

| ID | Steps | Expected |
|---|---|---|
| QUE-01 | Import testbank with numbered questions, multiline options and answer keys | Correct counts, options, answers, ordering and module |
| QUE-02 | Generate MCQ/short/long questions from processed document | Requested content generated as drafts/unreviewed |
| QUE-03 | Create/edit/delete all six types | Validation and persistence correct; no dangling visible question |
| QUE-04 | Approve question, deactivate another | Only approved active questions available to students |
| QUE-05 | Inspect student question JSON for every type | No top-level or nested answer keys |
| QUE-06 | Edit mathematical question and preview it | Prose stays prose; formulas render; saved value survives reopening |
| EMB-01 | Process document, compare chunk/embedding counts | Every intended chunk has correct-dimension embedding |
| EMB-02 | Query M1 while M2 has similar material | Only eligible M1 course material used; testbank excluded |
| EMB-03 | Ask same question with different student answers | Cache does not serve answer-dependent context from another answer |
| EMB-04 | Replace/delete course document and repeat query | Old context invalidated; sources correspond to current documents |
| EMB-05 | Compare Python retrieval to future pgvector search | Relevant top results, source metadata and acceptable measured latency |

## Student answers and submission

| ID | Steps | Expected |
|---|---|---|
| SUB-01 | Answer MCQ, multiple MCQ, short, long, fill blank, multi-part | Correct payload, autosave and restored answer for each type |
| SUB-02 | Type prose, LaTeX and mixed math; blur, refresh, return | No unwanted math wrapping or lost content |
| SUB-03 | Clear an answer after saving | Cleared state persists; stale answer not submitted |
| SUB-04 | Disconnect network, edit, reconnect | Save failure visible; retry succeeds without duplicate records |
| SUB-05 | Double-click submit and retry after delayed response | One logical submission and one active job per answer |
| SUB-06 | Edit while speculative grading is running, then submit | Final answer version graded; stale result never reused |
| SUB-07 | Submit first, retry, final and out-of-range attempts | Attempt policy enforced server-side |
| SUB-08 | Submit no answers or inactive question | Clear rejection; no orphan submission/job |

## Grading, workers and feedback

| ID | Steps | Expected |
|---|---|---|
| FB-01 | Correct and incorrect MCQs | Deterministic score; specific real AI explanation |
| FB-02 | Equivalent math answers, e.g. 1/2 and 0.5 | Appropriate equivalence accounting for units, domain and requested form |
| FB-03 | Partial fill-blank/multiple-choice/multi-part response | Correct partial credit and bounded totals |
| FB-04 | Configure rubric and feedback style | Score breakdown and feedback follow saved settings |
| FB-05 | Simulate 429, timeout, malformed JSON and auth failure | Explicit state; bounded retries/backoff; no fallback labeled successful AI |
| FB-06 | Restart worker; stop leader; simulate stalled loop | Pending jobs recover; no overlapping workers or duplicate completion |
| FB-07 | Let a job exceed lease duration and finish late | Old worker cannot overwrite newer feedback |
| FB-08 | Exhaust retries then manually regenerate | Failure visible; retry allowed according to policy; genuine result replaces fallback |
| FB-09 | Generate under manual-review mode | Student sees no unreleased feedback or score |
| FB-10 | Teacher releases individual and bulk feedback | Only authorized module/student records released |
| FB-11 | Disable score display | Numeric score and correctness hidden in API and UI as configured |
| FB-12 | Drop SSE connection during grading | Polling fallback completes; no request storm or permanent spinner |
| FB-13 | Update question/rubric after cached feedback | Cache cannot return obsolete explanation or score |

## Chat, survey, reporting and UX

| ID | Steps | Expected |
|---|---|---|
| AUX-01 | Create conversation, ask follow-up, reload, delete | Correct message history and deletion; tutor failure visible |
| AUX-02 | Read/delete another student's conversation by ID | Denied without revealing content |
| AUX-03 | Submit survey with missing required response | Validation; no invalid response saved |
| AUX-04 | Submit/edit survey and view teacher report | Correct student/module association and aggregation |
| AUX-05 | Export results containing formulas, commas, quotes and newlines | Accurate rows, escaping, Unicode and access control |
| UX-01 | Complete main flows with keyboard only | Reachable controls, labels, focus management and visible errors |
| UX-02 | Repeat on mobile viewport and dark mode | No clipped formulas, unusable dialogs or inaccessible buttons |
| UX-03 | Refresh/deep-link/back navigation during workflow | Correct session and attempt restored; no accidental duplicate submit |

## Release record

For each failing case, record a reproducible issue with synthetic input and
expected/actual result. Do not attach tokens, real student records or credentials.
Unresolved authentication, answer-key leakage, wrong-score or lost-submission
failures block release. Automated expected failures remain unresolved failures
for this acceptance decision.
