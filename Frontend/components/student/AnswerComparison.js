import { MathText } from '@/components/MathText';

function answerText(value) {
  if (value == null) return '';
  if (typeof value !== 'object') return String(value);
  return value.text_response ?? value.text ?? value.answer ?? value.selected_option_id ?? value.selected_option ?? '';
}

function ResponsePair({ answer, references = [] }) {
  const text = answerText(answer);
  return <div className="grid gap-4 md:grid-cols-2">
    <div className="min-w-0 rounded-lg border border-border p-4">
      <h4 className="text-sm font-semibold mb-2">Your answer</h4>
      <MathText className="text-base leading-relaxed whitespace-pre-wrap break-words">{text || 'No answer submitted.'}</MathText>
    </div>
    {references.length > 0 && <div className="min-w-0 rounded-lg border border-emerald-600/40 p-4">
      <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 mb-2">Correct / reference answer</h4>
      {references.map((entry, index) => <MathText key={index} className="text-base leading-relaxed whitespace-pre-wrap break-words">{entry.text}</MathText>)}
    </div>}
  </div>;
}

export default function AnswerComparison({ question, feedback }) {
  const raw = feedback.student_answer;
  const options = feedback.available_options && Object.keys(feedback.available_options).length
    ? feedback.available_options : question.options || {};
  const selected = feedback.selected_options ?? raw?.selected_options ?? [feedback.selected_option ?? raw?.selected_option_id ?? raw?.selected_option ?? (typeof raw === 'string' ? raw : null)].filter(Boolean);
  const correct = feedback.correct_options ?? [feedback.correct_option].filter(Boolean);
  const references = feedback.answer_key || [];

  if (Object.keys(options).length) {
    return <section aria-label="Answer comparison" className="space-y-3">
      <h4 className="text-sm font-semibold">Answer options</h4>
      <ul className="space-y-2">
        {Object.entries(options).map(([key, text]) => {
          const chosen = selected.includes(key);
          const right = correct.includes(key);
          return <li key={key} className={`flex items-start gap-3 rounded-lg border p-3 ${right ? 'border-emerald-600/50' : chosen ? 'border-foreground/40' : 'border-border'}`}>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border text-sm font-semibold">{key}</span>
            <div className="min-w-0 flex-1">
              <MathText className="text-base leading-relaxed break-words">{typeof text === 'string' ? text : text?.text || String(text)}</MathText>
              {(chosen || right) && <div className="mt-1 flex flex-wrap gap-3 text-xs font-medium">
                {chosen && <span className="text-muted-foreground">Your selection</span>}
                {right && <span className="text-emerald-700 dark:text-emerald-400">Correct answer</span>}
              </div>}
            </div>
          </li>;
        })}
      </ul>
      {!selected.length && <p className="text-sm text-muted-foreground">No option selected.</p>}
      {!correct.length && references.length > 0 && <ResponsePair answer={selected.length ? selected.map(key => `${key}. ${options[key] || ''}`).join('\n') : raw} references={references} />}
    </section>;
  }

  if (question.type === 'fill_blank') {
    const results = feedback.grading_details?.blank_results || [];
    const positions = [...new Set([
      ...Object.keys(raw?.blanks || {}), ...results.map(blank => String(blank.position)),
      ...(question.extended_config?.blanks || []).map(blank => String(blank.position)),
    ])];
    return <section aria-label="Answer comparison" className="space-y-4">{positions.map(position => {
      const result = results.find(blank => String(blank.position) === position);
      const label = `Blank ${Number(position) + 1}`;
      const refs = result?.accepted_answers?.map(text => ({ text })) || references.filter(entry => entry.label === label);
      return <div key={position}><h4 className="mb-2 text-sm font-semibold">{label}</h4><ResponsePair answer={raw?.blanks?.[position] ?? result?.student_answer} references={refs} /></div>;
    })}</section>;
  }

  if (question.type === 'multi_part') {
    const parts = question.extended_config?.sub_questions || [];
    const results = feedback.sub_results || [];
    const ids = [...new Set([...parts.map(part => part.id), ...Object.keys(raw?.sub_answers || {}), ...results.map(part => part.sub_id)])];
    return <section aria-label="Answer comparison" className="space-y-5">{ids.map(id => {
      const part = parts.find(item => item.id === id) || {};
      const result = results.find(item => item.sub_id === id) || {};
      return <div key={id} className="space-y-2">
        <h4 className="text-sm font-semibold">Part {id}</h4>
        {part.text && <MathText className="text-base">{part.text}</MathText>}
        <AnswerComparison question={part} feedback={{ ...result, student_answer: raw?.sub_answers?.[id] ?? result.student_answer,
          answer_key: result.correct_answer ? [{ text: result.correct_answer }] : references.filter(entry => entry.label === `Part ${id}`) }} />
      </div>;
    })}</section>;
  }

  return <section aria-label="Answer comparison" className="space-y-3">
    <ResponsePair answer={raw} references={references} />
    {feedback.answer_key_only && !references.length && <p className="text-sm text-muted-foreground">A reference answer has not been provided for this question.</p>}
  </section>;
}
