# AI Education Pilot — Requirements Document

**Version:** 1.0
**Date:** March 25, 2026
**Prepared by:** Yubraj Khatri

---

## 1. Document Overview

### 1.1 Purpose of This Document

This document helps QA testers, new team members, and stakeholders understand what the AI Pilot system is, how it works, who uses it, and what to expect when testing it. It defines scope, features, user roles, and known limitations so testers focus effort on the right areas.

### 1.2 Intended Audience

* QA testers performing functional and integration testing
* Developers onboarding to the project
* Instructors and students using the system for the first time
* Stakeholders evaluating the platform

### 1.3 Document Version History

| Version | Date           | Author        | Changes       |
| ------- | -------------- | ------------- | ------------- |
| 1.0     | March 25, 2026 | Yubraj Khatri | Initial draft |

---

## 2. System Overview

### 2.1 What Is the AI Education Pilot?

AI Pilot is a web-based educational platform that uses Retrieval-Augmented Generation (RAG) to deliver instant, personalized AI feedback to students on their assignment answers. Instructors upload course materials (PDFs, PowerPoints, Word docs), create or AI-generate questions, and configure how feedback is delivered. When a student submits an answer, the system retrieves relevant content from the course materials and uses that context to generate meaningful, rubric-aligned feedback through OpenAI's language models.

**Tech Stack:** FastAPI backend, Next.js frontend, PostgreSQL with pgvector, OpenAI API, Supabase storage.

### 2.2 Goals & Objectives

* **Goal 1:** Reduce instructor grading workload by automating initial feedback generation using AI grounded in actual course materials.
* **Goal 2:** Provide students with immediate, contextual feedback on their answers so they can learn from mistakes without waiting for manual grading.
* **Goal 3:** Give instructors full control over the feedback pipeline — including review gates, rubric configuration, and feedback release timing.

### 2.3 Who Are the Users?

| User Type              | Why They Use It                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Students               | Submit assignment answers, receive AI feedback, access course resources, practice mastery learning, use AI chatbot, or get AI Grade. |
| Teachers / Instructors | Submit assignment answers, receive AI feedback, access course resources, practice mastery learning, use AI chatbot.                  |
| Admins                 | Monitor platform usage, manage user accounts, configure AI model settings.                                                           |

> **Note:** Admin user role has not been created yet.

---

## 3. System Features & Functionality

### 3.1 Core Features List

| #  | Feature Name                 | Description                                                                                                                                                                                                                                                                            |
| -- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1  | RAG-Based AI Feedback        | When a student submits an answer, the system finds relevant chunks from the module's course documents using vector similarity, then sends that context + the student's answer + the rubric to OpenAI to generate detailed feedback (explanation, strengths, weaknesses, hints, score). |
| 2  | Assignment & Question System | Supports multiple question types: MCQ, multiple-select MCQ, short answer, long essay, fill-in-the-blank, and multi-part. Students get up to a configurable number of attempts (default: 2). Questions go through an approval workflow before students see them.                        |
| 3  | AI Question Generation       | Teachers can select a document and have OpenAI automatically generate questions from its content. Generated questions appear as "Unreviewed" and must be approved by the teacher before students can access them.                                                                      |
| 4  | Mastery Learning Mode        | An optional practice mode where students answer questions repeatedly until they achieve a configurable streak (default: 3 correct in a row). Tracks per-student progress per question with streak counters and visual progress indicators.                                             |
| 5  | Feedback Job Queue           | A background worker system (10 parallel threads) processes feedback generation asynchronously. Supports retry logic (up to 5 retries), priority levels (urgent/normal/background), and stale job recovery on server restart.                                                           |
| 6  | Rubric-Based Grading         | Teachers define scoring rubrics per module. AI feedback is generated against those rubric criteria. Teachers can manually override scores.                                                                                                                                             |
| 7  | AI Chatbot (per module)      | Students can chat with a module-specific AI assistant grounded in course materials. Teachers define the chatbot's persona and response style.                                                                                                                                          |
| 8  | Document Processing Pipeline | Uploaded documents are automatically extracted, chunked, embedded into vectors, and indexed for RAG search. Supports PDF, PowerPoint, and Word formats.                                                                                                                                |
| 9  | Consent & Survey System      | Each module can have a customizable research consent form. Students must agree before participating. End-of-module surveys collect student feedback (5 default questions).                                                                                                             |
| 10 | Grade Export                 | Teachers can export all student answers and scores to Excel/CSV for record-keeping or uploading to an LMS.                                                                                                                                                                             |

### 3.2 How the System Is Intended to Work (User Flow)

#### Instructor Setup Flow

1. Instructor registers, creates a module, and gets an access code to share with students.
2. Instructor uploads course documents (PDF/PPT/Word). The system processes and indexes them for RAG search.
3. Instructor creates questions manually or uses AI generation to produce them from document content, or imports content if they have it.
4. Instructor reviews AI-generated questions and approves them (status: Unreviewed → Active).
5. Instructor configures module settings: max attempts, rubric, feedback release rules, chatbot behavior, consent form.

