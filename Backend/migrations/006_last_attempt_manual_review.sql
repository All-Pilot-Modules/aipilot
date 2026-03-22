-- Migration 006: Last Attempt Manual Review
-- AI generates feedback for final attempts silently as a draft.
-- Teacher reviews, edits, approves, and releases before the student can see it.
-- ============================================================================

-- 1. Add review/release tracking to ai_feedback
ALTER TABLE ai_feedback
  ADD COLUMN IF NOT EXISTS released                 BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS requires_teacher_review  BOOLEAN NOT NULL DEFAULT FALSE;

-- Partial index: fast lookup of unreleased drafts (only indexes the small minority)
CREATE INDEX IF NOT EXISTS ix_ai_feedback_unreleased
  ON ai_feedback (requires_teacher_review, released)
  WHERE NOT released;

-- 2. Mark which feedback_jobs are for the final attempt
ALTER TABLE feedback_jobs
  ADD COLUMN IF NOT EXISTS is_final_attempt BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS ix_feedback_jobs_is_final_attempt
  ON feedback_jobs (is_final_attempt)
  WHERE is_final_attempt;
