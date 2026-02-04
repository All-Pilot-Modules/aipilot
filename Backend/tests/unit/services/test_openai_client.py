"""
Unit tests for openai_client.py - OpenAI API wrapper with retry logic.
Tests: retry mechanism, timeout handling, error classification, fallbacks.
"""
import pytest
from unittest.mock import MagicMock, patch, call
import openai


class TestOpenAIClientWithRetry:
    """Tests for the OpenAIClientWithRetry class."""

    @pytest.fixture
    def mock_openai_module(self):
        """Patch the OpenAI module."""
        with patch("app.services.openai_client.openai") as mock:
            yield mock

    @pytest.fixture
    def client(self, mock_openai_module):
        """Create an OpenAI client with mocked OpenAI."""
        mock_client_instance = MagicMock()
        mock_openai_module.OpenAI.return_value = mock_client_instance

        from app.services.openai_client import OpenAIClientWithRetry
        client = OpenAIClientWithRetry(api_key="test-key", default_model="gpt-4")
        client.client = mock_client_instance
        return client

    def _create_mock_response(self, content: str = "Test response"):
        """Helper to create a mock completion response."""
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = content
        mock_response.choices[0].finish_reason = "stop"
        mock_response.usage = MagicMock()
        mock_response.usage.prompt_tokens = 10
        mock_response.usage.completion_tokens = 20
        mock_response.usage.total_tokens = 30
        return mock_response

    # -------------------------------------------------------------------------
    # Basic Functionality Tests
    # -------------------------------------------------------------------------
    def test_successful_completion(self, client):
        """Test successful API call returns response."""
        mock_response = self._create_mock_response("Hello, world!")
        client.client.chat.completions.create.return_value = mock_response

        result = client.create_chat_completion(
            messages=[{"role": "user", "content": "Say hello"}]
        )

        assert result.choices[0].message.content == "Hello, world!"
        client.client.chat.completions.create.assert_called_once()

    def test_uses_default_model(self, client):
        """Test that default model is used when not specified."""
        mock_response = self._create_mock_response()
        client.client.chat.completions.create.return_value = mock_response

        client.create_chat_completion(
            messages=[{"role": "user", "content": "Test"}]
        )

        call_kwargs = client.client.chat.completions.create.call_args[1]
        assert call_kwargs["model"] == "gpt-4"

    def test_model_override(self, client):
        """Test that model can be overridden."""
        mock_response = self._create_mock_response()
        client.client.chat.completions.create.return_value = mock_response

        client.create_chat_completion(
            messages=[{"role": "user", "content": "Test"}],
            model="gpt-3.5-turbo"
        )

        call_kwargs = client.client.chat.completions.create.call_args[1]
        assert call_kwargs["model"] == "gpt-3.5-turbo"

    def test_default_temperature(self, client):
        """Test default temperature parameter."""
        mock_response = self._create_mock_response()
        client.client.chat.completions.create.return_value = mock_response

        client.create_chat_completion(
            messages=[{"role": "user", "content": "Test"}]
        )

        call_kwargs = client.client.chat.completions.create.call_args[1]
        assert call_kwargs["temperature"] == 0.3

    def test_custom_temperature(self, client):
        """Test custom temperature parameter."""
        mock_response = self._create_mock_response()
        client.client.chat.completions.create.return_value = mock_response

        client.create_chat_completion(
            messages=[{"role": "user", "content": "Test"}],
            temperature=0.7
        )

        call_kwargs = client.client.chat.completions.create.call_args[1]
        assert call_kwargs["temperature"] == 0.7

    def test_default_max_tokens(self, client):
        """Test default max_tokens parameter."""
        mock_response = self._create_mock_response()
        client.client.chat.completions.create.return_value = mock_response

        client.create_chat_completion(
            messages=[{"role": "user", "content": "Test"}]
        )

        call_kwargs = client.client.chat.completions.create.call_args[1]
        assert call_kwargs["max_tokens"] == 800

    # -------------------------------------------------------------------------
    # Retry Logic Tests
    # -------------------------------------------------------------------------
    def test_retry_on_timeout(self, client):
        """Test retry on API timeout error."""
        mock_response = self._create_mock_response()

        # First call times out, second succeeds
        client.client.chat.completions.create.side_effect = [
            openai.APITimeoutError(request=MagicMock()),
            mock_response
        ]

        result = client.create_chat_completion(
            messages=[{"role": "user", "content": "Test"}]
        )

        assert result.choices[0].message.content == "Test response"
        assert client.client.chat.completions.create.call_count == 2

    def test_retry_on_connection_error(self, client):
        """Test retry on connection error."""
        mock_response = self._create_mock_response()

        client.client.chat.completions.create.side_effect = [
            openai.APIConnectionError(request=MagicMock()),
            mock_response
        ]

        result = client.create_chat_completion(
            messages=[{"role": "user", "content": "Test"}]
        )

        assert client.client.chat.completions.create.call_count == 2

    def test_retry_on_rate_limit(self, client):
        """Test retry on rate limit error."""
        mock_response = self._create_mock_response()

        # Create rate limit error
        rate_limit_response = MagicMock()
        rate_limit_response.status_code = 429
        rate_limit_response.headers = {"Retry-After": "1"}

        client.client.chat.completions.create.side_effect = [
            openai.RateLimitError(
                message="Rate limit exceeded",
                response=rate_limit_response,
                body={"error": {"message": "Rate limit"}}
            ),
            mock_response
        ]

        result = client.create_chat_completion(
            messages=[{"role": "user", "content": "Test"}]
        )

        assert client.client.chat.completions.create.call_count == 2

    def test_max_retries_exceeded(self, client):
        """Test that error is raised after max retries."""
        # All calls timeout
        client.client.chat.completions.create.side_effect = openai.APITimeoutError(
            request=MagicMock()
        )

        with pytest.raises(openai.APITimeoutError):
            client.create_chat_completion(
                messages=[{"role": "user", "content": "Test"}]
            )

        # Should have tried 3 times (initial + 2 retries based on tenacity config)
        assert client.client.chat.completions.create.call_count >= 2

    # -------------------------------------------------------------------------
    # Non-Retryable Error Tests
    # -------------------------------------------------------------------------
    def test_no_retry_on_auth_error(self, client):
        """Test no retry on authentication error."""
        auth_response = MagicMock()
        auth_response.status_code = 401

        client.client.chat.completions.create.side_effect = openai.AuthenticationError(
            message="Invalid API key",
            response=auth_response,
            body={"error": {"message": "Invalid key"}}
        )

        with pytest.raises(openai.AuthenticationError):
            client.create_chat_completion(
                messages=[{"role": "user", "content": "Test"}]
            )

        # Should only try once - no retry on auth errors
        assert client.client.chat.completions.create.call_count == 1

    def test_no_retry_on_bad_request(self, client):
        """Test no retry on bad request error."""
        bad_request_response = MagicMock()
        bad_request_response.status_code = 400

        client.client.chat.completions.create.side_effect = openai.BadRequestError(
            message="Invalid request",
            response=bad_request_response,
            body={"error": {"message": "Bad request"}}
        )

        with pytest.raises(openai.BadRequestError):
            client.create_chat_completion(
                messages=[{"role": "user", "content": "Test"}]
            )

        assert client.client.chat.completions.create.call_count == 1

    # -------------------------------------------------------------------------
    # Fallback Tests
    # -------------------------------------------------------------------------
    def test_fallback_on_failure(self, client):
        """Test fallback response is returned on failure."""
        client.client.chat.completions.create.side_effect = openai.APITimeoutError(
            request=MagicMock()
        )

        fallback = {"default": "response"}
        result, is_fallback = client.create_completion_with_fallback(
            messages=[{"role": "user", "content": "Test"}],
            fallback_response=fallback
        )

        assert result == fallback
        assert is_fallback is True

    def test_no_fallback_on_success(self, client):
        """Test fallback not used on successful call."""
        mock_response = self._create_mock_response("Success!")
        client.client.chat.completions.create.return_value = mock_response

        fallback = {"default": "response"}
        result, is_fallback = client.create_completion_with_fallback(
            messages=[{"role": "user", "content": "Test"}],
            fallback_response=fallback
        )

        assert result.choices[0].message.content == "Success!"
        assert is_fallback is False

    def test_raises_without_fallback(self, client):
        """Test error is raised when no fallback provided."""
        client.client.chat.completions.create.side_effect = openai.APITimeoutError(
            request=MagicMock()
        )

        with pytest.raises(openai.APITimeoutError):
            client.create_completion_with_fallback(
                messages=[{"role": "user", "content": "Test"}],
                fallback_response=None
            )

    # -------------------------------------------------------------------------
    # Integration-style Tests
    # -------------------------------------------------------------------------
    def test_multiple_messages_conversation(self, client):
        """Test handling conversation with multiple messages."""
        mock_response = self._create_mock_response("Based on our conversation...")
        client.client.chat.completions.create.return_value = mock_response

        messages = [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi there!"},
            {"role": "user", "content": "What did I say first?"},
        ]

        result = client.create_chat_completion(messages=messages)

        call_kwargs = client.client.chat.completions.create.call_args[1]
        assert len(call_kwargs["messages"]) == 4

    def test_additional_kwargs_passed_through(self, client):
        """Test additional kwargs are passed to API."""
        mock_response = self._create_mock_response()
        client.client.chat.completions.create.return_value = mock_response

        client.create_chat_completion(
            messages=[{"role": "user", "content": "Test"}],
            presence_penalty=0.5,
            frequency_penalty=0.3
        )

        call_kwargs = client.client.chat.completions.create.call_args[1]
        assert call_kwargs.get("presence_penalty") == 0.5
        assert call_kwargs.get("frequency_penalty") == 0.3


class TestClientInitialization:
    """Tests for OpenAI client initialization."""

    def test_client_created_with_api_key(self):
        """Test client is initialized with API key."""
        with patch("app.services.openai_client.openai.OpenAI") as mock_openai:
            from app.services.openai_client import OpenAIClientWithRetry

            client = OpenAIClientWithRetry(api_key="test-key-123")

            mock_openai.assert_called_once()
            call_kwargs = mock_openai.call_args[1]
            assert call_kwargs["api_key"] == "test-key-123"

    def test_timeout_configured(self):
        """Test client has timeout configured."""
        with patch("app.services.openai_client.openai.OpenAI") as mock_openai:
            from app.services.openai_client import OpenAIClientWithRetry

            client = OpenAIClientWithRetry(api_key="test-key")

            call_kwargs = mock_openai.call_args[1]
            assert call_kwargs["timeout"] == 90

    def test_builtin_retries_disabled(self):
        """Test OpenAI built-in retries are disabled."""
        with patch("app.services.openai_client.openai.OpenAI") as mock_openai:
            from app.services.openai_client import OpenAIClientWithRetry

            client = OpenAIClientWithRetry(api_key="test-key")

            call_kwargs = mock_openai.call_args[1]
            assert call_kwargs["max_retries"] == 0
