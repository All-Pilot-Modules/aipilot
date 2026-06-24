# app/utils/question_parser.py
import re
import json
from uuid import UUID

def parse_testbank_text_to_questions(raw_text: str, module_id: UUID, document_id: UUID = None) -> list[dict]:
    questions = []
    lines = raw_text.splitlines()
    i = 0
    question_counter = 1  # Track question order
    while i < len(lines):
        line = lines[i].strip()

        # Match both "1)" and "1." formats
        match = re.match(r"^(\d+)[.)]\s+(.*)", line)
        if match:
            # Start collecting question text
            q_text_parts = [match.group(2)]
            options = {}
            correct_answer_letter = None
            learning_outcome = None
            bloom_taxonomy = None

            i += 1

            # Continue reading lines until we find an option, answer, or next question
            while i < len(lines):
                opt_line = lines[i].strip()

                # Skip empty lines
                if not opt_line:
                    i += 1
                    continue

                # Check if this is an option (A), B), etc.)
                opt_match = re.match(r"^([A-Ea-e])[.)]\s+(.*)", opt_line)
                if opt_match:
                    # We found the first option, stop collecting question text
                    break

                # Check if this is the answer line
                if re.search(r"\b(answer|ans)\s*:\s*([A-Ea-e])\b", opt_line, re.IGNORECASE):
                    # Answer found, stop collecting question text
                    break

                # Check if this is the next question
                if re.match(r"^\d+[.)]", opt_line):
                    # Next question found, stop collecting question text
                    break

                # Check for metadata lines
                if opt_line.lower().startswith("learning outcome:") or opt_line.lower().startswith("bloom"):
                    # Metadata found, stop collecting question text
                    break

                # Otherwise, this line is part of the question text
                q_text_parts.append(opt_line)
                i += 1

            # Join question text with spaces (preserve multi-line questions)
            q_text = " ".join(q_text_parts).strip()

            # Now collect options, answer, and metadata
            while i < len(lines):
                opt_line = lines[i].strip()

                # Skip empty lines
                if not opt_line:
                    i += 1
                    continue

                # Match both "A)" and "a." formats (case-insensitive)
                opt_match = re.match(r"^([A-Ea-e])[.)]\s+(.*)", opt_line)
                if opt_match:
                    # Normalize option letter to uppercase
                    option_letter = opt_match.group(1).upper()
                    option_text_parts = [opt_match.group(2)]
                    i += 1

                    # Continue reading option text until next option/answer/question
                    while i < len(lines):
                        next_line = lines[i].strip()

                        if not next_line:
                            i += 1
                            continue

                        # Check if next line is another option, answer, question, or metadata
                        if (re.match(r"^([A-Ea-e])[.)]", next_line) or
                            re.search(r"\b(answer|ans)\s*:", next_line, re.IGNORECASE) or
                            re.match(r"^\d+[.)]", next_line) or
                            next_line.lower().startswith("learning outcome:") or
                            next_line.lower().startswith("bloom")):
                            break

                        # This line is part of the option text
                        option_text_parts.append(next_line)
                        i += 1

                    # Join option text with spaces
                    options[option_letter] = " ".join(option_text_parts).strip()

                # Match "Answer:" in various formats (case-insensitive, flexible spacing)
                # Matches: "Answer: a", "Answer:a", "answer: A", "Ans: b", "ANS:c", etc.
                elif re.search(r"\b(answer|ans)\s*:\s*([A-Ea-e])\b", opt_line, re.IGNORECASE):
                    answer_match = re.search(r"\b(answer|ans)\s*:\s*([A-Ea-e])\b", opt_line, re.IGNORECASE)
                    correct_answer_letter = answer_match.group(2).upper()
                    i += 1
                elif opt_line.lower().startswith("learning outcome:"):
                    learning_outcome = re.sub(r"^learning outcome:\s*", "", opt_line, flags=re.IGNORECASE).strip()
                    i += 1
                elif opt_line.lower().startswith("bloom"):
                    bloom_taxonomy = opt_line.strip()
                    i += 1
                elif re.match(r"^\d+[.)]", opt_line):
                    # Next question found (matches both "1)" and "1.")
                    break
                else:
                    i += 1

            q_type = "mcq" if options else "short"

            # For MCQ questions: use correct_option_id (stores letter A, B, C, D, E)
            # For short/long answers: use correct_answer (stores text)
            correct_option_id = None
            correct_answer = None

            if q_type == "mcq":
                correct_option_id = correct_answer_letter  # Store the letter (A, B, C, D, E)
                # Debug: Warn if MCQ has no answer
                if not correct_option_id:
                    print(f"⚠️ Question {len(questions) + 1} missing answer: {q_text[:50]}...")
            elif q_type == "short":
                correct_answer = correct_answer_letter  # For short answers, store the text

            questions.append({
                "module_id": str(module_id),
                "document_id": str(document_id) if document_id else None,
                "type": q_type,
                "text": q_text,
                "slide_number": None,
                "question_order": question_counter,
                "options": options if options else None,
                "correct_option_id": correct_option_id,  # MCQ correct answer letter
                "correct_answer": correct_answer,  # Short/long answer text
                "learning_outcome": learning_outcome,
                "bloom_taxonomy": bloom_taxonomy,
                "image_url": None,
                "has_text_input": False if q_type == "short" else True
            })
            question_counter += 1
        else:
            i += 1

    print(f"✅ Parsed {len(questions)} questions from testbank (regex method)")
    return questions


