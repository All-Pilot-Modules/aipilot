// Only the queue can distinguish a recoverable provider error from an exhausted job.
export function feedbackCounts(status, attempt) {
  if (!status || Number(status.attempt) !== Number(attempt)) {
    return { failed: 0, retrying: 0 };
  }
  return {
    failed: status.feedback_failed || 0,
    retrying: status.feedback_retrying || 0,
  };
}
