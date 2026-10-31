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

// One status per question card, used for its colour and label. Scores the
// teacher has hidden arrive as null, so they fall through to a neutral
// "reviewed" instead of leaking correctness through the colour.
export function questionStatus(feedback, isAnswered) {
  if (!isAnswered) return 'unanswered';
  if (!feedback || ['pending', 'generating'].includes(feedback.generation_status)) return 'pending';
  if (['failed', 'timeout'].includes(feedback.generation_status)) return 'unavailable';

  let ratio = null;
  const awarded = feedback.teacher_grade?.points_awarded;
  if (awarded != null && feedback.points_possible) {
    ratio = awarded / feedback.points_possible;
  } else {
    const score = feedback.correctness_score ?? feedback.score;
    if (score != null) ratio = score > 1 ? score / 100 : score;
    else if (feedback.is_correct != null) ratio = feedback.is_correct ? 1 : 0;
  }

  if (ratio == null) return 'reviewed';
  if (ratio >= 1) return 'correct';
  return ratio > 0 ? 'partial' : 'incorrect';
}
