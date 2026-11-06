'use client';
import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { buildLearningMemoryGraph, layoutLearningMemoryTree, SIGNAL_ORDER } from '@/lib/learningMemoryGraph';
import { MathText } from '@/components/MathText';

// Colour is reserved for what the evidence says; structure stays neutral.
const SIGNALS = {
  demonstrated: { label: 'Showed understanding', color: '#10b981' },
  difficulty: { label: 'Struggled', color: '#f59e0b' },
  practice: { label: 'Practice next', color: '#0ea5e9' },
  mixed: { label: 'Mixed evidence', color: '#94a3b8' },
  uncertain: { label: 'Unclear evidence', color: '#94a3b8' },
};
const ROW = 64, GAP = 20, CARD_H = 52;
const ATTEMPT_W = 132, LEAF_X = 220;

const branch = (x1, y1, x2, y2) => {
  const mid = (x1 + x2) / 2;
  return `M${x1} ${y1} C${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
};
const formatDate = date => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export default function LearningMemoryGraph({ entries, onAttempt }) {
  const graph = useMemo(() => buildLearningMemoryGraph(entries), [entries]);
  const tree = useMemo(() => layoutLearningMemoryTree(graph, { row: ROW, gap: GAP }), [graph]);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [hidden, setHidden] = useState(() => new Set());

  const counts = useMemo(() => {
    const c = {};
    tree.leaves.forEach(({ node }) => { c[node.signal] = (c[node.signal] || 0) + 1; });
    return c;
  }, [tree]);
  const attemptY = new Map(tree.attempts.map(a => [a.node.id, a.y]));
  const query = search.trim().toLowerCase();
  const isVisible = node => !hidden.has(node.signal) && (!query || node.label.toLowerCase().includes(query));
  const selected = graph.nodes.find(n => n.id === selectedId);
  const linked = useMemo(() => {
    if (!selectedId) return null;
    const ids = new Set([selectedId]);
    graph.edges.forEach(e => { if (e.source === selectedId) ids.add(e.target); if (e.target === selectedId) ids.add(e.source); });
    return ids;
  }, [graph, selectedId]);
  const dimmed = node => !isVisible(node) || (linked && !linked.has(node.id));
  const toggleSignal = signal => setHidden(prev => {
    const next = new Set(prev);
    next.has(signal) ? next.delete(signal) : next.add(signal);
    return next;
  });
  const choose = id => setSelectedId(current => (current === id ? null : id));
  const visibleCount = tree.leaves.filter(l => isVisible(l.node)).length;

  return <div className="mt-5 overflow-hidden rounded-xl border border-border bg-card">
    {/* Toolbar: search + signal filters (doubles as the legend) */}
    <div className="flex flex-col gap-3 border-b border-border p-3 lg:flex-row lg:items-center">
      <div className="relative min-w-0 lg:w-72">
        <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input aria-label="Search learning memory" placeholder="Find a concept" value={search} onChange={e => setSearch(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-8 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        {search && <button aria-label="Clear search" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>}
      </div>
      <div role="group" aria-label="Show evidence types" className="flex flex-wrap gap-1.5">
        {SIGNAL_ORDER.filter(s => counts[s]).map(signal => {
          const on = !hidden.has(signal);
          return <button key={signal} aria-pressed={on} onClick={() => toggleSignal(signal)}
            className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${on ? 'border-border bg-background text-foreground' : 'border-dashed border-border bg-transparent text-muted-foreground line-through'}`}>
            <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: on ? SIGNALS[signal].color : 'transparent', boxShadow: on ? 'none' : `inset 0 0 0 1px ${SIGNALS[signal].color}` }} />
            {SIGNALS[signal].label}
            <span className="tabular-nums text-muted-foreground">{counts[signal]}</span>
          </button>;
        })}
      </div>
    </div>

    <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* Tree */}
      <div className="max-h-[560px] min-w-0 overflow-auto p-4 sm:p-5">
        <div className="relative min-w-[560px]" style={{ height: tree.height }}>
          <svg aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 overflow-visible" width={LEAF_X} height={tree.height}>
            {tree.leaves.flatMap(({ node, parents, y }) => parents.map(parentId => {
              const active = linked?.has(node.id) && linked?.has(parentId);
              return <path key={`${parentId}:${node.id}`} d={branch(ATTEMPT_W, attemptY.get(parentId), LEAF_X, y)} fill="none"
                stroke={active ? SIGNALS[node.signal].color : 'currentColor'} strokeWidth={active ? 2 : 1.25}
                className={`text-border transition-opacity ${dimmed(node) && !active ? 'opacity-30' : ''}`} />;
            }))}
          </svg>

          {tree.attempts.map(({ node, y }) => {
            const record = node.records[0];
            const isSelected = selectedId === node.id;
            return <button key={node.id} onClick={() => choose(node.id)} aria-pressed={isSelected}
              aria-label={`Attempt ${record.attempt}, ${formatDate(record.date)}`}
              className={`absolute left-0 flex flex-col justify-center rounded-lg border px-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isSelected ? 'border-foreground bg-foreground text-background' : 'border-border bg-background hover:border-foreground/40'} ${linked && !linked.has(node.id) ? 'opacity-50' : ''}`}
              style={{ top: y - CARD_H / 2, height: CARD_H, width: ATTEMPT_W }}>
              <span className="text-sm font-medium">Attempt {record.attempt}</span>
              <span className={`text-xs ${isSelected ? 'text-background/70' : 'text-muted-foreground'}`}>{formatDate(record.date)}</span>
            </button>;
          })}

          {tree.leaves.map(({ node, parents, y }) => {
            const isSelected = selectedId === node.id;
            const signal = SIGNALS[node.signal];
            return <button key={node.id} onClick={() => choose(node.id)} aria-pressed={isSelected}
              aria-label={`${node.label}. ${signal.label}. Seen in ${parents.length} ${parents.length === 1 ? 'attempt' : 'attempts'}.`}
              title={node.label}
              className={`absolute right-0 flex items-center gap-3 rounded-lg border px-3 text-left transition-[opacity,border-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isSelected ? 'border-foreground shadow-sm' : 'border-border hover:border-foreground/40'} bg-background ${dimmed(node) && !isSelected ? 'opacity-35' : ''}`}
              style={{ top: y - CARD_H / 2, height: CARD_H, left: LEAF_X }}>
              <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: signal.color }} />
              <span className="line-clamp-2 min-w-0 flex-1 text-[13px] leading-snug">{node.label}</span>
              {parents.length > 1 && <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">{parents.length} attempts</span>}
            </button>;
          })}
        </div>
        {visibleCount === 0 && <p className="mt-2 text-sm text-muted-foreground">Nothing matches. Clear the search or turn an evidence type back on.</p>}
      </div>

      {/* Evidence panel */}
      <aside aria-label="Memory evidence" aria-live="polite" className="min-w-0 border-t border-border p-5 lg:border-l lg:border-t-0">
        {selected ? <>
          <p className="text-xs text-muted-foreground">{selected.kind === 'attempt' ? 'Attempt summary' : selected.kind === 'concept' ? 'Concept' : 'Observation'}</p>
          <h3 className="mt-1 break-words font-semibold leading-snug"><MathText>{selected.label}</MathText></h3>
          {selected.kind !== 'attempt' && <p className="mt-2 text-xs text-muted-foreground">
            Recorded {selected.records.length} {selected.records.length === 1 ? 'time' : 'times'}. This is evidence from feedback, not a mastery score.
          </p>}
          <ol className="mt-4 max-h-[420px] space-y-4 overflow-y-auto">
            {selected.records.map((record, i) => <li key={`${record.id}:${i}`} className="border-t border-border pt-3 text-sm">
              <div className="mb-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>Attempt {record.attempt} · {formatDate(record.date)}</span>
                {record.detail && <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: SIGNALS[record.detail.signal]?.color }} />
                  {SIGNALS[record.detail.signal]?.label}
                </span>}
              </div>
              <MathText>{record.detail?.observation || record.observations.summary}</MathText>
              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{record.detail?.answer_ids?.length ?? record.source_answer_ids?.length ?? 0} supporting answers</span>
                <button className="font-medium text-foreground underline underline-offset-4 hover:no-underline" onClick={() => onAttempt?.(record.attempt)}>View answers</button>
              </div>
            </li>)}
          </ol>
        </> : <>
          <h3 className="font-medium">Select a card to see the evidence</h3>
          <p className="mt-2 text-sm text-muted-foreground">Each branch links an attempt to something its feedback recorded. When a concept comes up in more than one attempt, branches from each attempt meet at the same card.</p>
          <p className="mt-3 text-sm text-muted-foreground">{tree.attempts.length} {tree.attempts.length === 1 ? 'attempt' : 'attempts'} · {tree.leaves.length} observations</p>
        </>}
      </aside>
    </div>
  </div>;
}
