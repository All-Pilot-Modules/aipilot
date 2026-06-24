"""
OpenAI Client with Retry Logic and Timeout Handling

This module provides a robust wrapper around OpenAI API calls with:
- Automatic retry with exponential backoff
- Timeout handling
- Rate limit detection
- Comprehensive error logging
"""

import openai
import time
import logging
import itertools
import threading
from typing import Dict, Any, List
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log
)

logger = logging.getLogger(__name__)


class OpenAIClientWithRetry:
    """
    OpenAI client with built-in retry logic, timeout handling, and key rotation.
    Pass a list of API keys to distribute requests across rate-limit buckets.
    """

    def __init__(self, api_key: str = None, default_model: str = "gpt-4o-mini", api_keys: list = None):
        keys = api_keys or ([api_key] if api_key else [])
        if not keys:
            raise ValueError("At least one OpenAI API key is required")

        # Build one client per key; rotate round-robin across them
        self._clients = [
            openai.OpenAI(api_key=k, timeout=30.0, max_retries=0)
            for k in keys
        ]
        self._key_cycle = itertools.cycle(self._clients)
        self._lock = threading.Lock()
        self.default_model = default_model

        if len(keys) > 1:
            logger.info(f"[OpenAI] Rotating across {len(keys)} API keys")

    def _next_client(self):
        with self._lock:
            return next(self._key_cycle)

    @retry(
        stop=stop_after_attempt(2),  # Try up to 2 times (fits within 45s stale window)
        wait=wait_exponential(multiplier=1, min=2, max=5),  # 2s, then 4s delay
        retry=retry_if_exception_type((
            openai.APITimeoutError,
            openai.APIConnectionError,
            openai.RateLimitError
        )),
        before_sleep=before_sleep_log(logger, logging.WARNING)
    )
    def create_chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: str = None,
        temperature: float = 0.3,
        max_tokens: int = 800,
        **kwargs
    ) -> Any:
        """
        Create a chat completion with automatic retry logic.

        Args:
            messages: List of message dicts with 'role' and 'content'
            model: Model to use (default: self.default_model)
            temperature: Sampling temperature (default: 0.3)
            max_tokens: Maximum tokens to generate (default: 800)
            **kwargs: Additional arguments to pass to the API

        Returns:
            OpenAI completion response

        Raises:
            openai.APITimeoutError: If request times out after retries
            openai.RateLimitError: If rate limit is hit after retries
            openai.APIError: If API returns an error after retries
        """
        model = model or self.default_model

        logger.info(f"🤖 OpenAI API call starting: model={model}, temp={temperature}, max_tokens={max_tokens}")

        try:
            client = self._next_client()
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                timeout=30.0,
                **kwargs
            )

            logger.info(f"✅ OpenAI API call successful")
            return response

        except openai.APITimeoutError as e:
            logger.error(f"⏱️ OpenAI API timeout after 30s: {e}")
            raise  # Will trigger retry via tenacity

        except openai.RateLimitError as e:
            logger.error(f"🚫 OpenAI rate limit hit: {e}")
            # Extract retry-after header if available
            if hasattr(e, 'response') and e.response:
                retry_after = e.response.headers.get('Retry-After', '20')
                wait_time = int(retry_after)
                logger.warning(f"⏳ Waiting {wait_time}s before retry...")
                time.sleep(wait_time)
            else:
                time.sleep(20)  # Default wait
            raise  # Will trigger retry via tenacity

        except openai.APIConnectionError as e:
            logger.error(f"🔌 OpenAI connection error: {e}")
            raise  # Will trigger retry via tenacity

        except openai.AuthenticationError as e:
            logger.error(f"🔑 OpenAI authentication error: {e}")
            raise  # Don't retry authentication errors

        except openai.BadRequestError as e:
            logger.error(f"❌ OpenAI bad request: {e}")
            raise  # Don't retry bad requests (likely code issue)

        except openai.APIError as e:
            logger.error(f"⚠️ OpenAI API error: {e}")
            raise

        except Exception as e:
            logger.error(f"💥 Unexpected error in OpenAI call: {type(e).__name__}: {e}")
            raise

    @retry(
        stop=stop_after_attempt(2),
        wait=wait_exponential(multiplier=1, min=2, max=5),
        retry=retry_if_exception_type((
            openai.APITimeoutError,
            openai.APIConnectionError,
            openai.RateLimitError
        )),
        before_sleep=before_sleep_log(logger, logging.WARNING)
    )
    def create_embedding(
        self,
        input: Any,
        model: str = "text-embedding-ada-002",
        **kwargs
    ) -> Any:
        """Create an embedding with automatic retry and key rotation."""
        try:
            client = self._next_client()
            return client.embeddings.create(input=input, model=model, **kwargs)
        except openai.APITimeoutError as e:
            logger.error(f"⏱️ OpenAI embedding timeout: {e}")
            raise
        except openai.RateLimitError as e:
            logger.error(f"🚫 OpenAI embedding rate limit: {e}")
            time.sleep(20)
            raise
        except openai.APIConnectionError as e:
            logger.error(f"🔌 OpenAI embedding connection error: {e}")
            raise
        except Exception as e:
            logger.error(f"💥 Unexpected error in embedding call: {type(e).__name__}: {e}")
            raise

    def create_completion_with_fallback(
        self,
        messages: List[Dict[str, str]],
        model: str = None,
        temperature: float = 0.3,
        max_tokens: int = 800,
        fallback_response: Dict[str, Any] = None,
        **kwargs
    ) -> tuple[Any, bool]:
        """
        Create a chat completion with automatic fallback on failure.

        Args:
            messages: List of message dicts
            model: Model to use
            temperature: Sampling temperature
            max_tokens: Maximum tokens
            fallback_response: Response to return if all retries fail
            **kwargs: Additional arguments

        Returns:
            Tuple of (response, is_fallback)
            - response: OpenAI response or fallback_response
            - is_fallback: True if fallback was used, False if API succeeded
        """
        try:
            response = self.create_chat_completion(
                messages=messages,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
                **kwargs
            )
            return response, False

        except Exception as e:
            logger.error(f"❌ OpenAI call failed after all retries: {e}")
            if fallback_response:
                logger.warning(f"⚠️ Using fallback response")
                return fallback_response, True
            else:
                raise
