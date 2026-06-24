"""
AI Question Generation Service
Generates questions from document content using OpenAI GPT models
"""
import json
import logging
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import datetime, timezone

from app.core.config import OPENAI_API_KEYS, LLM_MODEL
from app.services.openai_client import OpenAIClientWithRetry
from app.models.document import Document
from app.models.document_chunk import DocumentChunk
from app.models.question import QuestionStatus

logger = logging.getLogger(__name__)


class QuestionGenerationService:
    """Service for generating questions from documents using AI"""

    def __init__(self):
        json_compatible_models = ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo-1106"]
        if LLM_MODEL in json_compatible_models:
            self.default_model = LLM_MODEL
        else:
            self.default_model = "gpt-4o-mini"
            logger.info(f"Using gpt-4o-mini for question generation (LLM_MODEL={LLM_MODEL} doesn't support JSON mode)")
        self.client = OpenAIClientWithRetry(api_keys=OPENAI_API_KEYS, default_model=self.default_model)

    def generate_questions_from_document(
        self,
        db: Session,
        document_id: UUID,
        num_short: int = 0,
        num_long: int = 0,
        num_mcq: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Generate questions from a document using its RAG-processed chunks

        Args:
            db: Database session
            document_id: UUID of the source document
            num_short: Number of short answer questions to generate
            num_long: Number of long answer questions to generate
            num_mcq: Number of multiple choice questions to generate

        Returns:
            List of question dictionaries ready to be saved to database

        Raises:
            ValueError: If document not found or not properly indexed
            Exception: If OpenAI API call fails
        """
        # Validate document exists and is RAG-indexed
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            raise ValueError(f"Document with ID {document_id} not found")

        if document.processing_status not in ["embedded", "indexed"]:
            raise ValueError(
                f"Document '{document.title}' is not RAG-indexed. "
                f"Current status: {document.processing_status}. "
                f"Please ensure the document has been fully processed before generating questions."
            )

        # Fetch all chunks for this document
        chunks = db.query(DocumentChunk).filter(
            DocumentChunk.document_id == document_id
        ).order_by(DocumentChunk.chunk_index).all()

        if not chunks:
            raise ValueError(
                f"No content chunks found for document '{document.title}'. "
                f"The document may not have been properly processed."
            )

        logger.info(f"Generating questions from document '{document.title}' ({len(chunks)} chunks)")
        logger.info(f"Requested: {num_short} short, {num_long} long, {num_mcq} MCQ")

        # Construct document content from chunks
        document_content = self._format_chunks_for_prompt(chunks, document.title)

        # Build OpenAI prompt
        prompt = self._build_question_generation_prompt(
            document_content=document_content,
            document_title=document.title,
            num_short=num_short,
            num_long=num_long,
            num_mcq=num_mcq
        )

        # Log the full prompt for debugging
        print("\n" + "="*80)
        print("📤 SENDING TO OPENAI - FULL PROMPT")
        print("="*80)
        print(f"Model: {self.default_model}")
        print(f"Temperature: 0.7")
        print(f"\nSYSTEM MESSAGE:")
        print("-" * 80)
        print("You are an expert educational assessment designer. You create high-quality, "
              "pedagogically sound questions from educational materials. Questions should be "
              "clear, unambiguous, and test genuine understanding rather than mere memorization. "
              "Always respond with valid JSON.")
        print("\nUSER PROMPT:")
        print("-" * 80)
        print(prompt)
        print("="*80 + "\n")

        # Call OpenAI API
        try:
            logger.info(f"Calling OpenAI API with model: {self.default_model}")
            response = self.client.create_chat_completion(
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert educational assessment designer. You create high-quality, "
                                 "pedagogically sound questions from educational materials. Questions should be "
                                 "clear, unambiguous, and test genuine understanding rather than mere memorization. "
                                 "Always respond with valid JSON."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.7,
                max_tokens=4096,
                response_format={"type": "json_object"}
            )

            # Log the raw response from OpenAI
            raw_response = response.choices[0].message.content
            print("\n" + "="*80)
            print("📥 RECEIVED FROM OPENAI - RAW RESPONSE")
            print("="*80)
            print(f"Model used: {response.model}")
            print(f"Finish reason: {response.choices[0].finish_reason}")
            print(f"Total tokens: {response.usage.total_tokens if response.usage else 'N/A'}")
            print(f"Prompt tokens: {response.usage.prompt_tokens if response.usage else 'N/A'}")
            print(f"Completion tokens: {response.usage.completion_tokens if response.usage else 'N/A'}")
            print("\nRESPONSE CONTENT:")
            print("-" * 80)
            print(raw_response)
            print("="*80 + "\n")

            # Parse response
            generated_questions = self._parse_openai_response(
                raw_response,
                document_id=document_id,
                module_id=document.module_id
            )

            # Log the parsed questions
            print("\n" + "="*80)
            print("✅ PARSED QUESTIONS")
            print("="*80)
            print(f"Total questions parsed: {len(generated_questions)}")
            for i, q in enumerate(generated_questions, 1):
                print(f"\n--- Question {i} ---")
                print(f"Type: {q.get('type')}")
                print(f"Text: {q.get('text')[:100]}..." if len(q.get('text', '')) > 100 else f"Text: {q.get('text')}")
                if q.get('type') == 'mcq':
                    print(f"Options: {list(q.get('options', {}).keys())}")
                    print(f"Correct: {q.get('correct_option_id')}")
                else:
                    print(f"Correct Answer: {q.get('correct_answer', '')[:80]}..." if len(q.get('correct_answer', '')) > 80 else f"Correct Answer: {q.get('correct_answer', '')}")
                print(f"Learning Outcome: {q.get('learning_outcome', 'N/A')[:60]}...")
            print("="*80 + "\n")

            logger.info(f"Successfully generated {len(generated_questions)} questions")
            return generated_questions

        except Exception as e:
            logger.error(f"Error during question generation: {str(e)}")
            raise

    def _format_chunks_for_prompt(self, chunks: List[DocumentChunk], document_title: str) -> str:
        """
        Format document chunks into a coherent text for the prompt

        Args:
            chunks: List of DocumentChunk objects
            document_title: Title of the document

        Returns:
            Formatted document content string
        """
        content_parts = [f"# {document_title}\n"]

        for chunk in chunks:
            # Add metadata context if available
            metadata = chunk.chunk_metadata or {}

            # Add location context (page, slide, section)
            location_info = []
            if metadata.get('page_number'):
                location_info.append(f"Page {metadata['page_number']}")
            elif metadata.get('slide_number'):
                location_info.append(f"Slide {metadata['slide_number']}")
            if metadata.get('heading'):
                location_info.append(f"{metadata['heading']}")

            if location_info:
                content_parts.append(f"\n## [{', '.join(location_info)}]")

            content_parts.append(chunk.chunk_text)

        return "\n".join(content_parts)

    def _build_question_generation_prompt(
        self,
        document_content: str,
        document_title: str,
        num_short: int,
        num_long: int,
        num_mcq: int
    ) -> str:
        """
        Build the OpenAI prompt for question generation

        Args:
            document_content: Formatted document content
            document_title: Title of the document
            num_short: Number of short answer questions
            num_long: Number of long answer questions
            num_mcq: Number of MCQ questions

        Returns:
            Complete prompt string
        """
        total_questions = num_short + num_long + num_mcq

        prompt = f"""Given the following educational material from "{document_title}", generate {total_questions} high-quality assessment questions.

=== DOCUMENT CONTENT ===
{document_content}
=== END OF DOCUMENT ===

Generate exactly:
- {num_short} SHORT ANSWER questions (expected answer: 1-2 sentences)
- {num_long} LONG ANSWER questions (expected answer: 1-2 paragraphs)
- {num_mcq} MULTIPLE CHOICE questions (4 options each, labeled A-D)

REQUIREMENTS:
1. Questions should test comprehension and critical thinking, not just memorization
2. Cover different topics/concepts from the document (diverse question coverage)
3. For MCQ: All options should be plausible, only one correct answer
4. For MCQ: Clearly indicate which option is correct
5. For SHORT/LONG questions: Provide a correct_answer with the expected response (used for AI feedback)
6. For SHORT answers: Keep correct_answer to 1-2 concise sentences
7. For LONG answers: Provide correct_answer as 1-2 paragraphs with key points that should be covered
8. Include a learning outcome for each question (what concept/skill it tests)
9. Questions should be clear, unambiguous, and appropriate for the content level

RESPONSE FORMAT (JSON):
{{
  "questions": [
    {{
      "type": "short",
      "text": "Question text here?",
      "correct_answer": "Expected answer in 1-2 sentences (used for AI feedback)",
      "learning_outcome": "Tests understanding of...",
      "bloom_taxonomy": "Understand|Apply|Analyze|Evaluate|Create",
      "slide_number": null  // or integer if you can infer from document structure
    }},
    {{
      "type": "mcq",
      "text": "Question text here?",
      "options": {{
        "A": "First option",
        "B": "Second option",
        "C": "Third option",
        "D": "Fourth option"
      }},
      "correct_option_id": "A",
      "learning_outcome": "Tests understanding of...",
      "bloom_taxonomy": "Understand|Apply|Analyze|Evaluate|Create",
      "slide_number": null
    }},
    {{
      "type": "long",
      "text": "Question text here?",
      "correct_answer": "Expected answer in 1-2 paragraphs with key points (used for AI feedback)",
      "learning_outcome": "Tests understanding of...",
      "bloom_taxonomy": "Understand|Apply|Analyze|Evaluate|Create",
      "slide_number": null
    }}
  ]
}}

Generate all {total_questions} questions now. Ensure questions are pedagogically sound and aligned with the content."""

        return prompt

    def _parse_openai_response(
        self,
        response_content: str,
        document_id: UUID,
        module_id: UUID
    ) -> List[Dict[str, Any]]:
        """
        Parse OpenAI's JSON response into question dictionaries

        Args:
            response_content: Raw JSON string from OpenAI
            document_id: UUID of the source document
            module_id: UUID of the module

        Returns:
            List of question dictionaries ready for database insertion
        """
        try:
            data = json.loads(response_content)
            questions = data.get("questions", [])

            if not questions:
                raise ValueError("OpenAI response contained no questions")

            # Transform into database-ready format
            db_questions = []
            for i, q in enumerate(questions):
                question_dict = {
                    "module_id": str(module_id),
                    "document_id": str(document_id),
                    "type": q.get("type"),
                    "text": q.get("text"),
                    "learning_outcome": q.get("learning_outcome"),
                    "bloom_taxonomy": q.get("bloom_taxonomy"),
                    "slide_number": q.get("slide_number"),
                    "question_order": i,  # Preserve generation order

                    # AI generation metadata
                    "status": QuestionStatus.UNREVIEWED,  # Mark as unreviewed
                    "is_ai_generated": True,
                    "generated_at": datetime.now(timezone.utc),
                    "has_text_input": False
                }

                # Add MCQ-specific fields
                if q.get("type") == "mcq":
                    question_dict["options"] = q.get("options", {})
                    question_dict["correct_option_id"] = q.get("correct_option_id")
                    question_dict["correct_answer"] = None  # MCQs don't use correct_answer field
                    question_dict["has_text_input"] = True  # MCQs can have explanation input
                else:
                    # For short and long answer questions, save the AI-generated correct answer
                    question_dict["options"] = None
                    question_dict["correct_option_id"] = None
                    question_dict["correct_answer"] = q.get("correct_answer")  # Store expected answer
                    question_dict["has_text_input"] = True  # Short/Long answers have text input

                db_questions.append(question_dict)

            logger.info(f"Parsed {len(db_questions)} questions from OpenAI response")
            return db_questions

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse OpenAI response as JSON: {str(e)}")
            logger.error(f"Response content: {response_content}")
            raise ValueError(f"Invalid JSON response from OpenAI: {str(e)}")
        except Exception as e:
            logger.error(f"Error parsing OpenAI response: {str(e)}")
            raise


# Singleton instance
question_generation_service = QuestionGenerationService()
