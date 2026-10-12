import { memo } from 'react';
import { AlertCircle, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getErrorMessage, getRetrySuggestion } from '@/lib/errorMessages';

/**
 * User-friendly error alert component
 */
export const ErrorAlert = memo(({ error, onRetry, className = "" }) => {
  if (!error) return null;

  const message = getErrorMessage(error);
  const retrySuggestion = getRetrySuggestion(error);
  const isNetworkError = error?.message?.includes('fetch') || error?.message?.includes('Network');

  return (
    <div
      className={`bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 ${className}`}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div className="flex items-start gap-3">
        {isNetworkError ? (
          <WifiOff className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
        ) : (
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
        )}

        <div className="flex-1 space-y-2">
          <div>
            <h3 className="font-semibold text-red-900 dark:text-red-100">
              {isNetworkError ? 'Connection Problem' : 'Something went wrong'}
            </h3>
            <p className="text-sm text-red-800 dark:text-red-200 mt-1">
              {message}
            </p>
          </div>

          {retrySuggestion.canRetry && onRetry && (
            <div className="flex items-center gap-3">
              <Button
                onClick={onRetry}
                variant="outline"
                size="sm"
                className="bg-card dark:bg-muted border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/30"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                {retrySuggestion.message}
              </Button>

              {retrySuggestion.retryDelay > 0 && (
                <span className="text-xs text-red-700 dark:text-red-300">
                  Wait a moment before retrying
                </span>
              )}
            </div>
          )}

          {!retrySuggestion.canRetry && (
            <p className="text-xs text-red-700 dark:text-red-300">
              💡 {retrySuggestion.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
});

ErrorAlert.displayName = 'ErrorAlert';

/**
 * Inline error message (smaller, for forms)
 */
export const InlineError = memo(({ message, className = "" }) => {
  if (!message) return null;

  return (
    <div
      className={`flex items-center gap-2 text-sm text-red-600 dark:text-red-400 ${className}`}
      role="alert"
      aria-live="polite"
    >
      <AlertCircle className="w-4 h-4" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
});

InlineError.displayName = 'InlineError';

/**
 * Empty state with error
 */
export const EmptyStateError = memo(({ error, onRetry, title = "Nothing to show", className = "" }) => {
  const message = error ? getErrorMessage(error) : null;

  return (
    <div className={`text-center py-12 ${className}`}>
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
        {error ? (
          <AlertCircle className="w-8 h-8 text-red-500" />
        ) : (
          <WifiOff className="w-8 h-8 text-gray-400" />
        )}
      </div>

      <h3 className="text-lg font-semibold text-gray-900 dark:text-foreground mb-2">
        {title}
      </h3>

      {message && (
        <p className="text-sm text-gray-600 dark:text-muted-foreground mb-4 max-w-md mx-auto">
          {message}
        </p>
      )}

      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      )}
    </div>
  );
});

EmptyStateError.displayName = 'EmptyStateError';
