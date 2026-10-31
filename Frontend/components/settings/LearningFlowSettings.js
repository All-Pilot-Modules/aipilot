'use client';

import { Switch } from '@/components/ui/switch';

const SUPPORT = [
  { value: 'ai', label: 'AI feedback', description: 'Explanations and improvement hints after each learning attempt.' },
  { value: 'answer', label: 'Correct answers', description: 'The stored answer key, without AI commentary. Available without waiting for AI when results release automatically.' },
  { value: 'both', label: 'AI feedback and correct answers', description: 'Explanations, hints, and the answer key together.' },
  { value: 'nothing', label: 'Wait until final submission', description: 'Withhold results from earlier attempts until the student submits the final attempt.' },
];

function Choices({ name, value, onChange, options }) {
  return <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
    {options.map(option => <label key={option.value}
      className={`flex items-start gap-3 p-4 cursor-pointer focus-within:ring-2 focus-within:ring-inset focus-within:ring-ring ${option.disabled ? 'cursor-not-allowed text-muted-foreground' : value === option.value ? 'bg-muted/70' : 'hover:bg-muted/30'}`}>
      <input type="radio" name={name} value={option.value} checked={value === option.value}
        disabled={option.disabled} onChange={() => onChange(option.value)}
        className="mt-1 h-4 w-4 shrink-0 accent-current" />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{option.label}</span>
        <span className="block mt-1 text-sm leading-relaxed text-muted-foreground">{option.description}</span>
      </span>
    </label>)}
  </div>;
}

