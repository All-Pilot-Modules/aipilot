-- ============================================================
-- Migration 005: Database design improvements
-- Run order: top to bottom, once against your Supabase/PostgreSQL DB
-- ============================================================

-- ============================================================
-- FIX 1: pgvector — migrate embedding_vector ARRAY → vector(1536)
-- ============================================================

-- 1a. Enable pgvector extension (idempotent)
CREATE EXTENSION IF NOT EXISTS vector;

-- 1b. Change column type from float[] to vector(1536)
--     pgvector registers an implicit cast from real[]/float[] so this works directly.
ALTER TABLE document_embeddings
    ALTER COLUMN embedding_vector TYPE vector(1536)
    USING embedding_vector::vector(1536);

-- 1c. Add HNSW index for fast approximate nearest-neighbour cosine search
--     (drop first if re-running)
DROP INDEX IF EXISTS ix_document_embeddings_vector_hnsw;
CREATE INDEX ix_document_embeddings_vector_hnsw
    ON document_embeddings
    USING hnsw (embedding_vector vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- 1d. Add index on document_id for fast per-document lookups (denorm column)
CREATE INDEX IF NOT EXISTS ix_document_embeddings_document_id
    ON document_embeddings (document_id);

-- ============================================================
-- FIX 2: modules — per-teacher unique name (not global unique)
-- ============================================================

-- 2a. Drop the old global unique constraint
ALTER TABLE modules DROP CONSTRAINT IF EXISTS modules_name_key;

-- 2b. Add per-teacher unique constraint
ALTER TABLE modules
    ADD CONSTRAINT uix_module_teacher_name UNIQUE (teacher_id, name);

-- ============================================================
-- FIX 3 & 4: student_enrollments — add missing indexes
-- ============================================================

-- Fast "get all students in a module" query
CREATE INDEX IF NOT EXISTS ix_student_enrollments_module_id
    ON student_enrollments (module_id);

-- Fast "get all modules for a student" query
CREATE INDEX IF NOT EXISTS ix_student_enrollments_student_id
    ON student_enrollments (student_id);

-- ============================================================
-- FIX 5: ai_feedback — link to feedback_jobs
-- ============================================================

ALTER TABLE ai_feedback
    ADD COLUMN IF NOT EXISTS job_id UUID
        REFERENCES feedback_jobs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_ai_feedback_job_id
    ON ai_feedback (job_id);

-- ============================================================
-- FIX 6: feedback_jobs — previous_feedback_json Text → JSONB
-- ============================================================

-- Cast existing text data to JSONB (NULL values pass through cleanly)
ALTER TABLE feedback_jobs
    ALTER COLUMN previous_feedback_json TYPE JSONB
    USING CASE
        WHEN previous_feedback_json IS NULL THEN NULL
        ELSE previous_feedback_json::JSONB
    END;
