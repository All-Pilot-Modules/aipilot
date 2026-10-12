# Student learning memory

Learning memory is an AI journal scoped to a student ID and module. It is not a final grade, diagnosis, or fixed learning-style classification. Copy/email workflows are not included.

## Running

Apply `alembic upgrade head` with the same database environment as the backend, then restart the backend normally. The `learning-memory` background thread starts with the app (except in tests). No extra server is required. The additive migration `a71b2c3d4e5f` creates a backend-only table with RLS enabled and browser-role access revoked.

The worker scans submitted assignments, including existing submissions, and generates one entry per submission/attempt once all expected answers have completed, non-fallback, released feedback. Entries retain the submission ID and source answer IDs. A later attempt adds a dated entry rather than erasing earlier learning history. Completed entries are snapshots; subsequent edits to source grades do not automatically rewrite them.

Generation occurs outside feedback requests and outside open database transactions. Unique submission IDs prevent duplicate entries; submission locks and expiring lease tokens coordinate processes. Unfinished claims become eligible after ten minutes. Provider/validation failures retry after five minutes, up to three times. Incomplete feedback is checked again after two minutes. The worker logs exception types without logging student answers. Each completed assignment can incur an additional model call, plus retries.

## Use

Teachers open Dashboard → Students → a student → Learning memory. Ownership is enforced by authenticated user ID, not a query parameter. The page shows an interactive evidence graph, with a collapsible journal of dated observations and evidence IDs. Up to 100 entries are displayed.

Tutor chat receives the most recent eight completed entries from only that student's module. Entries are treated as untrusted observations, never instructions. Missing memory does not prevent chat. Reports are not emailed or subject to a teacher-approval workflow.

## Verification

`venv/bin/python -m pytest tests/unit/test_learning_memory.py -q`

Tests use synthetic evidence and mocked model responses. Production/student-data AI smoke tests require explicit authorization. Backend restart is required to load new routes and the background worker; frontend refresh alone cannot start it.

## Learning memory graph

New observations may include up to twelve named concepts, each with a specific observation, a signal (`demonstrated`, `difficulty`, `mixed`, or `uncertain`), and supporting answer IDs. The worker validates that every cited answer belongs to the current assignment evidence. Concept names are reused across comparable attempts; exact names are merged case-insensitively in the graph. Semantically similar names with different wording are intentionally not automatically merged.

The teacher map connects attempts to concepts, supports search, zoom, directional pan, keyboard node selection and a text list alternative. Selecting a node shows dated evidence and links to the attempt. Colors describe the latest recorded observation, not mastery or a diagnosis. No prerequisite relationships are inferred. The map displays the latest twenty attempts for readability; the existing journal retains up to one hundred entries.

Existing JSON journals remain compatible and appear as attempt-linked observations with assignment-level evidence. They are not automatically regenerated or relabeled as concept-level evidence. New structured observations use the existing JSON column, so this update needs no database migration. Restart the backend to load the updated worker prompt. Tutor context includes the same structured observations. Memory remains scoped to the current student and module, not a cross-module profile.
