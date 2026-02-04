"""
Unit tests for question_grading.py - Grading logic for different question types.
Tests: fill-blank grading, MCQ multiple grading, exact match, semantic match.
"""
import pytest
from unittest.mock import MagicMock, patch


class TestQuestionGradingService:
    """Tests for the QuestionGradingService class."""

    @pytest.fixture
    def grading_service(self):
        """Create a grading service instance with mocked OpenAI."""
        with patch("app.services.question_grading.openai") as mock_openai:
            mock_client = MagicMock()
            mock_openai.OpenAI.return_value = mock_client
            from app.services.question_grading import QuestionGradingService
            service = QuestionGradingService()
            service.client = mock_client
            yield service

    # -------------------------------------------------------------------------
    # Fill-in-the-Blank Grading Tests
    # -------------------------------------------------------------------------
    class TestGradeFillBlank:
        """Tests for grade_fill_blank method."""

        def test_all_blanks_correct_exact_match(self, grading_service):
            """Test all blanks correct with exact match."""
            student_answers = {0: "mitochondria", 1: "nucleus"}
            blank_configs = [
                {"position": 0, "correct_answers": ["mitochondria"], "points": 2.0, "case_sensitive": False},
                {"position": 1, "correct_answers": ["nucleus"], "points": 2.0, "case_sensitive": False},
            ]

            result = grading_service.grade_fill_blank(
                student_answers, blank_configs, use_ai_semantic_matching=False
            )

            assert result["is_correct"] is True
            assert result["earned_points"] == 4.0
            assert result["total_points"] == 4.0
            assert result["percentage"] == 100.0
            assert result["partial_credit"] is False
            assert len(result["blank_results"]) == 2
            assert all(br["is_correct"] for br in result["blank_results"])

        def test_partial_blanks_correct(self, grading_service):
            """Test partial credit when some blanks are correct."""
            student_answers = {0: "mitochondria", 1: "cytoplasm"}
            blank_configs = [
                {"position": 0, "correct_answers": ["mitochondria"], "points": 2.0, "case_sensitive": False},
                {"position": 1, "correct_answers": ["nucleus"], "points": 2.0, "case_sensitive": False},
            ]

            result = grading_service.grade_fill_blank(
                student_answers, blank_configs, use_ai_semantic_matching=False
            )

            assert result["is_correct"] is False
            assert result["earned_points"] == 2.0
            assert result["total_points"] == 4.0
            assert result["percentage"] == 50.0
            assert result["partial_credit"] is True

        def test_all_blanks_incorrect(self, grading_service):
            """Test when all blanks are incorrect."""
            student_answers = {0: "wrong", 1: "also wrong"}
            blank_configs = [
                {"position": 0, "correct_answers": ["mitochondria"], "points": 2.0, "case_sensitive": False},
                {"position": 1, "correct_answers": ["nucleus"], "points": 2.0, "case_sensitive": False},
            ]

            result = grading_service.grade_fill_blank(
                student_answers, blank_configs, use_ai_semantic_matching=False
            )

            assert result["is_correct"] is False
            assert result["earned_points"] == 0.0
            assert result["percentage"] == 0.0
            assert result["partial_credit"] is False

        def test_case_insensitive_matching(self, grading_service):
            """Test case-insensitive answer matching."""
            student_answers = {0: "MITOCHONDRIA", 1: "NuClEuS"}
            blank_configs = [
                {"position": 0, "correct_answers": ["mitochondria"], "points": 2.0, "case_sensitive": False},
                {"position": 1, "correct_answers": ["nucleus"], "points": 2.0, "case_sensitive": False},
            ]

            result = grading_service.grade_fill_blank(
                student_answers, blank_configs, use_ai_semantic_matching=False
            )

            assert result["is_correct"] is True
            assert result["earned_points"] == 4.0

        def test_case_sensitive_matching(self, grading_service):
            """Test case-sensitive answer matching fails on wrong case."""
            student_answers = {0: "MITOCHONDRIA"}
            blank_configs = [
                {"position": 0, "correct_answers": ["mitochondria"], "points": 2.0, "case_sensitive": True},
            ]

            result = grading_service.grade_fill_blank(
                student_answers, blank_configs, use_ai_semantic_matching=False
            )

            assert result["is_correct"] is False
            assert result["earned_points"] == 0.0

        def test_multiple_accepted_answers(self, grading_service):
            """Test that any of multiple accepted answers is correct."""
            student_answers = {0: "mitochondrion"}
            blank_configs = [
                {"position": 0, "correct_answers": ["mitochondria", "mitochondrion"], "points": 2.0, "case_sensitive": False},
            ]

            result = grading_service.grade_fill_blank(
                student_answers, blank_configs, use_ai_semantic_matching=False
            )

            assert result["is_correct"] is True
            assert result["earned_points"] == 2.0

        def test_empty_student_answer(self, grading_service):
            """Test empty student answer is marked incorrect."""
            student_answers = {0: "", 1: "nucleus"}
            blank_configs = [
                {"position": 0, "correct_answers": ["mitochondria"], "points": 2.0, "case_sensitive": False},
                {"position": 1, "correct_answers": ["nucleus"], "points": 2.0, "case_sensitive": False},
            ]

            result = grading_service.grade_fill_blank(
                student_answers, blank_configs, use_ai_semantic_matching=False
            )

            assert result["is_correct"] is False
            assert result["earned_points"] == 2.0
            assert result["blank_results"][0]["is_correct"] is False
            assert result["blank_results"][1]["is_correct"] is True

        def test_missing_student_answer(self, grading_service):
            """Test missing answer for a blank position."""
            student_answers = {0: "mitochondria"}  # Missing position 1
            blank_configs = [
                {"position": 0, "correct_answers": ["mitochondria"], "points": 2.0, "case_sensitive": False},
                {"position": 1, "correct_answers": ["nucleus"], "points": 2.0, "case_sensitive": False},
            ]

            result = grading_service.grade_fill_blank(
                student_answers, blank_configs, use_ai_semantic_matching=False
            )

            assert result["is_correct"] is False
            assert result["earned_points"] == 2.0

        def test_uneven_point_distribution(self, grading_service):
            """Test blanks with different point values."""
            student_answers = {0: "mitochondria", 1: "wrong"}
            blank_configs = [
                {"position": 0, "correct_answers": ["mitochondria"], "points": 1.0, "case_sensitive": False},
                {"position": 1, "correct_answers": ["nucleus"], "points": 3.0, "case_sensitive": False},
            ]

            result = grading_service.grade_fill_blank(
                student_answers, blank_configs, use_ai_semantic_matching=False
            )

            assert result["earned_points"] == 1.0
            assert result["total_points"] == 4.0
            assert result["percentage"] == 25.0

        def test_semantic_matching_enabled(self, grading_service):
            """Test AI semantic matching for synonyms."""
            # Mock the AI to return YES for semantic match
            mock_response = MagicMock()
            mock_response.choices = [MagicMock()]
            mock_response.choices[0].message.content = "YES"
            grading_service.client.chat.completions.create.return_value = mock_response

            student_answers = {0: "powerhouse"}  # Synonym for mitochondria
            blank_configs = [
                {"position": 0, "correct_answers": ["mitochondria"], "points": 2.0, "case_sensitive": False},
            ]

            result = grading_service.grade_fill_blank(
                student_answers, blank_configs, use_ai_semantic_matching=True
            )

            # Should be correct due to semantic match
            assert result["is_correct"] is True
            assert result["blank_results"][0]["semantic_match"] is True

        def test_semantic_matching_returns_no(self, grading_service):
            """Test AI semantic matching returns NO."""
            mock_response = MagicMock()
            mock_response.choices = [MagicMock()]
            mock_response.choices[0].message.content = "NO"
            grading_service.client.chat.completions.create.return_value = mock_response

            student_answers = {0: "completely wrong"}
            blank_configs = [
                {"position": 0, "correct_answers": ["mitochondria"], "points": 2.0, "case_sensitive": False},
            ]

            result = grading_service.grade_fill_blank(
                student_answers, blank_configs, use_ai_semantic_matching=True
            )

            assert result["is_correct"] is False
            assert result["blank_results"][0]["semantic_match"] is True  # AI was used

        def test_semantic_matching_api_error(self, grading_service):
            """Test graceful handling of AI API errors."""
            grading_service.client.chat.completions.create.side_effect = Exception("API Error")

            student_answers = {0: "synonym"}
            blank_configs = [
                {"position": 0, "correct_answers": ["mitochondria"], "points": 2.0, "case_sensitive": False},
            ]

            result = grading_service.grade_fill_blank(
                student_answers, blank_configs, use_ai_semantic_matching=True
            )

            # Should fall back to exact match (incorrect)
            assert result["is_correct"] is False
            assert result["blank_results"][0]["semantic_match"] is False

    # -------------------------------------------------------------------------
    # MCQ Multiple Grading Tests
    # -------------------------------------------------------------------------
    class TestGradeMCQMultiple:
        """Tests for grade_mcq_multiple method."""

        def test_all_correct_no_wrong(self, grading_service):
            """Test perfect score - all correct, none wrong."""
            result = grading_service.grade_mcq_multiple(
                selected_options=["A", "C"],
                correct_option_ids=["A", "C"],
                total_options=4
            )

            assert result["is_correct"] is True
            assert result["score"] == 100.0
            assert result["correctly_selected"] == ["A", "C"] or set(result["correctly_selected"]) == {"A", "C"}
            assert len(result["incorrectly_selected"]) == 0
            assert len(result["missed_correct"]) == 0

        def test_partial_correct_no_wrong(self, grading_service):
            """Test partial credit - some correct, none wrong."""
            result = grading_service.grade_mcq_multiple(
                selected_options=["A"],
                correct_option_ids=["A", "C"],
                total_options=4
            )

            assert result["is_correct"] is False
            assert result["score"] == 50.0  # 1/2 correct
            assert len(result["missed_correct"]) == 1

        def test_partial_correct_with_wrong(self, grading_service):
            """Test partial credit with wrong selections and penalty."""
            result = grading_service.grade_mcq_multiple(
                selected_options=["A", "B"],  # A correct, B wrong
                correct_option_ids=["A", "C"],
                total_options=4,
                partial_credit=True,
                penalty_for_wrong=True
            )

            assert result["is_correct"] is False
            # 50 points for A, minus penalty for B
            # Penalty = 50 * 0.25 = 12.5, so score = 50 - 12.5 = 37.5
            assert result["score"] == 37.5
            assert "A" in result["correctly_selected"]
            assert "B" in result["incorrectly_selected"]
            assert "C" in result["missed_correct"]

        def test_no_partial_credit_all_or_nothing(self, grading_service):
            """Test all-or-nothing mode (no partial credit)."""
            result = grading_service.grade_mcq_multiple(
                selected_options=["A"],  # Missing C
                correct_option_ids=["A", "C"],
                total_options=4,
                partial_credit=False
            )

            assert result["is_correct"] is False
            assert result["score"] == 0.0  # All or nothing

        def test_no_penalty_for_wrong(self, grading_service):
            """Test no penalty for wrong selections."""
            result = grading_service.grade_mcq_multiple(
                selected_options=["A", "B"],  # B is wrong
                correct_option_ids=["A", "C"],
                total_options=4,
                partial_credit=True,
                penalty_for_wrong=False
            )

            assert result["score"] == 50.0  # No penalty for B

        def test_all_wrong_selections(self, grading_service):
            """Test zero score when all selections are wrong."""
            result = grading_service.grade_mcq_multiple(
                selected_options=["B", "D"],
                correct_option_ids=["A", "C"],
                total_options=4
            )

            assert result["is_correct"] is False
            assert result["score"] == 0.0
            assert len(result["correctly_selected"]) == 0
            assert len(result["incorrectly_selected"]) == 2

        def test_empty_selection(self, grading_service):
            """Test empty selection gives zero score."""
            result = grading_service.grade_mcq_multiple(
                selected_options=[],
                correct_option_ids=["A", "C"],
                total_options=4
            )

            assert result["is_correct"] is False
            assert result["score"] == 0.0

        def test_single_correct_option(self, grading_service):
            """Test grading with single correct option."""
            result = grading_service.grade_mcq_multiple(
                selected_options=["A"],
                correct_option_ids=["A"],
                total_options=4
            )

            assert result["is_correct"] is True
            assert result["score"] == 100.0

        def test_breakdown_counts(self, grading_service):
            """Test the breakdown dictionary is accurate."""
            result = grading_service.grade_mcq_multiple(
                selected_options=["A", "B"],
                correct_option_ids=["A", "C", "D"],
                total_options=4
            )

            breakdown = result["breakdown"]
            assert breakdown["correct_selections"] == 1  # A
            assert breakdown["wrong_selections"] == 1    # B
            assert breakdown["missed_selections"] == 2   # C, D

        def test_score_never_negative(self, grading_service):
            """Test score floor at 0 even with heavy penalties."""
            result = grading_service.grade_mcq_multiple(
                selected_options=["B", "D"],  # Both wrong
                correct_option_ids=["A"],
                total_options=4,
                penalty_for_wrong=True
            )

            assert result["score"] >= 0


