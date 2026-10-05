import { useState, useEffect, useCallback, useRef } from 'react';
import { auth } from '@/lib/auth';

/**
 * Hook to poll feedback generation status for a specific answer
 *
 * @param {string} answerId - The answer ID to poll feedback for
 * @param {boolean} enabled - Whether polling is enabled (default: true)
 * @param {number} pollInterval - Polling interval in milliseconds (default: 2000)
 * @returns {object} Feedback status data and retry function
 */
export function useFeedbackPolling(answerId, enabled = true, pollInterval = 2000) {
  const [status, setStatus] = useState(null); // 'pending', 'generating', 'completed', 'failed', 'timeout'
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [canRetry, setCanRetry] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [maxRetries, setMaxRetries] = useState(3);

  const pollIntervalRef = useRef(null);
  const isMountedRef = useRef(true);

  // Poll feedback status
  const pollStatus = useCallback(async () => {
    if (!answerId || !enabled || !isMountedRef.current) return;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/ai-feedback/status/answer/${answerId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${auth.getToken() || ''}`,
          },
        }
      );

      if (!response.ok) {
        // If feedback not found yet (404), it's just pending - NOT an error
        // This is normal during initial generation
        if (response.status === 404) {
          setStatus('pending');
          setProgress(0);
          setError(null); // Clear any previous errors
          setCanRetry(false); // Can't retry something that hasn't started
          return;
        }
        throw new Error(`Failed to fetch feedback status: ${response.statusText}`);
      }

      const data = await response.json();

      if (!isMountedRef.current) return;

      setStatus(data.status);
      setProgress(data.progress || 0);
      setError(data.error_message);
      setCanRetry(data.can_retry || false);
      setFeedback(data.feedback);
      setRetryCount(data.retry_count || 0);
      setMaxRetries(data.max_retries || 3);

      // Stop polling if completed or failed (and can't retry)
      if (data.status === 'completed' || (data.status === 'failed' && !data.can_retry)) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }
    } catch (err) {
      console.error('Error polling feedback status:', err);
      if (isMountedRef.current) {
        // Provide user-friendly error messages for common issues
        let errorMessage = err.message;
        if (err.message.includes('fetch') || err.message.includes('network')) {
          errorMessage = 'Network error. Please check your internet connection.';
        }
        setError(errorMessage);
      }
    }
  }, [answerId, enabled]);

  // Retry feedback generation
  const retryGeneration = useCallback(async () => {
    if (!answerId || !canRetry) return;

    setLoading(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/ai-feedback/retry/answer/${answerId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${auth.getToken() || ''}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let errorMessage = errorData.detail || 'Failed to retry feedback generation';

        // Provide more specific error messages based on status code
        if (response.status === 400) {
          if (errorMessage.includes('Maximum retries')) {
            errorMessage = 'Maximum retry attempts (3) exceeded. Please contact your instructor for assistance.';
          } else if (errorMessage.includes('Current status')) {
            errorMessage = 'Cannot retry - feedback is not in a failed state.';
          }
        } else if (response.status === 404) {
          errorMessage = 'Feedback not found. Please refresh the page and try again.';
        } else if (response.status === 500) {
          errorMessage = 'Server error occurred. Please try again in a moment.';
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (!isMountedRef.current) return;

      // Reset state and restart polling
      setStatus(data.status || 'pending');
      setProgress(0);
      setError(null);
      setFeedback(null);

      // Start polling again
      if (!pollIntervalRef.current && enabled) {
        pollIntervalRef.current = setInterval(pollStatus, pollInterval);
      }

      return { success: true, message: data.message };
    } catch (err) {
      console.error('Error retrying feedback generation:', err);
      if (isMountedRef.current) {
        setError(err.message);
      }
      return { success: false, error: err.message };
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [answerId, canRetry, enabled, pollStatus, pollInterval]);

  // Start polling on mount
  useEffect(() => {
    if (!answerId || !enabled) return;

    // Initial poll
    pollStatus();

    // Set up polling interval
    pollIntervalRef.current = setInterval(pollStatus, pollInterval);

    // Cleanup
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [answerId, enabled, pollInterval, pollStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  return {
    status,
    progress,
    error,
    canRetry,
    feedback,
    loading,
    retryGeneration,
    retryCount,
    maxRetries,
    isGenerating: status === 'generating' || status === 'pending',
    isCompleted: status === 'completed',
    // Only consider it failed if status is explicitly failed/timeout AND canRetry is true
    // This prevents showing "failed" for pending states
    isFailed: (status === 'failed' || status === 'timeout') && canRetry,
  };
}
