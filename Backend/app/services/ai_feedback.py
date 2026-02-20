import openai
import json
import logging
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from app.core.config import OPENAI_API_KEY, LLM_MODEL
from app.models.question import Question
from app.models.student_answer import StudentAnswer
from app.models.module import Module
from app.crud.question import get_question_by_id
from app.services.embedding import search_similar_chunks
from app.services.rubric import get_module_rubric
from app.services.rag_retriever import get_context_for_feedback
from app.services.prompt_builder import (
    build_mcq_feedback_prompt,
    build_text_feedback_prompt,
    should_include_context,
    _build_previous_feedback_section
)
from app.crud.ai_feedback import (
    create_feedback,
    get_feedback_by_answer,
    create_pending_feedback,
    update_feedback_status,
    complete_feedback_generation,
    mark_feedback_failed
)
from app.schemas.ai_feedback import AIFeedbackCreate
from app.services.openai_client import OpenAIClientWithRetry

logger = logging.getLogger(__name__)

class AIFeedbackService:
    """Service for generating AI-powered feedback on student answers"""

    def __init__(self):
        # Use the new OpenAI client with retry logic
        self.client = OpenAIClientWithRetry(api_key=OPENAI_API_KEY, default_model=LLM_MODEL)
        self.default_model = LLM_MODEL

    def generate_instant_feedback(
        self,
        db: Session,
        student_answer: StudentAnswer,
        question_id: str,
        module_id: str,
        previous_feedback_context: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Generate instant AI feedback for student submission with rubric and RAG support

        Args:
            db: Database session
            student_answer: StudentAnswer object
            question_id: UUID of the question
            module_id: UUID of the module (for getting AI model config and rubric)
            previous_feedback_context: Optional list of per-question previous attempt feedback.
                Format: [{ attempt: int, ai_feedback: str, score: int, student_answer: str }]

        Returns:
            Dict with feedback data
        """
        try:
            # ========== STEP 1: Check if feedback already exists ==========
            existing_feedback = get_feedback_by_answer(db, student_answer.id)

            if existing_feedback:
                # Check status of existing feedback
                if existing_feedback.generation_status == 'completed':
                    if existing_feedback.feedback_data:
                        # Check if this is fallback that should be upgraded
                        is_fallback = existing_feedback.feedback_data.get('fallback', False)
                        if is_fallback:
                            logger.info(f"Fallback feedback detected for answer {student_answer.id} — regenerating with real AI")
                            # Continue with generation (don't return early)
                        else:
                            logger.info(f"Returning existing completed feedback for answer {student_answer.id}")
                            return self._feedback_model_to_dict(existing_feedback)
                    else:
                        # Status says 'completed' but data is NULL - regenerate
                        logger.warning(f"Status is 'completed' but feedback_data is NULL - regenerating for answer {student_answer.id}")
                        # Continue with generation

                elif existing_feedback.generation_status in ['pending', 'generating']:
                    # IMPORTANT: If status is 'pending' but feedback_data is NULL, this is a RETRY
                    # (reset_feedback_for_retry sets status to 'pending' for retries)
                    # We should continue with generation, NOT return early!
                    if existing_feedback.feedback_data is None:
                        logger.info(f"🔄 Status is '{existing_feedback.generation_status}' but feedback_data is NULL - this is a retry, continuing with generation for answer {student_answer.id}")
                        # Continue with generation
                    else:
                        # Feedback data exists and is currently being generated - return early
                        logger.info(f"⏳ Feedback already being generated for answer {student_answer.id}")
                        return self._feedback_model_to_dict(existing_feedback)

                elif existing_feedback.generation_status in ['failed', 'timeout']:
                    logger.info(f"🔄 Re-generating failed feedback for answer {student_answer.id}")
                    # Continue with re-generation
                else:
                    # Unknown status, return existing
                    logger.warning(f"⚠️ Unknown feedback status: {existing_feedback.generation_status}")
                    return self._feedback_model_to_dict(existing_feedback)

            # ========== STEP 2: Create pending feedback row FIRST ==========
            if not existing_feedback:
                logger.info(f"📝 Creating pending feedback row for answer {student_answer.id}")
                existing_feedback = create_pending_feedback(
                    db=db,
                    answer_id=student_answer.id,
                    timeout_seconds=45  # 45 second timeout
                )

            # ========== STEP 3: Update status to 'generating' ==========
            update_feedback_status(
                db=db,
                answer_id=student_answer.id,
                status='generating',
                progress=10
            )

            # ========== STEP 4: Load question and module data ==========
            question = get_question_by_id(db, question_id)
            if not question:
                logger.error(f"❌ Question {question_id} not found — returning fallback feedback")
                fallback = self._build_universal_fallback(student_answer, question_id, module_id, db)
                try:
                    complete_feedback_generation(db=db, answer_id=student_answer.id,
                        feedback_data={"explanation": fallback["explanation"], "fallback": True},
                        is_correct=None, score=None, points_earned=0, points_possible=0,
                        criterion_scores={}, confidence_level="low", ai_model="fallback")
                except Exception:
                    pass
                return fallback

            update_feedback_status(db, student_answer.id, 'generating', 20)

            # Get module configuration
            module = db.query(Module).filter(Module.id == module_id).first()
            if not module:
                logger.error(f"❌ Module {module_id} not found — returning fallback feedback")
                fallback = self._build_universal_fallback(student_answer, question_id, module_id, db)
                try:
                    complete_feedback_generation(db=db, answer_id=student_answer.id,
                        feedback_data={"explanation": fallback["explanation"], "fallback": True},
                        is_correct=None, score=None, points_earned=0, points_possible=0,
                        criterion_scores={}, confidence_level="low", ai_model="fallback")
                except Exception:
                    pass
                return fallback

            # Get rubric configuration (merges with defaults)
            rubric = get_module_rubric(db, module_id)

            # Get AI model from rubric or use default
            ai_model = self._get_ai_model_from_rubric(rubric)

            update_feedback_status(db, student_answer.id, 'generating', 30)

            # Extract student's answer based on format
            student_answer_text = self._extract_answer_text(student_answer.answer)
            logger.info(f"📝 Extracted answer text: '{student_answer_text}' from raw answer: {student_answer.answer}")

            # Get RAG context if enabled in rubric
            rag_context = None
            should_use_rag = should_include_context(rubric, question.type)
            logger.info(f"🔍 RAG CHECK: should_include_context={should_use_rag}, question_type={question.type}")
            logger.info(f"🔍 RAG SETTINGS: {rubric.get('rag_settings', {})}")

            if should_use_rag:
                rag_settings = rubric.get("rag_settings", {})
                logger.info(f"🔍 ATTEMPTING RAG RETRIEVAL for module_id={module_id}")
                logger.info(f"   max_chunks={rag_settings.get('max_context_chunks', 3)}")
                logger.info(f"   similarity_threshold={rag_settings.get('similarity_threshold', 0.7)}")
                try:
                    rag_context = get_context_for_feedback(
                        db=db,
                        question_text=question.text,
                        student_answer=student_answer_text,
                        module_id=module_id,
                        max_chunks=rag_settings.get("max_context_chunks", 3),
                        similarity_threshold=rag_settings.get("similarity_threshold", 0.3),
                        include_document_locations=rag_settings.get("include_document_locations", True)
                    )
                    logger.info(f"✅ RAG context retrieved: has_context={rag_context.get('has_context', False)}")
                    if rag_context and rag_context.get('has_context'):
                        logger.info(f"   📚 Sources: {rag_context.get('sources', [])}")
                        logger.info(f"   📄 Chunks: {len(rag_context.get('chunks', []))}")
                    else:
                        logger.warning(f"⚠️  RAG returned no context")
                except Exception as rag_error:
                    logger.error(f"❌ RAG retrieval failed: {str(rag_error)}")
                    logger.exception("Full RAG error traceback:")
                    rag_context = None
            else:
                logger.info(f"⏭️  Skipping RAG (should_include_context=False)")

            update_feedback_status(db, student_answer.id, 'generating', 50)

            # ========== STEP 5: Generate feedback based on question type ==========
            # Use GPT-4o-mini for MCQ types — binary grading doesn't need full GPT-4
            mcq_model = "gpt-4o-mini"

            if question.type == 'mcq':
                feedback = self._analyze_mcq_answer(
                    student_answer=student_answer_text,
                    question=question,
                    ai_model=mcq_model,
                    rubric=rubric,
                    rag_context=rag_context,
                    previous_feedback=previous_feedback_context
                )
            elif question.type == 'fill_blank':
                feedback = self._analyze_fill_blank_answer(
                    student_answer=student_answer.answer,
                    question=question,
                    ai_model=ai_model,
                    rubric=rubric,
                    rag_context=rag_context,
                    previous_feedback=previous_feedback_context
                )
            elif question.type == 'mcq_multiple':
                feedback = self._analyze_mcq_multiple_answer(
                    student_answer=student_answer.answer,
                    question=question,
                    ai_model=mcq_model,
                    rubric=rubric,
                    rag_context=rag_context,
                    previous_feedback=previous_feedback_context
                )
            elif question.type == 'multi_part':
                feedback = self._analyze_multi_part_answer(
                    student_answer=student_answer.answer,
                    question=question,
                    ai_model=ai_model,
                    rubric=rubric,
                    rag_context=rag_context,
                    previous_feedback=previous_feedback_context
                )
            else:
                # Default to text answer for short/long types
                feedback = self._analyze_text_answer(
                    student_answer=student_answer_text,
                    question=question,
                    ai_model=ai_model,
                    rubric=rubric,
                    rag_context=rag_context,
                    previous_feedback=previous_feedback_context
                )

            # Prepare feedback data for storage
            is_fallback = feedback.get("fallback", False)
            feedback_data = {
                "explanation": feedback.get("explanation", ""),
                "improvement_hint": feedback.get("improvement_hint"),
                "concept_explanation": feedback.get("concept_explanation"),
                "strengths": feedback.get("strengths"),
                "weaknesses": feedback.get("weaknesses"),
                "selected_option": feedback.get("selected_option"),
                "correct_option": feedback.get("correct_option"),
                "available_options": feedback.get("available_options"),
                "model_used": "fallback" if is_fallback else ai_model,
                "confidence_level": feedback.get("confidence_level", "medium"),
                "feedback_type": feedback.get("feedback_type"),
                "used_rag": rag_context is not None and rag_context.get("has_context", False),
                "rag_sources": rag_context.get("sources", []) if rag_context and rag_context.get("has_context") else None,
                "fallback": is_fallback,
                "error_type": feedback.get("_error_type"),
                "error_message": feedback.get("_error_message"),
            }

            # If this is fallback, mark the model accordingly so upgrades are triggered
            if is_fallback:
                ai_model = "fallback"

            update_feedback_status(db, student_answer.id, 'generating', 90)

            # ========== STEP 6: Save completed feedback to database ==========
            try:
                logger.info(f"💾 Saving completed feedback for answer_id: {student_answer.id}")
                logger.info(f"💾 Feedback data: is_correct={feedback.get('is_correct')}, score={feedback.get('correctness_score')}")

                db_feedback = complete_feedback_generation(
                    db=db,
                    answer_id=student_answer.id,
                    feedback_data=feedback_data,
                    is_correct=feedback.get("is_correct"),
                    score=feedback.get("correctness_score"),
                    points_earned=feedback.get("points_earned"),
                    points_possible=feedback.get("points_possible"),
                    criterion_scores=feedback.get("criterion_scores"),
                    confidence_level=feedback.get("confidence_level"),
                    ai_model=ai_model
                )
                logger.info(f"✅ Feedback completed successfully with ID: {db_feedback.id}")

            except Exception as db_error:
                logger.error(f"❌ Failed to save feedback to database: {str(db_error)}")
                logger.exception("Full traceback:")
                # Retry the save once after rollback
                try:
                    db.rollback()
                    db_feedback = complete_feedback_generation(
                        db=db,
                        answer_id=student_answer.id,
                        feedback_data=feedback_data,
                        is_correct=feedback.get("is_correct"),
                        score=feedback.get("correctness_score"),
                        points_earned=feedback.get("points_earned"),
                        points_possible=feedback.get("points_possible"),
                        criterion_scores=feedback.get("criterion_scores"),
                        confidence_level=feedback.get("confidence_level"),
                        ai_model=ai_model
                    )
                    logger.info(f"✅ Feedback saved on retry after rollback")
                except Exception:
                    logger.error("❌ DB save failed even after retry — returning feedback without persisting")

            # Return complete feedback for API response
            return {
                **feedback,
                "feedback_id": str(student_answer.id),
                "question_id": question_id,
                "attempt_number": student_answer.attempt,
                "generated_at": student_answer.submitted_at.isoformat(),
                "model_used": ai_model
            }

        except Exception as e:
            logger.error(f"❌ Error generating feedback: {str(e)}")
            logger.exception("Full traceback:")

            # NEVER fail — always give the student fallback feedback
            fallback = self._build_universal_fallback(student_answer, question_id, module_id, db)
            try:
                fallback_data = {
                    "explanation": fallback.get("explanation", ""),
                    "improvement_hint": fallback.get("improvement_hint"),
                    "concept_explanation": fallback.get("concept_explanation"),
                    "confidence_level": "low",
                    "feedback_type": fallback.get("feedback_type", "fallback"),
                    "fallback": True
                }
                complete_feedback_generation(
                    db=db,
                    answer_id=student_answer.id,
                    feedback_data=fallback_data,
                    is_correct=fallback.get("is_correct"),
                    score=fallback.get("correctness_score"),
                    points_earned=fallback.get("points_earned"),
                    points_possible=fallback.get("points_possible"),
                    criterion_scores={},
                    confidence_level="low",
                    ai_model="fallback"
                )
                logger.info(f"🛟 Saved fallback feedback for answer {student_answer.id}")
            except Exception:
                logger.error("❌ Even fallback save failed — returning in-memory fallback")

            return fallback
    
    def _get_ai_model_from_module(self, module: Optional[Module]) -> str:
        """Extract AI model from module configuration or use default"""
        if not module or not module.assignment_config:
            return self.default_model

        chatbot_config = module.assignment_config.get("features", {}).get("chatbot_feedback", {})
        return chatbot_config.get("ai_model", self.default_model)

    def _get_ai_model_from_rubric(self, rubric: Dict[str, Any]) -> str:
        """Extract AI model from rubric configuration or use default"""
        # For now, we use the default model
        # In future, could support model selection per rubric
        return self.default_model
    
    def _extract_answer_text(self, answer_data: Dict[str, Any]) -> str:
        """Extract text from answer JSON structure"""
        if isinstance(answer_data, str):
            return answer_data

        # Handle JSONB format: {selected_option_id: "A"} (new) or {selected_option: "A"} (old) or {text_response: "..."}
        # For MCQ, we always use the option ID (the letter) for comparison
        if "selected_option_id" in answer_data:
            return answer_data["selected_option_id"]
        elif "selected_option" in answer_data:
            return answer_data["selected_option"]
        elif "text_response" in answer_data:
            return answer_data["text_response"]

        return str(answer_data)
    
    def _analyze_mcq_answer(
        self,
        student_answer: str,
        question: Question,
        ai_model: str,
        rubric: Dict[str, Any],
        rag_context: Optional[Dict[str, Any]] = None,
        previous_feedback: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """Analyze multiple choice question answer with rubric and RAG support"""

        # Get correct answer - check both fields (new correct_option_id and legacy correct_answer)
        correct_answer = question.correct_option_id or question.correct_answer
        options = question.options or {}

        # Handle missing correct answer - still provide feedback, just without correctness evaluation
        has_correct_answer = bool(correct_answer)
        if not has_correct_answer:
            logger.warning(f"⚠️  Question {question.id} has no correct answer set - will provide general feedback only")
            is_correct = None  # Unknown correctness
        else:
            # Check if answer is correct
            # Handle both cases: student_answer could be the option letter (e.g., "A")
            # or the option text (e.g., "one") due to legacy data
            is_correct = False
            if student_answer and student_answer.upper() == correct_answer.upper():
                # Direct match with option letter
                is_correct = True
            elif options and student_answer:
                # Check if student_answer matches the text of the correct option
                correct_option_text = options.get(correct_answer, "").strip().lower()
                if student_answer.strip().lower() == correct_option_text:
                    is_correct = True
                # Also check if the correct_answer matches any option key that has this text
                for key, value in options.items():
                    if (student_answer.upper() == key.upper() and
                        correct_answer.upper() == key.upper()):
                        is_correct = True
                        break

        # Build dynamic prompt using rubric and RAG context
        prompt = build_mcq_feedback_prompt(
            question_text=question.text,
            options=options,
            student_answer=student_answer,
            correct_answer=correct_answer,
            is_correct=is_correct,
            rubric=rubric,
            rag_context=rag_context,
            previous_feedback=previous_feedback
        )

        # 🎯 LOG: OpenAI API call details
        logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        logger.info("🎯 OPENAI API CALL - MCQ FEEDBACK")
        logger.info(f"📤 Model: {ai_model}")
        logger.info(f"📤 Temperature: 0.3")
        logger.info(f"📤 Max Tokens: 800")
        logger.info(f"📤 Question ID: {question.id}")
        logger.info(f"📤 Student Answer: {student_answer}")
        logger.info(f"📤 Correct Answer: {correct_answer}")
        logger.info(f"📤 Is Correct: {is_correct}")
        logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        logger.info("📤 FULL PROMPT SENT TO OPENAI:")
        logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        logger.info(prompt)
        logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

        try:
            # Use the new retry-enabled client
            response = self.client.create_chat_completion(
                messages=[{"role": "user", "content": prompt}],
                model=ai_model,
                temperature=0.3,
                max_tokens=800  # Increased for RAG-enhanced feedback
            )

            # Parse JSON response
            feedback_text = response.choices[0].message.content.strip()

            # 🎯 LOG: OpenAI response
            logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            logger.info("✅ OPENAI RESPONSE RECEIVED")
            logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            logger.info("📥 Raw Response:")
            logger.info(feedback_text)
            logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

            # Handle markdown code blocks if present
            if feedback_text.startswith("```"):
                feedback_text = feedback_text.split("```")[1]
                if feedback_text.startswith("json"):
                    feedback_text = feedback_text[4:]
                feedback_text = feedback_text.strip()

            feedback = json.loads(feedback_text)

            # For MCQ, score is binary: correct=100% or incorrect=0%
            # Don't use rubric-based criterion scores for MCQ
            if is_correct is None:
                # No correct answer set
                correctness_score = None
                points_earned = 0
            else:
                correctness_score = 100 if is_correct else 0
                points_earned = (correctness_score / 100.0) * question.points

            confidence = feedback.get('confidence', 'medium')

            # Add MCQ-specific metadata
            feedback.update({
                "feedback_type": "mcq",
                "selected_option": student_answer,
                "correct_option": correct_answer,
                "available_options": options,
                # Points tracking (no rubric for MCQ)
                "points_earned": round(points_earned, 2) if points_earned else None,
                "points_possible": question.points,
                "criterion_scores": {},  # MCQ uses binary grading, not rubric
                "confidence_level": confidence,
                "correctness_score": correctness_score
            })

            # 🎯 LOG: Parsed feedback
            logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            logger.info("💾 PARSED FEEDBACK DATA:")
            logger.info(f"   ✓ is_correct: {feedback.get('is_correct')}")
            logger.info(f"   ✓ correctness_score: {correctness_score}%")
            logger.info(f"   ✓ points_earned: {(points_earned or 0):.2f} / {question.points}")
            logger.info(f"   ✓ confidence: {confidence}")
            logger.info(f"   ✓ explanation: {feedback.get('explanation', '')[:100]}...")
            logger.info(f"   ✓ improvement_hint: {feedback.get('improvement_hint', '')[:100]}...")
            logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

            return feedback

        except json.JSONDecodeError as je:
            logger.error(f"JSON decode error: {str(je)}, Response: {feedback_text}")
            fb = self._fallback_mcq_feedback(student_answer, correct_answer, options, is_correct, question.points, question.text)
            fb["_error_type"] = "JSONDecodeError"
            fb["_error_message"] = str(je)[:200]
            return fb
        except openai.AuthenticationError as e:
            logger.error(f"OpenAI authentication error: {str(e)}")
            fb = self._fallback_mcq_feedback(student_answer, correct_answer, options, is_correct, question.points, question.text)
            fb["_error_type"] = "AuthenticationError"
            fb["_error_message"] = str(e)[:200]
            return fb
        except openai.APITimeoutError as e:
            logger.error(f"OpenAI timeout after retries: {str(e)}")
            fb = self._fallback_mcq_feedback(student_answer, correct_answer, options, is_correct, question.points, question.text)
            fb["_error_type"] = "APITimeoutError"
            fb["_error_message"] = str(e)[:200]
            return fb
        except openai.RateLimitError as e:
            logger.error(f"OpenAI rate limit exceeded: {str(e)}")
            fb = self._fallback_mcq_feedback(student_answer, correct_answer, options, is_correct, question.points, question.text)
            fb["_error_type"] = "RateLimitError"
            fb["_error_message"] = str(e)[:200]
            return fb
        except Exception as e:
            logger.error(f"OpenAI API error: {str(e)}")
            fb = self._fallback_mcq_feedback(student_answer, correct_answer, options, is_correct, question.points, question.text)
            fb["_error_type"] = type(e).__name__
            fb["_error_message"] = str(e)[:200]
            return fb
    
    def _analyze_text_answer(
        self,
        student_answer: str,
        question: Question,
        ai_model: str,
        rubric: Dict[str, Any],
        rag_context: Optional[Dict[str, Any]] = None,
        previous_feedback: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """Analyze text-based (short/essay) question answer with rubric and RAG support"""

        correct_answer = question.correct_answer or "No reference answer provided"
        question_type = question.type

        # Check if we have a reference answer to compare against
        has_reference = question.correct_answer and question.correct_answer.strip()
        if not has_reference:
            logger.warning(f"⚠️  Question {question.id} has no reference answer set - will provide general feedback only")

        # Build dynamic prompt using rubric and RAG context
        prompt = build_text_feedback_prompt(
            question_text=question.text,
            question_type=question_type,
            student_answer=student_answer,
            reference_answer=correct_answer,
            rubric=rubric,
            rag_context=rag_context,
            previous_feedback=previous_feedback
        )

        # 🎯 LOG: OpenAI API call details
        logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        logger.info(f"🎯 OPENAI API CALL - {question_type.upper()} FEEDBACK")
        logger.info(f"📤 Model: {ai_model}")
        logger.info(f"📤 Temperature: 0.3")
        logger.info(f"📤 Max Tokens: 1200")
        logger.info(f"📤 Question ID: {question.id}")
        logger.info(f"📤 Student Answer Length: {len(student_answer)} chars")
        logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        logger.info("📤 FULL PROMPT SENT TO OPENAI:")
        logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        logger.info(prompt)
        logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

        try:
            # Use the new retry-enabled client
            response = self.client.create_chat_completion(
                messages=[{"role": "user", "content": prompt}],
                model=ai_model,
                temperature=0.3,
                max_tokens=1200  # Increased for detailed RAG-enhanced feedback
            )

            # Parse JSON response
            feedback_text = response.choices[0].message.content.strip()

            # 🎯 LOG: OpenAI response
            logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            logger.info("✅ OPENAI RESPONSE RECEIVED")
            logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            logger.info("📥 Raw Response:")
            logger.info(feedback_text)
            logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

            # Handle markdown code blocks if present
            if feedback_text.startswith("```"):
                feedback_text = feedback_text.split("```")[1]
                if feedback_text.startswith("json"):
                    feedback_text = feedback_text[4:]
                feedback_text = feedback_text.strip()

            feedback = json.loads(feedback_text)

            # ⭐ NEW: Extract criterion scores and calculate points
            criterion_scores = feedback.get('criterion_scores', {})
            total_percentage = feedback.get('total_percentage')
            confidence = feedback.get('confidence', 'medium')

            # Calculate points from percentage
            if total_percentage is not None:
                points_earned = (total_percentage / 100.0) * question.points
            else:
                # Fallback to old correctness_score if total_percentage not provided
                correctness_score = feedback.get('correctness_score', 0)
                points_earned = (correctness_score / 100.0) * question.points if correctness_score is not None else 0
                total_percentage = correctness_score

            # Add text-specific metadata + points tracking
            feedback.update({
                "feedback_type": question.type,
                "answer_length": len(student_answer),
                "reference_answer": correct_answer,
                # Points and rubric tracking
                "points_earned": round(points_earned, 2),
                "points_possible": question.points,
                "criterion_scores": criterion_scores,
                "confidence_level": confidence,
                "correctness_score": int(total_percentage) if total_percentage is not None else None
            })

            # 🎯 LOG: Parsed feedback
            logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            logger.info("💾 PARSED FEEDBACK DATA:")
            logger.info(f"   ✓ is_correct: {feedback.get('is_correct')}")
            logger.info(f"   ✓ total_percentage: {total_percentage}%")
            logger.info(f"   ✓ points_earned: {points_earned:.2f} / {question.points}")
            logger.info(f"   ✓ confidence: {confidence}")
            logger.info(f"   ✓ criterion_scores: {len(criterion_scores)} criteria")
            logger.info(f"   ✓ strengths: {len(feedback.get('strengths', []))} items")
            logger.info(f"   ✓ weaknesses: {len(feedback.get('weaknesses', []))} items")
            logger.info(f"   ✓ explanation: {feedback.get('explanation', '')[:100]}...")
            logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

            return feedback

        except json.JSONDecodeError as je:
            logger.error(f"JSON decode error: {str(je)}, Response: {feedback_text}")
            fb = self._fallback_text_feedback(student_answer, correct_answer, question.type, question.points, question.text)
            fb["_error_type"] = "JSONDecodeError"
            fb["_error_message"] = str(je)[:200]
            return fb
        except openai.AuthenticationError as e:
            logger.error(f"OpenAI authentication error: {str(e)}")
            fb = self._fallback_text_feedback(student_answer, correct_answer, question.type, question.points, question.text)
            fb["_error_type"] = "AuthenticationError"
            fb["_error_message"] = str(e)[:200]
            return fb
        except openai.APITimeoutError as e:
            logger.error(f"OpenAI timeout after retries: {str(e)}")
            fb = self._fallback_text_feedback(student_answer, correct_answer, question.type, question.points, question.text)
            fb["_error_type"] = "APITimeoutError"
            fb["_error_message"] = str(e)[:200]
            return fb
        except openai.RateLimitError as e:
            logger.error(f"OpenAI rate limit exceeded: {str(e)}")
            fb = self._fallback_text_feedback(student_answer, correct_answer, question.type, question.points, question.text)
            fb["_error_type"] = "RateLimitError"
            fb["_error_message"] = str(e)[:200]
            return fb
        except Exception as e:
            logger.error(f"OpenAI API error: {str(e)}")
            fb = self._fallback_text_feedback(student_answer, correct_answer, question.type, question.points, question.text)
            fb["_error_type"] = type(e).__name__
            fb["_error_message"] = str(e)[:200]
            return fb
    
    def _format_options(self, options: Dict[str, str]) -> str:
        """Format MCQ options for prompt"""
        formatted = []
        for key, value in options.items():
            formatted.append(f"{key}. {value}")
        return "\n".join(formatted)
    
    def _fallback_mcq_feedback(
        self,
        student_answer: str,
        correct_answer: str,
        options: Dict[str, str],
        is_correct: bool,
        question_points: float = 1.0,
        question_text: str = ""
    ) -> Dict[str, Any]:
        """Fallback feedback when AI fails — NEVER reveals the correct answer."""
        correctness_score = 100 if is_correct else 0
        points_earned = (correctness_score / 100.0) * question_points

        # Build question-aware feedback instead of generic boilerplate
        selected_text = options.get(student_answer, student_answer) if options else student_answer

        if is_correct:
            explanation = f"Your answer '{selected_text}' is correct. You demonstrated a solid understanding of this topic."
            hint = "Great work! Keep building on this knowledge."
            concept = f"This question tests your understanding of a key concept. Your correct answer shows you grasp the material well."
        else:
            explanation = (
                f"Your selection '{selected_text}' is not the best answer for this question. "
                f"Think carefully about what the question is really asking and revisit the relevant topic in your course materials."
            )
            hint = (
                f"Re-read the question: \"{question_text[:120]}{'...' if len(question_text) > 120 else ''}\" "
                f"Consider what each option means in context and which one most directly addresses the question."
            ) if question_text else (
                "Re-read the question carefully and consider all options. "
                "Think about the underlying concept being tested."
            )
            concept = (
                f"This question is about: \"{question_text[:150]}{'...' if len(question_text) > 150 else ''}\" "
                f"Review the section in your course materials that covers this topic."
            ) if question_text else (
                "Review the related section in your course materials to understand the concept this question covers."
            )

        return {
            "is_correct": is_correct,
            "correctness_score": correctness_score,
            "points_earned": round(points_earned, 2),
            "points_possible": question_points,
            "criterion_scores": {},
            "confidence_level": "low",
            "feedback_type": "mcq",
            "explanation": explanation,
            "improvement_hint": hint,
            "concept_explanation": concept,
            "selected_option": student_answer,
            "correct_option": correct_answer,
            "available_options": options,
            "fallback": True
        }
    
    def _fallback_text_feedback(
        self,
        student_answer: str,
        correct_answer: str,
        question_type: str,
        question_points: float = 1.0,
        question_text: str = ""
    ) -> Dict[str, Any]:
        """Fallback feedback for text answers when AI fails"""
        # Neutral score when AI unavailable
        correctness_score = 50
        points_earned = (correctness_score / 100.0) * question_points

        if question_text:
            explanation = (
                f"Your answer has been submitted for the question: "
                f"\"{question_text[:120]}{'...' if len(question_text) > 120 else ''}\" "
                f"Detailed AI analysis is temporarily unavailable, but your teacher will review your response."
            )
            hint = (
                f"Review the course materials related to this topic and compare your answer "
                f"with what the materials explain about the concepts covered in this question."
            )
            concept = (
                f"This question covers: \"{question_text[:150]}{'...' if len(question_text) > 150 else ''}\" "
                f"Look for this topic in your course materials for a deeper understanding."
            )
        else:
            explanation = "Your answer has been submitted. Detailed AI analysis is temporarily unavailable."
            hint = "Review the course materials related to this topic."
            concept = "Please refer to course materials for concept review."

        return {
            "is_correct": len(student_answer.strip()) > 0,
            "correctness_score": correctness_score,
            "points_earned": round(points_earned, 2),
            "points_possible": question_points,
            "criterion_scores": {},
            "confidence_level": "low",
            "feedback_type": question_type,
            "explanation": explanation,
            "strengths": ["Answer provided"],
            "weaknesses": ["Detailed analysis unavailable"],
            "improvement_hint": hint,
            "concept_explanation": concept,
            "missing_concepts": [],
            "reference_answer": correct_answer,
            "fallback": True
        }
    
    def _error_response(self, message: str) -> Dict[str, Any]:
        """Generate error response"""
        return {
            "error": True,
            "message": message,
            "is_correct": False,
            "correctness_score": 0,
            "feedback_type": "error",
            "explanation": "Feedback could not be generated due to an error.",
            "improvement_hint": "Please try again or contact support.",
            "confidence_level": "low"
        }

    def _build_universal_fallback(self, student_answer, question_id, module_id, db) -> Dict[str, Any]:
        """
        Build fallback feedback that ALWAYS succeeds, regardless of what went wrong.
        This ensures the student never sees a failed state.
        Includes question text for context-aware fallback messages.
        """
        try:
            question = get_question_by_id(db, question_id)
        except Exception:
            question = None

        q_type = question.type if question else "unknown"
        q_points = question.points if question else 1.0
        q_text = question.text if question else ""

        if q_type == 'mcq':
            correct_answer = (question.correct_option_id or question.correct_answer) if question else None
            options = question.options or {} if question else {}
            answer_text = self._extract_answer_text(student_answer.answer) if student_answer else ""
            is_correct = None
            if correct_answer and answer_text:
                is_correct = answer_text.upper() == correct_answer.upper()
            score = 100 if is_correct else (0 if is_correct is not None else None)
            points_earned = (score / 100.0) * q_points if score is not None else 0

            selected_text = options.get(answer_text, answer_text) if options else answer_text

            if is_correct:
                explanation = f"Your answer '{selected_text}' is correct. Good understanding of this topic."
            elif is_correct is not None:
                explanation = (
                    f"Your selection '{selected_text}' is not the best answer. "
                    f"Think about what the question is really asking and review the relevant topic."
                )
            else:
                explanation = "Your answer has been recorded."

            return {
                "is_correct": is_correct,
                "correctness_score": score,
                "points_earned": round(points_earned, 2),
                "points_possible": q_points,
                "criterion_scores": {},
                "confidence_level": "low",
                "feedback_type": "mcq",
                "explanation": explanation,
                "improvement_hint": (
                    f"Re-read: \"{q_text[:120]}{'...' if len(q_text) > 120 else ''}\" "
                    f"and consider what each option means in context."
                ) if q_text else "Review the question and related course materials.",
                "concept_explanation": (
                    f"This question covers: \"{q_text[:150]}{'...' if len(q_text) > 150 else ''}\" "
                    f"Find this topic in your course materials."
                ) if q_text else "Review your course materials for this topic.",
                "fallback": True
            }
        else:
            # Generic fallback for text, fill_blank, mcq_multiple, multi_part, or unknown
            return {
                "is_correct": None,
                "correctness_score": 50,
                "points_earned": round(0.5 * q_points, 2),
                "points_possible": q_points,
                "criterion_scores": {},
                "confidence_level": "low",
                "feedback_type": q_type,
                "explanation": (
                    f"Your answer has been submitted. Detailed AI feedback is temporarily unavailable, "
                    f"but your teacher will review your response."
                ),
                "improvement_hint": (
                    f"Review the course materials related to: "
                    f"\"{q_text[:120]}{'...' if len(q_text) > 120 else ''}\""
                ) if q_text else "Review the course materials related to this question.",
                "concept_explanation": (
                    f"This question covers: \"{q_text[:150]}{'...' if len(q_text) > 150 else ''}\" "
                    f"Look for this topic in your course materials."
                ) if q_text else "Refer to your course materials for this topic.",
                "strengths": ["Answer submitted"],
                "weaknesses": [],
                "fallback": True
            }

    def _analyze_fill_blank_answer(
        self,
        student_answer: Dict[str, Any],
        question: Question,
        ai_model: str,
        rubric: Dict[str, Any],
        rag_context: Optional[Dict[str, Any]] = None,
        previous_feedback: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """Analyze fill-in-the-blank question answer with AI semantic matching"""
        from app.services.question_grading import QuestionGradingService

        # Get extended config with blank configurations
        extended_config = question.extended_config or {}
        blank_configs = extended_config.get('blanks', [])

        if not blank_configs:
            logger.error(f"Fill-blank question {question.id} has no blank configurations")
            return {
                "is_correct": None, "correctness_score": 50,
                "points_earned": round(0.5 * question.points, 2), "points_possible": question.points,
                "criterion_scores": {}, "confidence_level": "low", "feedback_type": "fill_blank",
                "explanation": "Your answer has been recorded. Detailed feedback is temporarily unavailable, but your teacher will review your response.",
                "improvement_hint": "Review the course materials related to this question.",
                "concept_explanation": "Please refer to your course materials.", "fallback": True
            }

        # Extract student answers from answer data
        # Format: {"blanks": {0: "answer1", 1: "answer2", ...}}
        student_blanks = student_answer.get('blanks', {})

        # Convert string keys to int if needed
        student_blanks_int = {}
        for key, value in student_blanks.items():
            student_blanks_int[int(key)] = value

        # Grade using the grading service
        grading_service = QuestionGradingService()
        grading_result = grading_service.grade_fill_blank(
            student_answers=student_blanks_int,
            blank_configs=blank_configs,
            use_ai_semantic_matching=True
        )

        # Generate AI feedback based on grading result
        # Format for AI's internal use (includes accepted answers)
        blank_results_internal = "\n".join([
            f"Blank {r['position']}: '{r['student_answer']}' - {'✓ Correct' if r['is_correct'] else '✗ Incorrect'} " +
            f"[INTERNAL - Accepted: {', '.join(r['accepted_answers'])}]" +
            (f" [AI semantic match]" if r.get('semantic_match') else "")
            for r in grading_result['blank_results']
        ])

        # Count statistics for student-facing feedback
        num_correct = sum(1 for r in grading_result['blank_results'] if r['is_correct'])
        num_incorrect = len(grading_result['blank_results']) - num_correct

        # Build previous feedback section if available
        previous_feedback_section = ""
        if previous_feedback:
            previous_feedback_section = "\n" + _build_previous_feedback_section(previous_feedback) + "\n"

        # Build RAG context section if available
        rag_section = ""
        if rag_context and rag_context.get("has_context"):
            rag_section = "\n" + rag_context["formatted_context"] + "\n"

        prompt = f"""You are an educational AI providing feedback on a fill-in-the-blank answer.

Question: {question.text}

Grading Results (INTERNAL - For AI analysis only):
{blank_results_internal}

Score: {grading_result['earned_points']}/{grading_result['total_points']} ({grading_result['percentage']:.1f}%)
Correct blanks: {num_correct}, Incorrect blanks: {num_incorrect}
{rag_section}{previous_feedback_section}
⚠️ CRITICAL INSTRUCTION: NEVER reveal the accepted/correct answers for any blank in your feedback. DO NOT tell the student what the correct answer should be. Instead:

1. **Analyze the question content**: Understand what topic/concept this question is testing
2. **Provide contextual feedback**: Give feedback specific to THIS question's subject matter and context
3. **Explain relevant concepts**: Help the student understand the principles, terminology, or knowledge needed for THIS specific question
4. **Give meaningful hints**: Provide guidance about grammar, meaning, technical terms, or context clues that are relevant to THIS particular sentence/paragraph
5. **Be detailed and specific**: Don't give generic advice - make it relevant to the actual content and topic of the question

Your goal is to help students LEARN and DISCOVER the correct answers through understanding the concepts and context, not to give generic advice or reveal answers.

IMPORTANT: Your feedback should clearly show that you understand what this question is about and what topic it covers. Reference the specific subject matter.

Provide constructive, DETAILED, and CONTEXTUAL feedback in JSON format:
{{
    "explanation": "Detailed analysis of their performance. Start by explaining how many blanks they filled correctly (e.g., 'You correctly filled X out of Y blanks'). Then provide insight into what this question is testing - what topic or concept is it about? Why is this knowledge important? Be specific to THIS question's content and subject matter.",

    "improvement_hint": "Specific, contextual guidance related to THIS question's topic. {("If course material sources are provided above, ALWAYS include an EXACT document reference like 'Review [Document Name], Page X' or 'See the section on [topic] in [Document]'. " if rag_context and rag_context.get('has_context') else "")}Don't just say 'review the context' - instead, help them understand what type of knowledge or concepts they need for these specific blanks.",

    "concept_explanation": "Explain the key concept, topic, or knowledge domain that THIS specific question is testing. What should students understand about [this topic] to fill in these blanks correctly? Be specific to the question content - what subject area is this? What principles or terminology are relevant?"
}}

Example of GOOD feedback (detailed and contextual):
- "This question tests your knowledge of the water cycle. The blanks require you to identify the key processes and stages. Think about what happens to water as it moves from oceans to clouds to precipitation..."

Example of BAD feedback (too generic - AVOID THIS):
- "Read the sentence carefully and think about what words fit grammatically."

Make your feedback detailed, contextual, and helpful!"""

        try:
            response = self.client.create_chat_completion(
                messages=[{"role": "user", "content": prompt}],
                model=ai_model,
                temperature=0.4,
                max_tokens=600
            )

            # Parse JSON response
            feedback_text = response.choices[0].message.content.strip()

            # Handle markdown code blocks if present
            if feedback_text.startswith("```"):
                feedback_text = feedback_text.split("```")[1]
                if feedback_text.startswith("json"):
                    feedback_text = feedback_text[4:]
                feedback_text = feedback_text.strip()

            feedback_json = json.loads(feedback_text)

            # Calculate points from percentage score
            percentage_score = grading_result['percentage']
            points_earned = (percentage_score / 100.0) * question.points

            return {
                "is_correct": grading_result['is_correct'],
                "correctness_score": int(percentage_score),
                "points_earned": round(points_earned, 2),
                "points_possible": question.points,
                "criterion_scores": {},  # Fill-blank uses algorithmic grading, not criterion-based
                "confidence_level": "high" if grading_result['is_correct'] else "medium",
                "explanation": feedback_json.get("explanation", ""),
                "improvement_hint": feedback_json.get("improvement_hint"),
                "concept_explanation": feedback_json.get("concept_explanation"),
                "grading_details": grading_result,
                "feedback_type": "fill_blank"
            }

        except Exception as e:
            logger.error(f"AI feedback generation failed for fill-blank: {str(e)}")
            _fill_blank_error_type = type(e).__name__
            _fill_blank_error_message = str(e)[:200]
            # Return grading results without AI-generated text and WITHOUT revealing correct answers

            # Build detailed explanation from blank results WITHOUT revealing which blanks are wrong
            blank_results = grading_result.get('blank_results', [])
            num_correct = sum(1 for r in blank_results if r['is_correct'])
            num_incorrect = len(blank_results) - num_correct
            total_blanks = len(blank_results)

            # Create explanation without revealing specific blank positions that are wrong
            if grading_result['is_correct']:
                explanation = f"Excellent! You filled in all {total_blanks} blank(s) correctly."
            else:
                explanation = f"You correctly filled {num_correct} out of {total_blanks} blank(s)."
                if num_incorrect > 0:
                    explanation += f" {num_incorrect} blank(s) need(s) revision."

            # Create improvement hint if not perfect score
            improvement_hint = None
            if not grading_result['is_correct']:
                improvement_hint = "Review the context around each blank carefully. Consider the grammar, meaning, and technical accuracy required for each answer. Think about what makes sense in the overall context of the sentence or paragraph."

            # Calculate points from percentage score
            percentage_score = grading_result['percentage']
            points_earned = (percentage_score / 100.0) * question.points

            return {
                "is_correct": grading_result['is_correct'],
                "correctness_score": int(percentage_score),
                "points_earned": round(points_earned, 2),
                "points_possible": question.points,
                "criterion_scores": {},  # Fill-blank uses algorithmic grading, not criterion-based
                "confidence_level": "low",  # Fallback has low confidence
                "explanation": explanation,
                "improvement_hint": improvement_hint,
                "concept_explanation": "Fill-in-the-blank questions test your understanding of specific terms and concepts. Read the entire sentence or paragraph carefully, paying attention to clues in the surrounding text. Make sure your answers are grammatically correct and contextually appropriate.",
                "grading_details": grading_result,
                "feedback_type": "fill_blank",
                "fallback": True,
                "_error_type": _fill_blank_error_type,
                "_error_message": _fill_blank_error_message,
            }

    def _analyze_mcq_multiple_answer(
        self,
        student_answer: Dict[str, Any],
        question: Question,
        ai_model: str,
        rubric: Dict[str, Any],
        rag_context: Optional[Dict[str, Any]] = None,
        previous_feedback: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """Analyze multiple-correct MCQ answer"""
        from app.services.question_grading import QuestionGradingService

        # Get extended config
        extended_config = question.extended_config or {}
        correct_option_ids = extended_config.get('correct_option_ids', [])

        # Get grading settings from rubric first, then fall back to question config
        question_type_settings = rubric.get('question_type_settings', {}).get('mcq_multiple', {})
        # Always use partial credit for multiple answer MCQ (allows getting some points)
        partial_credit = True
        # Teacher controls whether wrong answers are penalized
        penalty_for_wrong = question_type_settings.get('penalty_for_wrong', extended_config.get('penalty_for_wrong', True))

        if not correct_option_ids:
            logger.error(f"MCQ-multiple question {question.id} has no correct options configured")
            return {
                "is_correct": None, "correctness_score": 50,
                "points_earned": round(0.5 * question.points, 2), "points_possible": question.points,
                "criterion_scores": {}, "confidence_level": "low", "feedback_type": "mcq_multiple",
                "explanation": "Your answer has been recorded. Detailed feedback is temporarily unavailable, but your teacher will review your response.",
                "improvement_hint": "Review the course materials related to this question.",
                "concept_explanation": "Please refer to your course materials.", "fallback": True
            }

        # Extract selected options from answer data
        # Format: {"selected_options": ["A", "B", "C"]}
        selected_options = student_answer.get('selected_options', [])
        options = question.options or {}

        # Grade using the grading service
        grading_service = QuestionGradingService()
        grading_result = grading_service.grade_mcq_multiple(
            selected_options=selected_options,
            correct_option_ids=correct_option_ids,
            total_options=len(options),
            partial_credit=partial_credit,
            penalty_for_wrong=penalty_for_wrong
        )

        # Build feedback prompt (no rubric for MCQ - just correctness)
        selected_text = ", ".join([f"{opt}: {options.get(opt, '')}" for opt in selected_options])
        correct_text = ", ".join([f"{opt}: {options.get(opt, '')}" for opt in correct_option_ids])

        # Build previous feedback section if available
        previous_feedback_section = ""
        if previous_feedback:
            previous_feedback_section = "\n" + _build_previous_feedback_section(previous_feedback) + "\n"

        # Build RAG context section if available
        rag_section = ""
        if rag_context and rag_context.get("has_context"):
            rag_section = "\n" + rag_context["formatted_context"] + "\n"

        prompt = f"""You are an educational AI providing feedback on a multiple-choice question with multiple correct answers.

Question: {question.text}

Options:
{chr(10).join([f"{k}: {v}" for k, v in options.items()])}

Student selected: {selected_text}

[INTERNAL - For AI only] Correct answers: {correct_text}

Grading:
- Correctly selected: {', '.join(grading_result['correctly_selected']) or 'None'}
- Incorrectly selected: {', '.join(grading_result['incorrectly_selected']) or 'None'}
- Missed correct options: {', '.join(grading_result['missed_correct']) or 'None'}
- Score: {grading_result['score']:.1f}%
{rag_section}{previous_feedback_section}
⚠️ CRITICAL INSTRUCTION: NEVER reveal which specific options are correct in your feedback. DO NOT mention option letters/IDs (A, B, C, etc.) as being correct or incorrect. Instead:

1. **Analyze the question content**: Understand what topic/concept this question is testing
2. **Provide contextual feedback**: Give feedback specific to THIS question's subject matter
3. **Explain the concepts**: Help the student understand the underlying principles related to this specific topic
4. **Give meaningful hints**: Provide conceptual guidance that helps them reconsider their approach to THIS particular question
5. **Be detailed and helpful**: Don't give generic advice - make it relevant to the actual content of the question and options

Your goal is to help students LEARN and DISCOVER the correct answers through understanding the concepts, not to give generic advice or reveal answers.

IMPORTANT: Your feedback should clearly demonstrate that you understand what this question is about. Avoid generic phrases like "review the course material" without explaining WHAT concepts to focus on.

Provide constructive, DETAILED, and CONTEXTUAL feedback in JSON format:
{{
    "explanation": "Detailed analysis of their performance. Start by acknowledging what they selected and explain the performance (e.g., 'You selected X option(s), and got Y correct'). Then provide insight into what this question is testing and why understanding [specific concept] is important. Be specific to THIS question's content.",

    "improvement_hint": "Specific, contextual guidance related to THIS question's topic. {("If course material sources are provided above, ALWAYS include an EXACT document reference like 'Review [Document Name], Page X' or 'See the section on [topic] in [Document]'. " if rag_context and rag_context.get('has_context') else "")}Don't just say 'review all options' - instead, help them think about the specific concepts they should consider.",

    "concept_explanation": "Explain the key concept or principle that THIS specific question is testing. What should students understand about [this topic] to answer correctly? What's the learning objective? Be specific to the question content, not generic."
}}

Example of GOOD feedback (detailed and contextual):
- "This question tests your understanding of data structures in computer science. To better understand this, review Lab 3, Page 5, the section on arrays vs linked lists..."

Example of BAD feedback (too generic - AVOID THIS):
- "Review all the options carefully. Think about what makes an option correct."

Make your feedback detailed, contextual, and helpful!"""

        try:
            response = self.client.create_chat_completion(
                messages=[{"role": "user", "content": prompt}],
                model=ai_model,
                temperature=0.4,
                max_tokens=700
            )

            # Parse JSON response
            feedback_text = response.choices[0].message.content.strip()

            # Handle markdown code blocks if present
            if feedback_text.startswith("```"):
                feedback_text = feedback_text.split("```")[1]
                if feedback_text.startswith("json"):
                    feedback_text = feedback_text[4:]
                feedback_text = feedback_text.strip()

            feedback_json = json.loads(feedback_text)

            # Use algorithmic grading score (no rubric for MCQ)
            percentage_score = grading_result['score']
            points_earned = (percentage_score / 100.0) * question.points

            return {
                "is_correct": grading_result['is_correct'],
                "correctness_score": int(percentage_score),
                "points_earned": round(points_earned, 2),
                "points_possible": question.points,
                "criterion_scores": {},  # MCQ uses algorithmic grading, not rubric
                "confidence_level": "high" if grading_result['is_correct'] else "medium",
                "explanation": feedback_json.get("explanation", ""),
                "improvement_hint": feedback_json.get("improvement_hint"),
                "concept_explanation": feedback_json.get("concept_explanation"),
                "grading_details": grading_result,
                "selected_options": selected_options,
                "correct_options": correct_option_ids,
                "available_options": options,
                "feedback_type": "mcq_multiple"
            }

        except Exception as e:
            logger.error(f"AI feedback generation failed for mcq-multiple: {str(e)}")
            _mcq_mult_error_type = type(e).__name__
            _mcq_mult_error_message = str(e)[:200]

            # Build comprehensive fallback feedback WITHOUT revealing correct answers
            correctly_selected = grading_result.get('correctly_selected', [])
            incorrectly_selected = grading_result.get('incorrectly_selected', [])
            missed_correct = grading_result.get('missed_correct', [])

            num_correct = len(correctly_selected)
            num_incorrect = len(incorrectly_selected)
            num_missed = len(missed_correct)
            total_correct_options = len(correct_option_ids)

            # Create explanation without revealing which options are correct
            if grading_result['is_correct']:
                explanation = "Great job! You selected all the correct answers for this question."
            else:
                explanation_parts = []

                if num_correct > 0:
                    explanation_parts.append(f"You got {num_correct} correct selection(s).")

                if num_incorrect > 0:
                    explanation_parts.append(f"However, {num_incorrect} of your selection(s) may not be correct.")

                if num_missed > 0:
                    explanation_parts.append(f"You may have missed {num_missed} correct option(s).")

                explanation = " ".join(explanation_parts) if explanation_parts else "Your answer is partially correct."

            # Create improvement hint without revealing answers
            improvement_hint = None
            if not grading_result['is_correct']:
                hints = []

                if num_missed > 0:
                    hints.append("carefully review all the options again - there may be more correct answers than you selected")

                if num_incorrect > 0:
                    hints.append("reconsider some of your selections - not all of them may be accurate")

                if hints:
                    improvement_hint = f"Take time to {' and '.join(hints)}. Think critically about what the question is asking and consider the underlying concepts."

            # Calculate points from percentage score
            percentage_score = grading_result['score']
            points_earned = (percentage_score / 100.0) * question.points

            return {
                "is_correct": grading_result['is_correct'],
                "correctness_score": int(percentage_score),
                "points_earned": round(points_earned, 2),
                "points_possible": question.points,
                "criterion_scores": {},  # Empty for fallback
                "confidence_level": "low",  # Fallback has low confidence
                "explanation": explanation,
                "improvement_hint": improvement_hint,
                "concept_explanation": "This question requires selecting all correct options. Review the course material and think carefully about each option before making your selections. Consider what makes an option correct or incorrect in the context of the question.",
                "grading_details": grading_result,
                "selected_options": selected_options,
                "correct_options": correct_option_ids,
                "available_options": options,
                "feedback_type": "mcq_multiple",
                "fallback": True,
                "_error_type": _mcq_mult_error_type,
                "_error_message": _mcq_mult_error_message,
            }

    def _analyze_multi_part_answer(
        self,
        student_answer: Dict[str, Any],
        question: Question,
        ai_model: str,
        rubric: Dict[str, Any],
        rag_context: Optional[Dict[str, Any]] = None,
        previous_feedback: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """Analyze multi-part question answer"""
        # Get extended config with sub-questions
        extended_config = question.extended_config or {}
        sub_questions = extended_config.get('sub_questions', [])

        if not sub_questions:
            logger.error(f"Multi-part question {question.id} has no sub-questions configured")
            return {
                "is_correct": None, "correctness_score": 50,
                "points_earned": round(0.5 * question.points, 2), "points_possible": question.points,
                "criterion_scores": {}, "confidence_level": "low", "feedback_type": "multi_part",
                "explanation": "Your answer has been recorded. Detailed feedback is temporarily unavailable, but your teacher will review your response.",
                "improvement_hint": "Review the course materials related to this question.",
                "concept_explanation": "Please refer to your course materials.", "fallback": True
            }

        # Extract sub-answers from answer data
        # Format: {"sub_answers": {"1a": "answer", "1b": {"selected_option": "A"}, ...}}
        sub_answers = student_answer.get('sub_answers', {})

        # Grade each sub-question
        sub_results = []
        total_points = 0.0
        earned_points = 0.0

        for sub_q in sub_questions:
            sub_id = sub_q['id']
            sub_type = sub_q['type']
            sub_points = sub_q.get('points', 1.0)
            total_points += sub_points

            student_sub_answer = sub_answers.get(sub_id, "")

            # Grade based on sub-question type
            if sub_type == 'mcq':
                # MCQ sub-question
                selected = student_sub_answer.get('selected_option', '') if isinstance(student_sub_answer, dict) else student_sub_answer
                correct_option = sub_q.get('correct_option_id', '')
                is_correct = selected.upper() == correct_option.upper() if selected and correct_option else False
                sub_earned = sub_points if is_correct else 0.0
            elif sub_type in ['short', 'long']:
                # Text sub-question - use AI to grade against correct answer
                correct_answer = sub_q.get('correct_answer', '')
                student_text = student_sub_answer if isinstance(student_sub_answer, str) else str(student_sub_answer)

                if correct_answer and student_text:
                    # Use AI to grade text answer
                    try:
                        grade_prompt = f"""Compare the student's answer to the correct answer and determine correctness.

Question: {sub_q.get('text', '')}
Correct Answer: {correct_answer}
Student Answer: {student_text}

Respond in JSON format:
{{
    "is_correct": true/false,
    "similarity_score": 0-100,
    "reasoning": "brief explanation"
}}"""

                        response = self.client.create_chat_completion(
                            messages=[{"role": "user", "content": grade_prompt}],
                            model=ai_model,
                            temperature=0.3,
                            max_tokens=300
                        )

                        # Parse JSON response
                        grade_text = response.choices[0].message.content.strip()

                        # Handle markdown code blocks if present
                        if grade_text.startswith("```"):
                            grade_text = grade_text.split("```")[1]
                            if grade_text.startswith("json"):
                                grade_text = grade_text[4:]
                            grade_text = grade_text.strip()

                        grade_result = json.loads(grade_text)
                        is_correct = grade_result.get('is_correct', False)
                        similarity = grade_result.get('similarity_score', 0) / 100

                        # Award partial credit based on similarity
                        if is_correct:
                            sub_earned = sub_points
                        else:
                            sub_earned = sub_points * similarity if similarity > 0.5 else 0.0

                    except Exception as e:
                        logger.error(f"AI grading failed for sub-question {sub_id}: {str(e)}")
                        # Fall back to keyword matching
                        is_correct = correct_answer.lower() in student_text.lower()
                        sub_earned = sub_points if is_correct else 0.0
                else:
                    is_correct = False
                    sub_earned = 0.0
            else:
                is_correct = False
                sub_earned = 0.0

            earned_points += sub_earned

            sub_results.append({
                "sub_id": sub_id,
                "sub_type": sub_type,
                "student_answer": student_sub_answer,
                "is_correct": is_correct,
                "points_possible": sub_points,
                "points_earned": sub_earned
            })

        # Calculate score
        score = (earned_points / total_points * 100) if total_points > 0 else 0

        # Generate overall feedback
        # Internal analysis for AI (includes which sub-questions are wrong)
        sub_results_internal = "\n".join([
            f"[INTERNAL] {r['sub_id']} ({r['sub_type']}): {r['points_earned']}/{r['points_possible']} points - {'✓ Correct' if r['is_correct'] else '✗ Needs work'}"
            for r in sub_results
        ])

        # Count statistics for student-facing feedback
        correct_count = sum(1 for r in sub_results if r['is_correct'])
        total_count = len(sub_results)

        # Build previous feedback section if available
        previous_feedback_section = ""
        if previous_feedback:
            previous_feedback_section = "\n" + _build_previous_feedback_section(previous_feedback) + "\n"

        # Build RAG context section if available
        rag_section = ""
        if rag_context and rag_context.get("has_context"):
            rag_section = "\n" + rag_context["formatted_context"] + "\n"

        prompt = f"""You are an educational AI providing feedback on a multi-part question.

Main Question: {question.text}

Sub-questions performance (INTERNAL - For AI analysis only):
{sub_results_internal}

Total Score: {earned_points}/{total_points} ({score:.1f}%)
Correct sub-questions: {correct_count}/{total_count}
{rag_section}{previous_feedback_section}
⚠️ CRITICAL INSTRUCTION: NEVER reveal which specific sub-questions (by ID like "1a", "1b", etc.) are correct or incorrect in your feedback. DO NOT tell the student which parts they got wrong. Instead:

1. **Analyze the question content**: Understand what overall topic/concept this multi-part question is testing
2. **Provide contextual feedback**: Give feedback specific to THIS question's subject matter and how the parts relate
3. **Explain the connections**: Help the student understand how the different parts connect to each other and to the main topic
4. **Give meaningful guidance**: Provide conceptual hints relevant to THIS particular question's topic
5. **Be detailed and specific**: Don't give generic advice - make it relevant to the actual content and topic being tested

Your goal is to help students LEARN by understanding the concepts being tested across all parts, not to point them to specific parts or reveal answers.

IMPORTANT: Your feedback should clearly demonstrate that you understand what this question is testing. Reference the specific subject matter and topic.

Provide constructive, DETAILED, and CONTEXTUAL feedback in JSON format:
{{
    "explanation": "Detailed analysis of their overall performance. Start by explaining how many parts they answered correctly (e.g., 'You answered X out of Y parts correctly'). Then provide insight into what this multi-part question is testing - what is the overall topic? How do the different parts relate to this topic? Why is understanding this important? Be specific to THIS question's content and subject matter.",

    "improvement_hint": "Specific, contextual guidance related to THIS question's overall topic. {("If course material sources are provided above, ALWAYS include an EXACT document reference like 'Review [Document Name], Page X' or 'See the section on [topic] in [Document]'. " if rag_context and rag_context.get('has_context') else "")}Don't just say 'review all parts' - instead, help them understand the key concepts they need to grasp to answer all parts successfully.",

    "concept_explanation": "Explain the overarching concept or principle that connects all the sub-questions together. What is the main learning objective? How do the different parts build on each other? Be specific to this question's topic."
}}

Example of GOOD feedback (detailed and contextual):
- "This multi-part question tests your understanding of photosynthesis. To review this topic, see Lab 4, Pages 2-3, the section on light-dependent reactions..."

Example of BAD feedback (too generic - AVOID THIS):
- "Review each part carefully and make sure you understand what each one is asking."

Make your feedback detailed, contextual, and helpful!"""

        try:
            response = self.client.create_chat_completion(
                messages=[{"role": "user", "content": prompt}],
                model=ai_model,
                temperature=0.4,
                max_tokens=700
            )

            # Parse JSON response
            feedback_text = response.choices[0].message.content.strip()

            # Handle markdown code blocks if present
            if feedback_text.startswith("```"):
                feedback_text = feedback_text.split("```")[1]
                if feedback_text.startswith("json"):
                    feedback_text = feedback_text[4:]
                feedback_text = feedback_text.strip()

            feedback_json = json.loads(feedback_text)

            # Calculate question-level points from percentage score
            question_points_earned = (score / 100.0) * question.points

            return {
                "is_correct": earned_points == total_points,
                "correctness_score": int(score),
                "points_earned": round(question_points_earned, 2),  # Question-level points
                "points_possible": question.points,  # Question-level max points
                "criterion_scores": {},  # Multi-part uses sub-question grading, not criterion-based
                "confidence_level": "high" if earned_points == total_points else "medium",
                "explanation": feedback_json.get("explanation", ""),
                "improvement_hint": feedback_json.get("improvement_hint"),
                "concept_explanation": feedback_json.get("concept_explanation"),
                "sub_results": sub_results,
                "sub_total_points": total_points,  # Sub-question points (for internal tracking)
                "sub_earned_points": earned_points,  # Sub-question earned points (for internal tracking)
                "feedback_type": "multi_part"
            }

        except Exception as e:
            logger.error(f"AI feedback generation failed for multi-part: {str(e)}")
            _multi_part_error_type = type(e).__name__
            _multi_part_error_message = str(e)[:200]

            # Build detailed explanation from sub-results WITHOUT revealing which parts are wrong
            correct_count = sum(1 for r in sub_results if r['is_correct'])
            total_count = len(sub_results)

            # Create explanation without revealing specific sub-question IDs that are wrong
            if earned_points == total_points:
                explanation = f"Excellent work! You answered all {total_count} sub-questions correctly."
            else:
                explanation = f"You answered {correct_count} out of {total_count} sub-questions correctly."
                if correct_count < total_count:
                    explanation += f" Some of your answers need revision."

            # Create improvement hint if not perfect score
            improvement_hint = None
            if earned_points < total_points:
                improvement_hint = "Review each part of the question carefully. Make sure you fully understand what each sub-question is asking. Some parts may require different types of thinking or knowledge - consider the relationship between all the parts and the main question."

            # Calculate question-level points from percentage score
            question_points_earned = (score / 100.0) * question.points

            return {
                "is_correct": earned_points == total_points,
                "correctness_score": int(score),
                "points_earned": round(question_points_earned, 2),  # Question-level points
                "points_possible": question.points,  # Question-level max points
                "criterion_scores": {},  # Multi-part uses sub-question grading, not criterion-based
                "confidence_level": "low",  # Fallback has low confidence
                "explanation": explanation,
                "improvement_hint": improvement_hint,
                "concept_explanation": "Multi-part questions test your understanding of how different concepts relate to each other. Each part builds on the overall topic, so make sure you understand both the individual components and their connections. Take time to read each part carefully and answer thoroughly.",
                "sub_results": sub_results,
                "sub_total_points": total_points,  # Sub-question points (for internal tracking)
                "sub_earned_points": earned_points,  # Sub-question earned points (for internal tracking)
                "feedback_type": "multi_part",
                "fallback": True,
                "_error_type": _multi_part_error_type,
                "_error_message": _multi_part_error_message,
            }

    def _feedback_model_to_dict(self, feedback_model) -> Dict[str, Any]:
        """Convert AIFeedback model to dictionary for API response"""
        data = feedback_model.feedback_data or {}
        return {
            # Feedback content (may be None if still generating)
            "is_correct": feedback_model.is_correct,
            "correctness_score": feedback_model.score,
            "explanation": data.get("explanation", ""),
            "improvement_hint": data.get("improvement_hint"),
            "concept_explanation": data.get("concept_explanation"),
            "strengths": data.get("strengths"),
            "weaknesses": data.get("weaknesses"),
            "selected_option": data.get("selected_option"),
            "correct_option": data.get("correct_option"),
            "available_options": data.get("available_options"),
            "used_rag": data.get("used_rag", False),
            "rag_sources": data.get("rag_sources"),
            "model_used": feedback_model.ai_model_used or data.get("model_used", "gpt-4"),
            "confidence_level": feedback_model.confidence_level or data.get("confidence_level", "medium"),
            "feedback_type": data.get("feedback_type", "unknown"),

            # Status tracking (NEW)
            "generation_status": feedback_model.generation_status,
            "generation_progress": feedback_model.generation_progress,
            "error_message": feedback_model.error_message,
            "error_type": feedback_model.error_type,
            "can_retry": feedback_model.can_retry,
            "retry_count": feedback_model.retry_count,
            "max_retries": feedback_model.max_retries,

            # Timestamps
            "generated_at": feedback_model.generated_at.isoformat() if feedback_model.generated_at else None,
            "started_at": feedback_model.started_at.isoformat() if feedback_model.started_at else None,
            "completed_at": feedback_model.completed_at.isoformat() if feedback_model.completed_at else None,
            "generation_duration": feedback_model.generation_duration,

            # IDs
            "feedback_id": str(feedback_model.id)
        }
