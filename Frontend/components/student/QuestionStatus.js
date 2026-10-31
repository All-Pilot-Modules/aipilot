// Colour is reserved for the three outcomes; everything else stays neutral.
export const STATUS_STYLES = {
  correct: { label: 'Correct', dot: 'bg-emerald-500' },
  partial: { label: 'Partly correct', dot: 'bg-amber-500' },
  incorrect: { label: 'Incorrect', dot: 'bg-rose-500' },
  reviewed: { label: 'Feedback ready', dot: 'bg-muted-foreground/60' },
  pending: { label: 'Awaiting feedback', dot: 'bg-muted-foreground/30' },
  unavailable: { label: 'Feedback unavailable', dot: 'bg-muted-foreground/30' },
  unanswered: { label: 'Not answered', dot: 'border border-muted-foreground/50 bg-transparent' },
};

export function StatusDot({ status, className = 'h-2 w-2' }) {
  return <span aria-hidden="true" className={`inline-block shrink-0 rounded-full ${STATUS_STYLES[status].dot} ${className}`} />;
}

export function QuestionStatusBadge({ status }) {
  return <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
    <StatusDot status={status} />
    {STATUS_STYLES[status].label}
  </span>;
}
