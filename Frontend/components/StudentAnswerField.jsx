'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sigma, Trash2 } from 'lucide-react';

// Keep the existing answer format for autosave and grading; only the editing
// surface changes. Text stays text, and delimited expressions become editors.
import { splitAnswer } from "@/lib/studentAnswer.mjs";

function VisualEquation({ value, onChange, disabled, focus }) {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const change = useRef(onChange);
  change.current = onChange;
  useEffect(() => {
    let active = true;
    import('mathlive').then(() => { if (active) setReady(true); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const field = ref.current;
    if (!ready || !field) return;
    // Keep the visual insertion/editing menu functional for students. Hide
    // source-format actions and automatic solving, rather than emptying it.
    field.menuItems = field.menuItems.filter(item =>
      !['mode', 'copy', 'ce-evaluate', 'ce-simplify', 'ce-solve'].includes(item.id)
    );
    const input = () => change.current(field.value);
    field.addEventListener('input', input);
    if (focus) field.focus();
    return () => field.removeEventListener('input', input);
  }, [ready, focus]);
  useEffect(() => {
    const field = ref.current;
    if (!ready || !field) return;
    if (field.value !== value) field.value = value;
    field.readOnly = disabled;
  }, [ready, value, disabled]);
  if (failed) return <p role="alert" className="p-3 text-sm text-destructive">Equation editor could not load. Your answer is preserved; reload to try again.</p>;
  if (!ready) return <p className="p-3 text-sm text-muted-foreground">Loading equation editor…</p>;
  return <math-field ref={ref} aria-label="Edit equation" math-virtual-keyboard-policy="auto"
    style={{ display: 'block', width: '100%', minHeight: '3rem', fontSize: '1.2rem', background: 'transparent', color: 'inherit', border: 'none' }} />;
}

export function StudentAnswerField({ label, value = '', onChange, placeholder, rows = 3, disabled = false, id }) {
  const [parts, setParts] = useState(() => splitAnswer(value));
  const lastValue = useRef(value);
  const [focusIndex, setFocusIndex] = useState(-1);
  useEffect(() => {
    if (value !== lastValue.current) {
      setParts(splitAnswer(value));
      setFocusIndex(-1);
      lastValue.current = value;
    }
  }, [value]);
  const update = (next) => {
    setParts(next);
    const serialized = next.map(part => part.type === 'math' ? (part.value ? `$${part.value}$` : '') : part.value).join('');
    lastValue.current = serialized;
    onChange(serialized);
  };
  const edit = (index, text) => update(parts.map((part, i) => i === index ? { ...part, value: text } : part));
  const addEquation = () => {
    setFocusIndex(parts.length);
    update([...parts, { type: 'math', value: '' }, { type: 'text', value: '' }]);
  };
  const remove = (index) => {
    const next = [...parts];
    next.splice(index - 1, 3, { type: 'text', value: parts[index - 1].value + parts[index + 1].value });
    setFocusIndex(-1);
    update(next);
  };
  return <div className="space-y-2">
    {label && <Label htmlFor={id}>{label}</Label>}
    <div className="rounded-xl border border-border bg-background p-2 focus-within:ring-2 focus-within:ring-ring/30">
      {parts.map((part, index) => part.type === 'text' ?
        <Textarea key={index} id={index === 0 ? id : undefined} aria-label={index === 0 ? 'Your answer' : 'Continue your answer'}
          value={part.value} onChange={event => edit(index, event.target.value)} disabled={disabled}
          placeholder={index === 0 ? (placeholder || 'Write your answer…') : 'Continue writing…'}
          rows={parts.length === 1 ? rows : 1} className="min-h-10 resize-y border-0 shadow-none focus-visible:ring-0" /> :
        <div key={index} className="my-2 flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-2">
          <div className="min-w-0 flex-1 overflow-x-auto"><VisualEquation value={part.value} onChange={text => edit(index, text)} disabled={disabled} focus={focusIndex === index} /></div>
          {!disabled && <Button type="button" variant="ghost" size="icon" aria-label="Remove equation" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>}
        </div>)}
      {!disabled && <Button type="button" variant="ghost" size="sm" onClick={addEquation}><Sigma className="mr-2 h-4 w-4" />Add equation</Button>}
    </div>
    <p className="text-xs text-muted-foreground">Write in words, or add an equation and use the math keyboard for fractions, symbols, and matrices.</p>
  </div>;
}
