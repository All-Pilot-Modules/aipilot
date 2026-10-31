import { MathText } from '@/components/MathText';

const nonEmpty = (list) => Array.isArray(list) && list.length > 0;

// Whether there is any written feedback to give its own column. Under the
// "correct answer only" condition there is none, and the answers take the
// full width instead of sitting beside an empty panel.
export function hasWrittenFeedback(feedback) {
  return Boolean(feedback.explanation?.trim() || nonEmpty(feedback.strengths) || nonEmpty(feedback.weaknesses)
    || feedback.improvement_hint || feedback.concept_explanation || feedback.teacher_grade);
}

function Section({ title, children }) {
  return <section className="space-y-2">
    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
    {children}
  </section>;
}

function Points({ items }) {
  return <ul className="space-y-1.5 pl-5">
    {items.map((item, idx) => <li key={idx} className="list-disc text-[15px] leading-relaxed marker:text-muted-foreground">
      <MathText inline>{item}</MathText>
    </li>)}
  </ul>;
}

export default function FeedbackPanel({ feedback, children }) {
  return <aside aria-label="Feedback" className="space-y-6 rounded-lg border border-border p-6">
    {feedback.teacher_grade && <Section title="Teacher's grade">
      <p className="text-lg font-semibold tabular-nums">
        {feedback.teacher_grade.points_awarded} / {feedback.points_possible} points
      </p>
      {feedback.teacher_grade.feedback_text && <MathText className="text-[15px] leading-relaxed whitespace-pre-wrap">
        {feedback.teacher_grade.feedback_text}
      </MathText>}
      {feedback.teacher_grade.graded_at && <p className="text-xs text-muted-foreground">
        Graded on {new Date(feedback.teacher_grade.graded_at).toLocaleDateString()}
      </p>}
    </Section>}

    {feedback.explanation?.trim() && <Section title="Feedback">
      <MathText className="text-[15px] leading-relaxed">{feedback.explanation}</MathText>
    </Section>}

    {nonEmpty(feedback.strengths) && <Section title="What you did well">
      <Points items={feedback.strengths} />
    </Section>}

    {nonEmpty(feedback.weaknesses) && <Section title="Areas to improve">
      <Points items={feedback.weaknesses} />
    </Section>}

    {feedback.improvement_hint && <Section title="Suggestion">
      <MathText className="text-[15px] leading-relaxed">{feedback.improvement_hint}</MathText>
    </Section>}

    {feedback.concept_explanation && <Section title="Key concept">
      <MathText className="text-[15px] leading-relaxed">{feedback.concept_explanation}</MathText>
    </Section>}

    {children}
  </aside>;
}