export default function LearningFlowSettings({ formData, setFormData }) {
  const config = formData.assignment_config || {};
  const grading = config.grading || {};
  const attempts = config.features?.multiple_attempts || {};
  const count = attempts.max_attempts ?? 2;
  const holdEvery = grading.mode === 'manual';
  const timing = attempts.show_feedback_after_each ?? true;
  const answer = grading.show_correct_answer_to_student ?? false;
  const prose = grading.show_explanation_to_student ?? true;
  const support = !timing ? 'nothing' : answer && prose ? 'both' : answer ? 'answer' : prose ? 'ai' : 'custom';
  const final = (grading.final_attempt_mode || 'submit_only') === 'submit_only' ? 'teacher'
    : holdEvery || grading.require_teacher_approval ? 'review' : 'auto';
  const scores = grading.show_score_to_student ?? true;
  const patch = (gradePatch = {}, attemptPatch = {}) => setFormData(previous => ({
    ...previous,
    assignment_config: {
      ...previous.assignment_config,
      grading: { ...previous.assignment_config?.grading, ...gradePatch },
      features: { ...previous.assignment_config?.features,
        multiple_attempts: { ...previous.assignment_config?.features?.multiple_attempts, ...attemptPatch } },
    },
  }));
  const chooseSupport = value => patch(value === 'nothing' ? {} : {
    show_correct_answer_to_student: value === 'answer' || value === 'both',
    show_explanation_to_student: value === 'ai' || value === 'both',
    show_hints_to_student: value === 'ai' || value === 'both',
  }, { show_feedback_after_each: value !== 'nothing' });
  const contentLabel = answer && prose ? 'AI feedback and correct answers' : answer ? 'Correct answers' : prose ? 'AI feedback' : 'Score only';

  return <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,1fr)_280px]">
    <div className="min-w-0 space-y-8">
      <section aria-labelledby="learning-attempts-heading">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step 1 · Learning</p>
            <h3 id="learning-attempts-heading" className="mt-1 text-lg font-semibold">Before the final submission</h3>
          </div>
          <div>
            <label htmlFor="flow-attempts" className="block mb-1.5 text-sm font-medium">Total attempts</label>
            <select id="flow-attempts" value={count} onChange={event => {
              const total = Number(event.target.value);
              patch({}, { max_attempts: total, enabled: total > 1 });
            }} className="min-h-11 rounded-md border border-input bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring">
              {[1, 2, 3, 4, 5].map(total => <option key={total} value={total}>{total} {total === 1 ? 'attempt' : 'attempts'}</option>)}
            </select>
          </div>
        </div>
        {count > 1 ? <>
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground">{count - 1} learning {count === 2 ? 'attempt' : 'attempts'}, followed by one final submission. What should students receive while learning?</p>
          <fieldset>
            <legend className="sr-only">Learning support</legend>
            <Choices name="learning-support" value={support} onChange={chooseSupport} options={SUPPORT} />
          </fieldset>
          {support === 'custom' && <p className="mt-3 text-sm text-muted-foreground">This module uses a saved score-only configuration. Select a learning option to change it.</p>}
          {support === 'nothing' && <div className="mt-4 space-y-2">
            <label htmlFor="delayed-content" className="block text-sm font-medium">After final submission, show earlier results as</label>
            <select id="delayed-content" value={answer && prose ? 'both' : answer ? 'answer' : prose ? 'ai' : 'custom'}
              onChange={event => patch({
                show_correct_answer_to_student: ['answer', 'both'].includes(event.target.value),
                show_explanation_to_student: ['ai', 'both'].includes(event.target.value),
                show_hints_to_student: ['ai', 'both'].includes(event.target.value),
              })}
              className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring">
              {SUPPORT.filter(option => option.value !== 'nothing').map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              <option value="custom">Score only (if scores are enabled)</option>
            </select>
            <p className="text-sm text-muted-foreground">Teacher-held results still require release.</p>
          </div>}
        </> : <p className="rounded-lg bg-muted/50 p-4 text-sm leading-relaxed text-muted-foreground">With one attempt, students go straight to the final submission. Learning feedback choices are inactive.</p>}
      </section>

      <section aria-labelledby="final-grading-heading" className="border-t border-border pt-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step 2 · Assessment</p>
        <h3 id="final-grading-heading" className="mt-1 text-lg font-semibold">Who grades attempt {count}?</h3>
        <p className="mt-2 mb-4 text-sm leading-relaxed text-muted-foreground">Choose what happens to the final submission.</p>
        <fieldset>
          <legend className="sr-only">Final submission grading</legend>
          <Choices name="final-grading" value={final} onChange={value => patch({
            final_attempt_mode: value === 'teacher' ? 'submit_only' : 'learn',
            require_teacher_approval: value === 'review',
          })} options={[
            { value: 'teacher', label: 'I grade it myself', description: 'No final AI evaluation. Enter the final grade and feedback in Grading.' },
            { value: 'review', label: 'AI drafts; I review and release', description: 'Keep the AI evaluation private until you approve it. You can edit the grade and feedback before release.' },
            { value: 'auto', label: 'AI grades and releases automatically', disabled: holdEvery,
              description: holdEvery ? 'Turn off “Review every attempt” below to allow automatic release.' : 'Students receive the AI results without teacher approval, using the visibility choices below.' },
          ]} />
        </fieldset>
      </section>

      <section aria-labelledby="visibility-heading" className="border-t border-border pt-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step 3 · Visibility</p>
        <h3 id="visibility-heading" className="mt-1 text-lg font-semibold">What else can students see?</h3>
        <div className="flex items-start justify-between gap-6 py-5">
          <div>
            <label htmlFor="flow-scores" className="text-sm font-medium cursor-pointer">Show scores and correctness</label>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Applies to learning and final results, including teacher grades. Turn off for an answer-only research condition.</p>
          </div>
          <Switch id="flow-scores" checked={scores} onCheckedChange={value => patch({ show_score_to_student: value })} className="shrink-0 mt-1" />
        </div>
        {count === 1 && final !== 'teacher' ? <div className="space-y-2">
          <label htmlFor="single-attempt-content" className="block text-sm font-medium">Content in released AI results</label>
          <select id="single-attempt-content" value={support === 'nothing' ? (answer && prose ? 'both' : answer ? 'answer' : prose ? 'ai' : 'custom') : support}
            onChange={event => chooseSupport(event.target.value)}
            className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring">
            {SUPPORT.filter(option => option.value !== 'nothing').map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            <option value="custom">Score only (if scores are enabled)</option>
          </select>
        </div> : final !== 'teacher' && <p className="text-sm leading-relaxed text-muted-foreground">Final AI results use the same content choices as learning attempts: {contentLabel.toLowerCase()}. Teacher-written feedback is separate.</p>}
        <details className="mt-5 border-t border-border pt-4" open={holdEvery || undefined}>
          <summary className="cursor-pointer py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Review every attempt</summary>
          <div className="flex items-start justify-between gap-6 py-3">
            <div>
              <label htmlFor="flow-review-all" className="text-sm font-medium cursor-pointer">Require teacher release for all AI results</label>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Students wait for your review even during learning attempts. Leave this off for immediate learning support.</p>
            </div>
            <Switch id="flow-review-all" className="shrink-0 mt-1" checked={holdEvery} onCheckedChange={value => patch({
              mode: value ? 'manual' : 'auto',
              // Removing the all-attempt gate must not silently release final drafts.
              ...(holdEvery && final === 'review' ? { require_teacher_approval: true } : {}),
            })} />
          </div>
        </details>
      </section>
    </div>

    <aside aria-label="Student journey preview" className="xl:sticky xl:top-6 border-l-2 border-border pl-5 py-1">
      <h3 className="text-sm font-semibold">Student journey</h3>
      <p className="mt-1 text-xs text-muted-foreground">Preview of your current choices</p>
      <ol className="mt-6 space-y-6 text-sm">
        {count > 1 && <li>
          <p className="font-semibold">{count === 2 ? 'Attempt 1' : `Attempts 1–${count - 1}`}</p>
          <p className="mt-1 text-muted-foreground leading-relaxed">{timing ? contentLabel : 'Results withheld until final submission'}</p>
          {timing && <p className="mt-1 text-muted-foreground leading-relaxed">{holdEvery ? 'Waits for teacher release.' : support === 'answer' ? 'Answer key available after submission; no AI wait.' : 'Available when ready.'}</p>}
        </li>}
        <li>
          <p className="font-semibold">Attempt {count} · Final</p>
          <p className="mt-1 text-muted-foreground leading-relaxed">{final === 'teacher' ? 'Teacher grades the submission.' : final === 'review' ? 'AI draft → teacher review → release.' : 'AI evaluation → automatic release.'}</p>
        </li>
        <li className="border-t border-border pt-4">
          <p className="font-medium">Scores {scores ? 'visible when available' : 'hidden'}</p>
          <p className="mt-1 text-muted-foreground leading-relaxed">Changes apply after you save module settings.</p>
        </li>
      </ol>
    </aside>
  </div>;
}