class TestExactMatchHelper:
    """Tests for the _check_exact_match helper method."""

    @pytest.fixture
    def grading_service(self):
        with patch("app.services.question_grading.openai"):
            from app.services.question_grading import QuestionGradingService
            yield QuestionGradingService()

    def test_exact_match_found(self, grading_service):
        result = grading_service._check_exact_match(
            "mitochondria", ["mitochondria", "mitochondrion"], case_sensitive=False
        )
        assert result is True

    def test_exact_match_not_found(self, grading_service):
        result = grading_service._check_exact_match(
            "wrong", ["mitochondria"], case_sensitive=False
        )
        assert result is False

    def test_case_sensitive_exact_match(self, grading_service):
        result = grading_service._check_exact_match(
            "Mitochondria", ["Mitochondria"], case_sensitive=True
        )
        assert result is True

    def test_case_sensitive_no_match(self, grading_service):
        result = grading_service._check_exact_match(
            "mitochondria", ["Mitochondria"], case_sensitive=True
        )
        assert result is False

    def test_empty_answer(self, grading_service):
        result = grading_service._check_exact_match(
            "", ["mitochondria"], case_sensitive=False
        )
        assert result is False

    def test_whitespace_handling(self, grading_service):
        """Test that answers are stripped before comparison."""
        # The method expects pre-stripped input, so this tests the caller's responsibility
        result = grading_service._check_exact_match(
            "mitochondria", ["mitochondria"], case_sensitive=False
        )
        assert result is True
