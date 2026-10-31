import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { MathText } from '@/components/MathText';

const criterionName = (criterion) => criterion.replaceAll('_', ' ');

// Hover (or keyboard focus) previews the per-criterion scores; clicking opens
// the full breakdown with the reasoning, which also covers touch devices.
export default function ScoreBreakdown({ feedback, questionNumber }) {
  const score = feedback.correctness_score ?? feedback.score;
  if (score == null) return null;
  const criteria = Object.entries(feedback.criterion_scores || {});
  const hasPoints = feedback.points_earned != null && feedback.points_possible != null;

  return <div className="flex items-center gap-2 text-sm">
    <span className="font-semibold tabular-nums">{score}%</span>
    {hasPoints && <span className="text-muted-foreground tabular-nums">{feedback.points_earned} / {feedback.points_possible} pts</span>}
    <Dialog>
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0"
              aria-label={`View score breakdown for question ${questionNumber}`}>
              <Eye className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end" sideOffset={4}
          className="w-64 border border-border bg-popover p-3 text-popover-foreground shadow-md"
          arrowClassName="bg-popover fill-popover">
          <p className="mb-2 text-xs font-semibold">Score breakdown</p>
          {criteria.length ? <ul className="space-y-1.5">
            {criteria.map(([criterion, detail]) => <li key={criterion} className="flex justify-between gap-3 text-xs">
              <span className="capitalize text-muted-foreground">{criterionName(criterion)}</span>
              <span className="font-semibold tabular-nums">{detail.score} / {detail.out_of}</span>
            </li>)}
          </ul> : <p className="text-xs text-muted-foreground">No per-criterion scores for this answer.</p>}
          {criteria.length > 0 && <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">Click for the reasoning behind each score.</p>}
        </TooltipContent>
      </Tooltip>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Score breakdown</DialogTitle>
          <DialogDescription>Question {questionNumber} · {score}%{hasPoints ? ` · ${feedback.points_earned} / ${feedback.points_possible} points` : ''}</DialogDescription>
        </DialogHeader>
        {criteria.length ? <dl className="divide-y divide-border">
          {criteria.map(([criterion, detail]) => <div key={criterion} className="py-4 first:pt-0">
            <dt className="flex flex-wrap justify-between gap-2 text-sm font-semibold">
              <span className="capitalize">{criterionName(criterion)}</span>
              <span>{detail.score} / {detail.out_of}</span>
            </dt>
            {detail.reasoning && <dd className="mt-2 text-muted-foreground"><MathText>{detail.reasoning}</MathText></dd>}
          </div>)}
        </dl> : <p className="text-sm leading-relaxed text-muted-foreground">A detailed scoring breakdown is not available for this answer.</p>}
      </DialogContent>
    </Dialog>
  </div>;
}