#### Student Assignment Flow

1. Student navigates to `/join` and enters the module access code provided by the instructor.
2. Student reads and agrees to the consent form (required to proceed).
3. Student opens the assignment and answers questions (MCQ, short answer, essay, etc.).
4. Student submits answers. The system creates a feedback job in the background queue.
5. A background worker retrieves relevant course content via RAG, calls OpenAI, and generates feedback.
6. Student sees a real-time progress bar while feedback generates, then views the full feedback when ready.
7. If a second attempt is allowed and the student wants to retry, they resubmit. Second-attempt feedback may be held for teacher review depending on module settings.

### 3.3 AI Behavior & Responses

* Feedback is grounded in the module's course documents — the AI does not answer from general knowledge alone.
* For each submitted answer, the AI returns: an explanation, identified strengths, weaknesses, hints for improvement, and a score (if rubric is configured).
* If the AI returns a generic/fallback response, the system automatically retries up to 5 times.
* Feedback generation typically takes 2–10 seconds per question. A real-time progress bar shows status.
* The chatbot uses the same RAG system and responds within the context of course materials. Its tone and behavior are shaped by the instructor's custom instructions.
* For MCQ questions, the AI validates the selected option. For essay/short answer, it evaluates reasoning, completeness, and alignment with rubric criteria.

### 3.4 Known Limitations

| # | Limitation                                                                                                                                                                                 |
| - | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 | Mastery Learning is under active development. Some edge cases in streak tracking and reset behavior may not work as expected.                                                              |
| 2 | RAG only searches within a single module's documents. The AI has no knowledge of materials from other modules.                                                                             |
| 3 | Documents must be fully processed before AI features work. If a document is still in the "embedding" stage, questions cannot be generated from it and RAG feedback will lack that content. |
| 4 | Feedback timeout is 45 seconds per question. Very large batches submitted simultaneously may cause some feedback to fail and require retry.                                                |
| 5 | No cross-module context. The chatbot and feedback AI only know about the current module's uploaded materials.                                                                              |
| 6 | Email delivery depends on external SMTP configuration. Verification emails and password resets may not work in test environments without a configured mail server.                         |
| 7 | RAG retrieval may include low-relevance content. The similarity threshold is permissive (0.3), so occasionally the AI may receive loosely related context.                                 |

---

## 4. User Roles & Access

### 4.1 Role Types

| Role                 | Description                                                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Student              | Enrolled learner who joins modules via access code, submits assignments, and receives AI feedback.                                                  |
| Teacher / Instructor | Creates and manages modules, uploads content, generates and approves questions, reviews submissions, and configures all AI and feedback settings.   |
| Admin                | Platform-level administrator with access to all modules and user management. Configures system-wide AI model settings and monitors platform health. |

### 4.2 What Each Role Can Do

| Role    | Can Do                                                                                                                                                                                                                        | Cannot Do                                                                                                                         |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Student | Join modules via access code; submit answers; view AI feedback; access resources; use AI chatbot; critique feedback; complete surveys; view attempt history                                                                   | Create/manage modules; upload documents; view other students' answers; approve questions; change feedback settings; export grades |
| Teacher | Create/edit/delete modules; upload documents; generate and approve questions; set rubrics; configure attempts and feedback release; view all submissions; override scores; export grades; configure chatbot and consent forms | Access other teachers' modules; change platform-wide AI settings; manage user accounts                                            |
| Admin   | All teacher capabilities; manage all user accounts; configure platform-wide AI settings; view institution-wide analytics; delete any module                                                                                   | N/A (full access)                                                                                                                 |

> **Note:** Admin role is still being finalized.

---

## 5. Key Workflows to Understand

### 5.1 Logging In / Onboarding

* New users register at `/sign-up` with name, email, and password.
* A verification email is sent — users must verify their email before logging in.
* After verification, users log in at `/sign-in`. The system returns a JWT access token and refresh token.
* Every logged-in user is assigned the Teacher role by default.
* Students join a module by going to `/join` and entering the access code their instructor shared.
* On first joining a module, students must complete the consent form before accessing assignments (this is for research consent).

### 5.2 Main User Journey (Student)

1. Open the link shared by the instructor.
2. On the module page, view tabs: Assignments, Resources, Feedback, Chat, Survey.
3. Open the Assignments tab → click "Start Test."
4. Answer each question and submit.
5. Watch the progress bar as feedback generates in real time.
6. Once complete, view detailed AI feedback per question (score, explanation, strengths, weaknesses, hints).
7. If a second attempt is allowed, review feedback and resubmit improved answers.
8. Access the Resources tab to view uploaded course documents.
9. Use the Chat tab to ask the AI assistant questions about course material.
10. Complete the Survey at the end of the module.
11. Or use the Mastery Learning tab to practice before taking the test.

### 5.3 Edge Cases & Expected Behavior

