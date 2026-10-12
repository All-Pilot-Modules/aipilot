'use client';

import { useFeedbackPolling } from '@/hooks/useFeedbackPolling';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';

/**
 * Component to show feedback generation status and retry button for individual answers
 *
 * @param {string} answerId - The answer ID to poll feedback for
 * @param {boolean} hasFeedback - Whether feedback already exists (completed)
 * @param {function} onFeedbackComplete - Callback when feedback generation completes
 */
export function FeedbackStatusIndicator({ answerId, hasFeedback, onFeedbackComplete, initialStatus }) {
  // Only poll if feedback doesn't exist yet
  const {
    status,
    progress,
    error,
    canRetry,
    loading,
    retryGeneration,
    retryCount,
    maxRetries,
    isGenerating,
    isCompleted,
    isFailed,
  } = useFeedbackPolling(answerId, !hasFeedback);

  // Log for debugging
  console.log(`📊 FeedbackStatusIndicator for answer ${answerId}:`, {
    status,
    progress,
    error,
    canRetry,
    isGenerating,
    isCompleted,
    isFailed,
    initialStatus
  });

  // Call callback when feedback completes
  if (isCompleted && onFeedbackComplete) {
    onFeedbackComplete(answerId);
  }

  // Don't show anything if feedback is already complete
  // Note: We still show for failed/timeout statuses even if hasFeedback is true
  if (isCompleted) {
    return null;
  }

  // Show generating indicator
  if (isGenerating) {
    return (
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-300 animate-spin" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              Generating feedback...
            </p>
            <div className="w-full bg-blue-200 dark:bg-blue-900 rounded-full h-2 mt-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
              {progress}% complete
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show error and retry button ONLY if truly failed (not just pending)
  // Don't show error for pending state - that's normal during initial generation
  if (isFailed && canRetry) {
    return (
      <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-300 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-900 dark:text-red-100">
              Feedback generation failed
            </p>
            {error && (
              <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                {error}
              </p>
            )}
            {canRetry && (
              <Button
                onClick={retryGeneration}
                disabled={loading}
                size="sm"
                variant="outline"
                className="mt-3 border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/20"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry Generation {retryCount > 0 && `(${retryCount}/${maxRetries})`}
                  </>
                )}
              </Button>
            )}
            {!canRetry && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                Maximum retry attempts reached. Please contact your instructor.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
