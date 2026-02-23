
from fastapi import FastAPI
from typing import Union
import logging
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s - %(name)s - %(message)s'
)

# 🚦 Import API routers
from app.api.routes.test import router as test_router
from app.api.routes.user import router as user_router
from app.api.routes.auth import router as auth_router
from app.api.routes.document import router as document_router
from app.api.routes.question import router as question_router
from app.api.routes.module import router as module_router
from app.api.routes.student import router as student_router
from app.api.routes.student_answers import router as student_answers_router
from app.api.routes.chat import router as chat_router
from app.api.routes.survey import router as survey_router
from app.api.routes.export import router as export_router
from app.api.routes.feedback import router as feedback_router

from app.core.config import add_cors
from app.database import engine
from app.models import Base


# Middleware to handle X-Forwarded-Proto from Google Cloud Run
class ProxyHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Trust proxy headers from Google Cloud Run
        forwarded_proto = request.headers.get("X-Forwarded-Proto")
        if forwarded_proto:
            request.scope["scheme"] = forwarded_proto

        response = await call_next(request)
        return response


app = FastAPI()

# 🔒 Add proxy headers middleware FIRST (before CORS)
app.add_middleware(ProxyHeadersMiddleware)

# 🚦 Apply CORS settings
add_cors(app)

# 🔌 Register API routes
app.include_router(test_router, prefix="/api")
app.include_router(user_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(document_router, prefix="/api", tags=["Documents"])
app.include_router(question_router, prefix="/api", tags=["Questions"])
app.include_router(module_router, prefix="/api", tags=["module"])
app.include_router(student_router, prefix="/api/student", tags=["Student"])
app.include_router(student_answers_router, prefix="/api/student-answers", tags=["Student Answers"])
app.include_router(chat_router, prefix="/api", tags=["Chat"])
app.include_router(survey_router, prefix="/api", tags=["Survey"])
app.include_router(export_router, prefix="/api", tags=["Export"])
app.include_router(feedback_router, prefix="/api/ai-feedback", tags=["AI Feedback"])

# 🚀 Startup event to create all tables and import all models
@app.on_event("startup")
def on_startup():
    print("🚀 App startup initiated...")

    # ✅ Validate environment variables before proceeding
    from app.core.config import validate_required_env_vars
    try:
        validate_required_env_vars()
        print("✅ All required environment variables are set")
    except ValueError as e:
        print(f"\n{'='*80}")
        print(f"⚠️  STARTUP ERROR: Environment Variables Missing")
        print(f"{'='*80}")
        print(str(e))
        print(f"{'='*80}\n")
        # Re-raise to prevent app from starting with missing config
        raise

    # ✅ Ensure all models are imported for table creation
    from app.models import user, document, question, module, student_answer, student_enrollment, survey_response, question_queue, document_chunk, document_embedding, ai_feedback, chat_conversation, chat_message
    from app.models import feedback_job  # noqa: F401 — register FeedbackJob table
    print("📊 Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("✅ All tables created successfully")

    # ✅ Recover any jobs that were in-flight when the server last stopped
    from app.services.feedback_worker import recover_stale_jobs, start_worker
    recover_stale_jobs()
    print("✅ Stale feedback jobs recovered")

    # ✅ Start the feedback worker thread
    start_worker()
    print("✅ Feedback worker started")
    print("🎉 Application startup complete!")

# 📎 Test route
@app.get("/")
def read_root():
    return {"Hello": "World"}

# 📎 Sample item route
@app.get("/items/{item_id}")
def read_item(item_id: int, q: Union[str, None] = None):
    return {"item_id": item_id, "q": q}

# 🩺 Diagnostic endpoint to verify OpenAI + DB health
@app.get("/api/health/diagnostics")
def run_diagnostics():
    """Quick health check of OpenAI API, database, and feedback stats."""
    import time
    from app.database import SessionLocal
    from app.core.config import OPENAI_API_KEY, LLM_MODEL

    results = {"openai": {}, "database": {}, "feedback_stats": {}, "job_queue": {}}

    # 1. Test OpenAI API
    try:
        import json as _json
        from app.services.openai_client import OpenAIClientWithRetry
        client = OpenAIClientWithRetry(api_key=OPENAI_API_KEY, default_model=LLM_MODEL)

        # Test gpt-4o-mini (used for MCQ grading)
        start = time.time()
        resp = client.create_chat_completion(
            messages=[{"role": "user", "content": "Say OK"}],
            model="gpt-4o-mini", max_tokens=5
        )
        results["openai"]["gpt-4o-mini"] = {
            "status": "ok",
            "response_time_ms": int((time.time() - start) * 1000),
            "response": resp.choices[0].message.content.strip()
        }

        # Test default model (used for text/essay grading)
        start = time.time()
        resp = client.create_chat_completion(
            messages=[{"role": "user", "content": "Say OK"}],
            model=LLM_MODEL, max_tokens=5
        )
        results["openai"][LLM_MODEL] = {
            "status": "ok",
            "response_time_ms": int((time.time() - start) * 1000),
            "response": resp.choices[0].message.content.strip()
        }

        # Test JSON structured output parsing (the actual failure mode)
        start = time.time()
        json_resp = client.create_chat_completion(
            messages=[{"role": "user", "content": 'Respond with only this JSON: {"is_correct": true, "explanation": "test"}'}],
            model="gpt-4o-mini", max_tokens=50, temperature=0.0
        )
        raw_json = json_resp.choices[0].message.content.strip()
        # Try parsing — this is where real feedback often fails
        if raw_json.startswith("```"):
            raw_json = raw_json.split("```")[1]
            if raw_json.startswith("json"):
                raw_json = raw_json[4:]
            raw_json = raw_json.strip()
        parsed = _json.loads(raw_json)
        results["openai"]["json_parse_test"] = {
            "status": "ok",
            "response_time_ms": int((time.time() - start) * 1000),
            "raw_response": json_resp.choices[0].message.content.strip()[:200],
            "parsed_keys": list(parsed.keys())
        }
    except _json.JSONDecodeError as je:
        results["openai"]["json_parse_test"] = {
            "status": "fail",
            "error_type": "JSONDecodeError",
            "error": str(je)[:200],
            "raw_response": raw_json[:200] if 'raw_json' in dir() else None
        }
    except Exception as e:
        results["openai"]["error"] = f"{type(e).__name__}: {str(e)}"

    # 2. Test database
    db = SessionLocal()
    try:
        from app.models.ai_feedback import AIFeedback
        from sqlalchemy import func

        total = db.query(func.count(AIFeedback.id)).scalar()
        statuses = dict(
            db.query(AIFeedback.generation_status, func.count())
            .group_by(AIFeedback.generation_status).all()
        )

        # Count fallback feedbacks
        completed = db.query(AIFeedback).filter(
            AIFeedback.generation_status == 'completed'
        ).all()
        fallback_count = sum(
            1 for fb in completed
            if fb.feedback_data and fb.feedback_data.get('fallback', False)
        )

        results["database"]["status"] = "ok"
        results["feedback_stats"] = {
            "total": total,
            "by_status": statuses,
            "fallback_stuck_as_completed": fallback_count
        }
    except Exception as e:
        results["database"]["error"] = f"{type(e).__name__}: {str(e)}"
    finally:
        db.close()

    # 3. Job queue stats
    try:
        from app.services.feedback_worker import get_queue_stats
        results["job_queue"] = get_queue_stats()
    except Exception as e:
        results["job_queue"]["error"] = f"{type(e).__name__}: {str(e)}"

    return results