| Scenario                                                                | Expected Behavior                                                                                                                                                                             |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Student submits without agreeing to consent                             | Student is able to do the assignment. Their data is simply not used for research.                                                                                                             |
| AI feedback generation fails (timeout or API error)                     | System retries up to 5 times automatically; student sees "feedback pending" until retry succeeds or fails permanently.                                                                        |
| Teacher deletes a question that has student answers                     | Cascading delete removes all associated student answers and feedback.                                                                                                                         |
| Student joins with an invalid access code                               | Error message displayed; no enrollment created.                                                                                                                                               |
| Teacher approves a question after students have already loaded the test | Students must refresh to see the newly approved question.                                                                                                                                     |
| Document upload fails during embedding                                  | Document shows error status; teacher must re-upload; no feedback can be generated from that document until it completes successfully. A green "embedded" tag indicates successful processing. |
| Student submits a final attempt                                         | Feedback is held for teacher review (not immediately visible to student) if that setting is enabled. Teacher must manually verify and approve or make changes before it is released.          |
| Teacher exports grades with no submissions                              | Returns an empty Excel file (no error).                                                                                                                                                       |
| AI returns a generic/fallback response                                  | System detects the fallback pattern and automatically retries the generation job.                                                                                                             |

---

## 6. Out of Scope

The system does  **not** :

* Integrate with any LMS (Canvas, Moodle, Blackboard) — grade export is manual via Excel.
* Support real-time video, audio, or proctoring for assessments.
* Handle plagiarism detection between student submissions.
* Support multiple languages — the platform and AI responses are English-only.
* Allow students to directly upload documents or add their own materials.
* Send automated grade notifications by email — students must log in to view feedback.
* Support offline/mobile-native usage — it is a web-only application.

**Features the system does currently support:**

* Spelling checks in the question input box.
* Pre-made test bank import and export for future use.

---

## 7. Glossary

| Term             | Definition                                                                                                                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RAG              | Retrieval-Augmented Generation. A technique where the AI is given relevant passages from a document to base its responses on, rather than relying solely on its pre-trained knowledge. |
| Module           | A course or subject created by a teacher. Students join a module using an access code. Each module has its own documents, questions, settings, and chatbot.                            |
| Feedback Job     | A background task created when a student submits an answer. The job queues the AI feedback generation and tracks status (queued → processing → done).                                |
| Mastery Learning | A practice mode where students must answer a question correctly a set number of times in a row (streak) before it is marked as mastered.                                               |
| Question Status  | Questions move through three states: Unreviewed (AI-generated, not yet approved), Active (visible to students), Archived (hidden from students).                                       |
| Rubric           | A structured scoring guide defined by the teacher. The AI uses rubric criteria when evaluating essay and short-answer responses.                                                       |
| Embedding        | A numerical vector representation of text, used to measure similarity between a student's answer and document content during RAG retrieval.                                            |
| SSE              | Server-Sent Events. A one-way streaming protocol used by the feedback progress bar to push real-time updates from server to browser.                                                   |
| Attempt          | A single submission of answers to an assignment. The maximum number of attempts is configurable per module (default: 2).                                                               |
| Feedback Release | The point at which AI feedback becomes visible to a student. Teachers can hold final-attempt feedback for manual review before releasing it.                                           |
| Access Code      | A short code generated per module that students use to enroll. Shared by the instructor (e.g., via email or in class).                                                                 |
| Chunk            | A small segment of text extracted from an uploaded document. Documents are split into chunks for efficient vector search during RAG retrieval.                                         |

---

## 8. Tester Notes & Expectations

### 8.1 Practical Notes for Testers

* When creating a test account, avoid using college email addresses (e.g., `@brockport.edu`) — institutional email servers often block verification emails or send them to spam, which will prevent account activation.
* Use a personal email (Gmail, Outlook, etc.) for reliable email verification during testing.

### 8.2 Platform Versions

This system is actively under development and new versions are released frequently as the project evolves. Always confirm which version you are testing against before starting.

| Version          | URL                                  |
| ---------------- | ------------------------------------ |
| Latest version   | https://aipilot.brockportsigai.org/  |
| Previous version | https://aipilot2.brockportsigai.org/ |

> **Note:** The previous version is currently in use in class. The latest version has not been deployed to class yet.

### 8.3 What I Expect From Testers

* If a button feels off — wrong place, wrong color, or just doesn't feel right — go ahead and flag it.
* If any color combination makes text hard to read or hurts your eyes, mention it.
* If a form doesn't submit, throws a weird error, or behaves unexpectedly, note it down.
* If a page crashes, freezes, or loads blank, that's definitely worth reporting.
* If something looks broken on your phone vs your laptop, let us know.
* If fonts, spacing, or styling feels inconsistent or out of place, flag it.
* If the AI feedback feels completely unrelated to what was submitted, report it.
* If the progress bar gets stuck or feedback never shows up, mention it.
* If feedback is visible when it probably shouldn't be (or missing when it should be there), flag it.
* If something feels confusing as a first-time user — even a small thing — trust that feeling and report it.
* If something feels like it's missing, like a button, a label, or a confirmation message, say so.
* If any wording or instruction is hard to understand, we want to know so we can fix it.