def parse_testbank_with_ai(raw_text: str, module_id: UUID, document_id: UUID = None) -> list[dict]:
    """
    AI-powered testbank question extraction using OpenAI.

    This method is more robust for:
    - Complex multi-line questions
    - Non-standard formatting
    - Questions with tables or special characters
    - Scanned/OCR'd documents with formatting issues

    Args:
        raw_text: Raw text extracted from the testbank document
        module_id: UUID of the module
        document_id: Optional UUID of the document

    Returns:
        List of question dictionaries
    """
    try:
        from app.core.config import OPENAI_API_KEYS
        from app.services.openai_client import OpenAIClientWithRetry
        client = OpenAIClientWithRetry(api_keys=OPENAI_API_KEYS)

        prompt = f"""You are an expert at extracting multiple-choice questions from testbank documents.

Extract ALL questions from the following testbank text. For each question, identify:
1. The complete question text (handle multi-line questions carefully)
2. All answer options (A, B, C, D, E if present)
3. The correct answer letter
4. Any metadata (learning outcome, bloom taxonomy)

Return a JSON array where each question has this structure:
{{
    "question_number": 1,
    "text": "The complete question text...",
    "options": {{
        "A": "Option A text...",
        "B": "Option B text...",
        "C": "Option C text...",
        "D": "Option D text..."
    }},
    "correct_answer": "A",
    "learning_outcome": "Optional learning outcome",
    "bloom_taxonomy": "Optional bloom taxonomy"
}}

IMPORTANT:
- Capture the COMPLETE question text, including all lines
- Capture the COMPLETE option text for each choice
- If an option spans multiple lines, combine them into one string
- Preserve all question numbers in sequential order
- If no options exist (short answer question), set options to null

Testbank Text:
{raw_text}

Return ONLY the JSON array, no additional text."""

        response = client.create_chat_completion(
            messages=[
                {"role": "system", "content": "You are a precise testbank question extractor. Return only valid JSON."},
                {"role": "user", "content": prompt}
            ],
            model="gpt-4o",
            temperature=0.1,
            response_format={"type": "json_object"}
        )

        result = json.loads(response.choices[0].message.content)

        # Handle both direct array and wrapped array formats
        if isinstance(result, dict) and 'questions' in result:
            extracted_questions = result['questions']
        elif isinstance(result, list):
            extracted_questions = result
        else:
            print(f"⚠️ Unexpected AI response format: {type(result)}")
            return []

        # Convert to our question format
        questions = []
        for idx, q in enumerate(extracted_questions, 1):
            q_type = "mcq" if q.get("options") else "short"
            correct_option_id = q.get("correct_answer", "").upper() if q_type == "mcq" else None
            correct_answer = q.get("correct_answer") if q_type == "short" else None

            questions.append({
                "module_id": str(module_id),
                "document_id": str(document_id) if document_id else None,
                "type": q_type,
                "text": q.get("text", "").strip(),
                "slide_number": None,
                "question_order": q.get("question_number", idx),
                "options": q.get("options"),
                "correct_option_id": correct_option_id,
                "correct_answer": correct_answer,
                "learning_outcome": q.get("learning_outcome"),
                "bloom_taxonomy": q.get("bloom_taxonomy"),
                "image_url": None,
                "has_text_input": False if q_type == "short" else True
            })

        print(f"✅ Parsed {len(questions)} questions from testbank (AI method)")
        return questions

    except Exception as e:
        print(f"❌ AI parsing failed: {str(e)}")
        raise


def parse_testbank_hybrid(raw_text: str, module_id: UUID, document_id: UUID = None, use_ai_fallback: bool = True) -> list[dict]:
    """
    Hybrid approach: Try regex first, fall back to AI if needed.

    Args:
        raw_text: Raw text from testbank
        module_id: UUID of module
        document_id: Optional UUID of document
        use_ai_fallback: If True and regex fails, use AI extraction

    Returns:
        List of question dictionaries
    """
    # Try regex parsing first (faster and cheaper)
    try:
        questions = parse_testbank_text_to_questions(raw_text, module_id, document_id)

        # If we got a reasonable number of questions, return them
        if len(questions) >= 5:  # Arbitrary threshold
            return questions

        print(f"⚠️ Regex parser found only {len(questions)} questions, trying AI fallback...")

    except Exception as e:
        print(f"⚠️ Regex parsing failed: {str(e)}")
        questions = []

    # Fall back to AI if enabled
    if use_ai_fallback:
        try:
            return parse_testbank_with_ai(raw_text, module_id, document_id)
        except Exception as e:
            print(f"❌ AI fallback also failed: {str(e)}")
            # Return whatever regex got us
            return questions

    return questions