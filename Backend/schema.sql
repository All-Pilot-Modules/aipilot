-- =============================================================================
-- AIPilot — Complete Database Schema (fresh install)
-- Run on an empty database. Drop & recreate if starting over.
-- =============================================================================

-- Required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "vector";     -- pgvector for embeddings


-- =============================================================================
-- USERS
-- Stores teachers, students, and admins in one table.
-- role is enforced by a CHECK constraint at the DB level.
-- =============================================================================
CREATE TABLE users (
    id                          VARCHAR     PRIMARY KEY,  -- Banner ID / auth provider ID
    username                    VARCHAR     UNIQUE,
    email                       VARCHAR     UNIQUE,
    hashed_password             VARCHAR     NOT NULL,
    profile_image               VARCHAR,
    role                        VARCHAR     NOT NULL
                                            CHECK (role IN ('student', 'teacher', 'admin')),

    -- Email verification
    is_email_verified           BOOLEAN     NOT NULL DEFAULT FALSE,
    verification_code           VARCHAR,
    verification_code_expires   TIMESTAMPTZ,
    verification_token          VARCHAR,
    verification_token_expires  TIMESTAMPTZ,

    -- Password reset
    reset_code                  VARCHAR,
    reset_code_expires          TIMESTAMPTZ,
    reset_token                 VARCHAR,
    reset_token_expires         TIMESTAMPTZ,

    is_active                   BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_users_email    ON users(email);
CREATE INDEX ix_users_username ON users(username);
CREATE INDEX ix_users_role     ON users(role);


-- =============================================================================
-- MODULES
-- A course/class created by a teacher.
-- survey_questions (the template) lives here as JSONB.
-- Student survey *responses* live in survey_responses (separate table).
-- =============================================================================
CREATE TABLE modules (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id           VARCHAR     NOT NULL REFERENCES users(id),

    name                 VARCHAR     NOT NULL,
    description          VARCHAR,
    access_code          VARCHAR     NOT NULL UNIQUE,
    is_active            BOOLEAN     NOT NULL DEFAULT TRUE,
    due_date             TIMESTAMPTZ,
    visibility           VARCHAR     NOT NULL DEFAULT 'class-only',  -- 'class-only' | 'public'
    slug                 VARCHAR     UNIQUE,
    instructions         VARCHAR,

    -- Consent form (customisable per module)
    consent_form_text    TEXT,
    consent_required     BOOLEAN     NOT NULL DEFAULT TRUE,

    -- Survey question *template* (teacher edits these; answers go in survey_responses)
    survey_questions     JSONB,
    survey_required      BOOLEAN     NOT NULL DEFAULT FALSE,

    -- Chatbot behaviour
    chatbot_instructions TEXT,

    -- Feedback rubric config
    feedback_rubric      JSONB,

    -- Attempts, mastery learning, display toggles
    assignment_config    JSONB       NOT NULL DEFAULT '{}',

    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uix_module_teacher_name UNIQUE (teacher_id, name)
);

CREATE INDEX ix_modules_teacher_id ON modules(teacher_id);


-- =============================================================================
-- DOCUMENTS
-- Files uploaded by teachers, attached to a module.
-- =============================================================================
CREATE TABLE documents (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    title               VARCHAR     NOT NULL,
    file_name           VARCHAR     NOT NULL,
    file_hash           VARCHAR     NOT NULL,   -- SHA-256, used for dedup
    file_type           VARCHAR     NOT NULL,   -- pdf | pptx | docx | …

    teacher_id          VARCHAR     NOT NULL REFERENCES users(id),
    module_id           UUID        NOT NULL REFERENCES modules(id) ON DELETE CASCADE,

    storage_path        VARCHAR     NOT NULL,
    index_path          VARCHAR,
    slide_count         INTEGER,

    -- RAG processing lifecycle
    -- uploaded | extracting | extracted | chunking | chunked
    -- | embedding | embedded | indexed | failed | parsing | parsed
    processing_status   VARCHAR     NOT NULL DEFAULT 'uploaded',
    processing_metadata JSONB       NOT NULL DEFAULT '{}',

    -- Legacy testbank fields
    parse_status        VARCHAR,    -- 'pending' | 'success' | 'failed'
    parse_error         VARCHAR,
    is_testbank         BOOLEAN     NOT NULL DEFAULT FALSE,

    uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uix_teacher_filehash UNIQUE (teacher_id, file_hash, module_id)
);

CREATE INDEX ix_documents_teacher_id        ON documents(teacher_id);
CREATE INDEX ix_documents_module_id         ON documents(module_id);
CREATE INDEX ix_documents_processing_status ON documents(processing_status);


-- =============================================================================
-- DOCUMENT CHUNKS  (RAG — text split from documents)
-- =============================================================================
CREATE TABLE document_chunks (
    id             UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id    UUID     NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    module_id      UUID     NOT NULL REFERENCES modules(id)   ON DELETE CASCADE,

    chunk_index    INTEGER  NOT NULL,
    chunk_text     TEXT     NOT NULL,
    chunk_size     INTEGER  NOT NULL,
    chunk_metadata JSONB    NOT NULL DEFAULT '{}',

    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uix_document_chunk_index UNIQUE (document_id, chunk_index)
);

CREATE INDEX idx_chunks_document_id ON document_chunks(document_id);
CREATE INDEX idx_chunks_module_id   ON document_chunks(module_id);


-- =============================================================================
-- DOCUMENT EMBEDDINGS  (pgvector — 1536-dim OpenAI ada-002)
-- =============================================================================
CREATE TABLE document_embeddings (
    id                   UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
    chunk_id             UUID      NOT NULL REFERENCES document_chunks(id)  ON DELETE CASCADE,
    document_id          UUID      NOT NULL REFERENCES documents(id)        ON DELETE CASCADE,
    module_id            UUID      NOT NULL REFERENCES modules(id)          ON DELETE CASCADE,

    embedding_vector     vector(1536) NOT NULL,
    embedding_model      VARCHAR   NOT NULL DEFAULT 'text-embedding-ada-002',
    embedding_dimensions INTEGER   NOT NULL DEFAULT 1536,
    token_count          INTEGER,

    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- HNSW index: fast approximate cosine-similarity search
CREATE INDEX ix_document_embeddings_vector_hnsw ON document_embeddings
    USING hnsw (embedding_vector vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX ix_document_embeddings_document_id ON document_embeddings(document_id);
CREATE INDEX ix_document_embeddings_chunk_id    ON document_embeddings(chunk_id);
CREATE INDEX ix_document_embeddings_module_id   ON document_embeddings(module_id);


-- =============================================================================
-- QUESTIONS
-- =============================================================================
CREATE TABLE questions (
    id                UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id         UUID     NOT NULL REFERENCES modules(id)   ON DELETE CASCADE,
    document_id       UUID              REFERENCES documents(id) ON DELETE CASCADE,

    -- mcq | short | long | mcq_multiple | fill_blank | multi_part
    type              VARCHAR  NOT NULL,
    text              TEXT     NOT NULL,
    slide_number      INTEGER,
    question_order    INTEGER,

    options           JSONB,           -- MCQ: {"A": "Apple", "B": "Ball"}
    correct_answer    VARCHAR,         -- legacy
    correct_option_id VARCHAR,         -- "A" | "B" | "C" | "D"
    extended_config   JSONB,           -- multi-answer / fill-blank / multi-part config

    learning_outcome  VARCHAR,
    bloom_taxonomy    VARCHAR,
    image_url         VARCHAR,
    has_text_input    BOOLEAN  NOT NULL DEFAULT FALSE,
    points            FLOAT    NOT NULL DEFAULT 1.0,
    allow_critique    BOOLEAN  NOT NULL DEFAULT FALSE,

    -- unreviewed | active | archived
    status            VARCHAR  NOT NULL DEFAULT 'active',
    is_ai_generated   BOOLEAN  NOT NULL DEFAULT FALSE,
    generated_at      TIMESTAMPTZ
);

CREATE INDEX ix_questions_module_id     ON questions(module_id);
CREATE INDEX ix_questions_document_id   ON questions(document_id);
CREATE INDEX ix_questions_status        ON questions(status);
CREATE INDEX ix_questions_module_status ON questions(module_id, status);


-- =============================================================================
-- STUDENT ENROLLMENTS
-- Tracks which student joined which module via access code.
-- This is the anchor table — test_submissions and answers reference it.
-- =============================================================================
CREATE TABLE student_enrollments (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id           VARCHAR     NOT NULL,   -- Banner ID
    module_id            UUID        NOT NULL REFERENCES modules(id) ON DELETE CASCADE,

    enrolled_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    access_code_used     VARCHAR     NOT NULL,

    -- NULL=not yet submitted, 1=agreed, 2=declined, 3=not eligible
    waiver_status        INTEGER,
    consent_submitted_at TIMESTAMPTZ,

    CONSTRAINT uix_student_module_enrollment UNIQUE (student_id, module_id)
);

CREATE INDEX ix_student_enrollments_module_id  ON student_enrollments(module_id);
CREATE INDEX ix_student_enrollments_student_id ON student_enrollments(student_id);


-- =============================================================================
-- STUDENT ANSWERS
-- One row per student per question per attempt.
-- =============================================================================
CREATE TABLE student_answers (
    id          UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id  VARCHAR  NOT NULL,
    question_id UUID     NOT NULL REFERENCES questions(id)  ON DELETE CASCADE,
    module_id   UUID     NOT NULL REFERENCES modules(id)    ON DELETE CASCADE,
    document_id UUID              REFERENCES documents(id)  ON DELETE CASCADE,

    answer      JSONB    NOT NULL,   -- supports MCQ + free-text
    attempt     INTEGER  NOT NULL,   -- 1 | 2 | …
    is_mastery  BOOLEAN  NOT NULL DEFAULT FALSE,

    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uix_student_question_attempt UNIQUE (student_id, question_id, attempt)
);

CREATE INDEX ix_student_answers_module_id              ON student_answers(module_id);
CREATE INDEX ix_student_answers_student_module         ON student_answers(student_id, module_id);
CREATE INDEX ix_student_answers_student_module_attempt ON student_answers(student_id, module_id, attempt);


-- =============================================================================
-- FEEDBACK JOBS  (persistent async queue)
-- Written before processing starts so jobs survive server restarts.
-- =============================================================================
CREATE TABLE feedback_jobs (
    id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    answer_id              UUID        NOT NULL REFERENCES student_answers(id) ON DELETE CASCADE,
    student_id             VARCHAR     NOT NULL,
    module_id              UUID        NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    attempt                INTEGER     NOT NULL,

    is_final_attempt       BOOLEAN     NOT NULL DEFAULT FALSE,

    -- queued | processing | done | retry | failed
    status                 VARCHAR(20) NOT NULL DEFAULT 'queued',
    priority               INTEGER     NOT NULL DEFAULT 1,  -- 1=urgent 2=normal 3=background

    retry_count            INTEGER     NOT NULL DEFAULT 0,
    max_retries            INTEGER     NOT NULL DEFAULT 5,
    locked_at              TIMESTAMPTZ,
    error_message          TEXT,
    previous_feedback_json JSONB,

    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at           TIMESTAMPTZ
);

CREATE INDEX ix_feedback_jobs_status_priority ON feedback_jobs(status, priority, created_at);
CREATE INDEX ix_feedback_jobs_answer_id       ON feedback_jobs(answer_id);
CREATE INDEX ix_feedback_jobs_student_module  ON feedback_jobs(student_id, module_id, attempt);


-- =============================================================================
-- AI FEEDBACK
-- One row per student_answer — created when AI generation completes.
-- =============================================================================
CREATE TABLE ai_feedback (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    answer_id               UUID        NOT NULL UNIQUE REFERENCES student_answers(id) ON DELETE CASCADE,
    job_id                  UUID                 REFERENCES feedback_jobs(id) ON DELETE SET NULL,

    -- Teacher review gate (used for final attempts)
    released                BOOLEAN     NOT NULL DEFAULT TRUE,
    requires_teacher_review BOOLEAN     NOT NULL DEFAULT FALSE,

    -- Scores
    is_correct              BOOLEAN,
    score                   INTEGER,             -- 0–100
    points_earned           FLOAT,
    points_possible         FLOAT,
    criterion_scores        JSONB,               -- per-criterion breakdown
    confidence_level        VARCHAR(20),         -- high | medium | low

    feedback_data           JSONB,               -- explanation, hints, strengths, weaknesses

    -- pending | generating | completed | failed | timeout
    generation_status       VARCHAR(20) NOT NULL DEFAULT 'completed',
    generation_progress     INTEGER     NOT NULL DEFAULT 100,

    error_message           VARCHAR,
    error_type              VARCHAR(50),
    retry_count             INTEGER     NOT NULL DEFAULT 0,
    max_retries             INTEGER     NOT NULL DEFAULT 3,
    can_retry               BOOLEAN     NOT NULL DEFAULT FALSE,
    timeout_seconds         INTEGER     NOT NULL DEFAULT 45,
    generation_duration     INTEGER,
    ai_model_used           VARCHAR(50),

    generated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at              TIMESTAMPTZ,
    completed_at            TIMESTAMPTZ
);

CREATE INDEX ix_ai_feedback_answer_id         ON ai_feedback(answer_id);
CREATE INDEX ix_ai_feedback_generated_at      ON ai_feedback(generated_at);
CREATE INDEX ix_ai_feedback_generation_status ON ai_feedback(generation_status);
CREATE INDEX ix_ai_feedback_job_id            ON ai_feedback(job_id);


-- =============================================================================
-- TEACHER GRADES  (manual override — source record)
-- Takes precedence over AI score when computing answer_grades.
-- =============================================================================
CREATE TABLE teacher_grades (
    id                 UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    answer_id          UUID    NOT NULL UNIQUE REFERENCES student_answers(id) ON DELETE CASCADE,
    student_id         VARCHAR NOT NULL,
    question_id        UUID    NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    module_id          UUID    NOT NULL REFERENCES modules(id)   ON DELETE CASCADE,

    points_awarded     FLOAT   NOT NULL,
    feedback_text      TEXT,
    criterion_scores   JSONB,

    ai_suggested_score FLOAT,
    overridden_ai      BOOLEAN NOT NULL DEFAULT FALSE,

    graded_by          VARCHAR NOT NULL REFERENCES users(id),
    graded_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_teacher_grades_answer_id      ON teacher_grades(answer_id);
CREATE INDEX ix_teacher_grades_student_module ON teacher_grades(student_id, module_id);
CREATE INDEX ix_teacher_grades_graded_by      ON teacher_grades(graded_by);


-- =============================================================================
-- ANSWER GRADES  ← NEW
-- Single source of truth for the *final resolved* grade on each answer.
-- Created when AI feedback completes; updated if teacher overrides.
-- Dashboard and gradebook read from here — no JOIN to ai_feedback needed.
-- =============================================================================
CREATE TABLE answer_grades (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    answer_id        UUID        NOT NULL UNIQUE REFERENCES student_answers(id) ON DELETE CASCADE,

    -- Denormalised so gradebook queries never need to JOIN back to student_answers
    student_id       VARCHAR     NOT NULL,
    question_id      UUID        NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    module_id        UUID        NOT NULL REFERENCES modules(id)   ON DELETE CASCADE,
    attempt          INTEGER     NOT NULL,

    -- Final grade (what the gradebook shows)
    score            FLOAT,               -- 0–100 percentage
    points_earned    FLOAT,
    points_possible  FLOAT,

    -- pending | ai | teacher | auto
    grade_source     VARCHAR(20) NOT NULL DEFAULT 'pending',
    criterion_scores JSONB,

    -- AI snapshot (preserved after teacher override for analytics)
    ai_score         FLOAT,
    ai_points_earned FLOAT,

    -- Teacher override detail
    graded_by        VARCHAR     REFERENCES users(id) ON DELETE SET NULL,
    graded_at        TIMESTAMPTZ,
    teacher_feedback TEXT,

    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_answer_grades_student_id             ON answer_grades(student_id);
CREATE INDEX ix_answer_grades_module_id              ON answer_grades(module_id);
CREATE INDEX ix_answer_grades_student_module         ON answer_grades(student_id, module_id);
CREATE INDEX ix_answer_grades_student_module_attempt ON answer_grades(student_id, module_id, attempt);
CREATE INDEX ix_answer_grades_grade_source           ON answer_grades(grade_source);


-- =============================================================================
-- TEST SUBMISSIONS  ← updated
-- One row per student per module per attempt (the "submit test" action).
-- FK to student_enrollments enforces: must be enrolled to submit.
-- =============================================================================
CREATE TABLE test_submissions (
    id                    UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id            VARCHAR NOT NULL,
    module_id             UUID    NOT NULL,
    attempt               INTEGER NOT NULL,

    submitted_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    questions_count       INTEGER NOT NULL,

    -- Score snapshot (quick read; canonical data is in student_module_grades)
    total_points_possible FLOAT,
    total_points_earned   FLOAT,
    percentage_score      FLOAT,   -- 0–100

    -- Must be enrolled before submitting
    CONSTRAINT fk_test_submission_enrollment
        FOREIGN KEY (student_id, module_id)
        REFERENCES student_enrollments(student_id, module_id)
        ON DELETE RESTRICT,

    -- Cascade when module is deleted
    CONSTRAINT fk_test_submission_module
        FOREIGN KEY (module_id)
        REFERENCES modules(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_test_submission UNIQUE (student_id, module_id, attempt)
);

CREATE INDEX ix_test_submission_lookup ON test_submissions(student_id, module_id);
CREATE INDEX ix_test_submission_module ON test_submissions(module_id);


-- =============================================================================
-- STUDENT MODULE GRADES  ← NEW
-- Aggregate gradebook row: one per student per module per attempt.
-- Recomputed whenever an answer_grade row is inserted or updated.
-- Teacher gradebook view reads from here.
-- =============================================================================
CREATE TABLE student_module_grades (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id            VARCHAR     NOT NULL,
    module_id             UUID        NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    attempt               INTEGER     NOT NULL DEFAULT 1,

    total_points_earned   FLOAT       NOT NULL DEFAULT 0,
    total_points_possible FLOAT       NOT NULL DEFAULT 0,
    percentage_score      FLOAT       NOT NULL DEFAULT 0,   -- 0–100
    letter_grade          VARCHAR(5),                       -- A  B+  C-  F …

    questions_graded      INTEGER     NOT NULL DEFAULT 0,   -- answers with a grade
    questions_total       INTEGER     NOT NULL DEFAULT 0,   -- all questions in module
    is_complete           BOOLEAN     NOT NULL DEFAULT FALSE,

    -- pending | ai | teacher | mixed
    grade_source          VARCHAR(20) NOT NULL DEFAULT 'pending',

    -- Teacher sign-off
    is_finalized          BOOLEAN     NOT NULL DEFAULT FALSE,
    finalized_at          TIMESTAMPTZ,
    finalized_by          VARCHAR     REFERENCES users(id) ON DELETE SET NULL,

    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uix_smg_student_module_attempt
        UNIQUE (student_id, module_id, attempt)
);

CREATE INDEX ix_smg_module_id            ON student_module_grades(module_id);
CREATE INDEX ix_smg_student_id           ON student_module_grades(student_id);
CREATE INDEX ix_smg_module_attempt_score ON student_module_grades(module_id, attempt, percentage_score DESC);
CREATE INDEX ix_smg_finalized            ON student_module_grades(module_id, is_finalized);


-- =============================================================================
-- SURVEY RESPONSES  (standalone — independent of test_submissions)
-- student_id + module_id is enough; no FK to test_submissions needed.
-- =============================================================================
CREATE TABLE survey_responses (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id   VARCHAR     NOT NULL,
    module_id    UUID        NOT NULL REFERENCES modules(id) ON DELETE CASCADE,

    -- {"q1": "answer text", "q2": "answer text", …}
    responses    JSONB       NOT NULL DEFAULT '{}',

    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uix_student_module_survey UNIQUE (student_id, module_id)
);

CREATE INDEX ix_survey_responses_module_id  ON survey_responses(module_id);
CREATE INDEX ix_survey_responses_student_id ON survey_responses(student_id);


-- =============================================================================
-- FEEDBACK CRITIQUES  (student rates AI feedback quality)
-- =============================================================================
CREATE TABLE feedback_critiques (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    feedback_id   UUID        NOT NULL REFERENCES ai_feedback(id) ON DELETE CASCADE,
    student_id    VARCHAR     NOT NULL,

    rating        INTEGER     NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment       TEXT,
    feedback_type VARCHAR(50),   -- 'not_helpful' | 'incorrect' | 'helpful' | …

    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_feedback_critiques_feedback_id ON feedback_critiques(feedback_id);
CREATE INDEX ix_feedback_critiques_student_id  ON feedback_critiques(student_id);
CREATE INDEX ix_feedback_critiques_rating      ON feedback_critiques(rating);


-- =============================================================================
-- QUESTION QUEUE  (mastery learning — per-student question rotation)
-- =============================================================================
CREATE TABLE question_queue (
    id              UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id      VARCHAR  NOT NULL,
    module_id       UUID     NOT NULL REFERENCES modules(id)   ON DELETE CASCADE,
    question_id     UUID     NOT NULL REFERENCES questions(id) ON DELETE CASCADE,

    position        INTEGER  NOT NULL,
    attempts        INTEGER  NOT NULL DEFAULT 0,
    is_mastered     BOOLEAN  NOT NULL DEFAULT FALSE,
    streak_count    INTEGER  NOT NULL DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_question_queue_student_module ON question_queue(student_id, module_id);


-- =============================================================================
-- CHAT CONVERSATIONS
-- =============================================================================
CREATE TABLE chat_conversations (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id VARCHAR     NOT NULL,
    module_id  UUID        NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    title      VARCHAR     NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_chat_conversations_student_module ON chat_conversations(student_id, module_id);


-- =============================================================================
-- CHAT MESSAGES
-- =============================================================================
CREATE TABLE chat_messages (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID        NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,

    -- 'student' | 'assistant'
    role            VARCHAR     NOT NULL,
    content         TEXT        NOT NULL,
    context_used    JSONB,       -- RAG chunks used (assistant messages only)

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_chat_messages_conversation_id ON chat_messages(conversation_id);


-- =============================================================================
-- TRIGGER: keep updated_at columns current automatically
-- =============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_answer_grades_updated_at
    BEFORE UPDATE ON answer_grades FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_smg_updated_at
    BEFORE UPDATE ON student_module_grades FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_survey_responses_updated_at
    BEFORE UPDATE ON survey_responses FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_chat_conversations_updated_at
    BEFORE UPDATE ON chat_conversations FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_feedback_critiques_updated_at
    BEFORE UPDATE ON feedback_critiques FOR EACH ROW EXECUTE FUNCTION set_updated_at();
