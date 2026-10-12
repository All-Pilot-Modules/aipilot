'use client';
import { useMemo, useState } from 'react';
import { buildLearningMemoryGraph } from '@/lib/learningMemoryGraph';
import { MathText } from '@/components/MathText';
import { Button } from '@/components/ui/button';

const colors = { memory: '#0f766e', demonstrated: '#0d9488', difficulty: '#d97706', mixed: '#8b5cf6', uncertain: '#64748b', practice: '#2563eb', attempt: '#64748b' };
const labels = { memory: 'Student learning memory', demonstrated: 'Demonstrated in this attempt', difficulty: 'Difficulty observed', mixed: 'Mixed evidence', uncertain: 'Uncertain evidence', practice: 'Suggested practice', attempt: 'Assignment attempt' };

export default function LearningMemoryGraph({ entries, onAttempt }) {
  const graph = useMemo(() => buildLearningMemoryGraph(entries), [entries]);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const selected = graph.nodes.find(node => node.id === selectedId && node.kind !== 'memory');
  const matches = graph.nodes.filter(node => node.label.toLowerCase().includes(search.toLowerCase()));
  const matchIds = new Set(matches.map(node => node.id));
  const lookup = new Map(graph.nodes.map(node => [node.id, node]));
  const bounds = useMemo(() => {
    if (!graph.nodes.length) return { x: 0, y: 0, w: 800, h: 520 };
    const xs = graph.nodes.map(n => n.x), ys = graph.nodes.map(n => n.y);
    const w = Math.max(800, Math.max(...xs) - Math.min(...xs) + 260);
    const h = Math.max(520, Math.max(...ys) - Math.min(...ys) + 140);
    return { x: (Math.min(...xs) + Math.max(...xs) - w) / 2, y: (Math.min(...ys) + Math.max(...ys) - h) / 2, w, h };
  }, [graph]);
  const visibleLabels = useMemo(() => {
    const placed = [], visible = new Set();
    const ordered = [...graph.nodes].sort((a, b) =>
      Number(b.id === selectedId) - Number(a.id === selectedId) ||
      Number(b.kind === 'memory') - Number(a.kind === 'memory') || Number(b.kind === 'attempt') - Number(a.kind === 'attempt'));
    for (const node of ordered) {
      const width = Math.min(node.label.length, 30) * 10 / zoom;
      if (!placed.some(p => Math.abs(node.x - p.x) < (width + p.width) / 2 + 12 / zoom && Math.abs(node.y - p.y) < 38 / zoom)) {
        placed.push({ x: node.x, y: node.y, width }); visible.add(node.id);
      }
    }
    return visible;
  }, [graph, selectedId, zoom]);
  const view = `${bounds.x + bounds.w * (1 - 1 / zoom) / 2 + pan.x} ${bounds.y + bounds.h * (1 - 1 / zoom) / 2 + pan.y} ${bounds.w / zoom} ${bounds.h / zoom}`;
  const select = node => { setSelectedId(node.id); setPan({ x: node.x - (bounds.x + bounds.w / 2), y: node.y - (bounds.y + bounds.h / 2) }); };
  return <div className="mt-5 overflow-hidden rounded-xl border border-border">
    <div className="flex flex-wrap items-center gap-2 border-b bg-muted/20 p-3">
      <input aria-label="Search learning memory" placeholder="Find a concept or observation…" value={search} onChange={e => setSearch(e.target.value)} className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm sm:min-w-60" />
      <Button variant="outline" size="sm" aria-label="Zoom out" disabled={zoom <= 0.5} onClick={() => setZoom(z => Math.max(0.5, z / 1.3))}>−</Button>
      <span className="w-12 text-center text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
      <Button variant="outline" size="sm" aria-label="Zoom in" disabled={zoom >= 4} onClick={() => setZoom(z => Math.min(4, z * 1.3))}>+</Button>
      <Button variant="ghost" size="sm" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>Fit map</Button>
    </div>
    <div className="grid lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 bg-muted/60 dark:bg-background/40">
        <svg viewBox={view} className="h-[420px] w-full sm:h-[520px]" role="group" aria-label="Learning memory graph. Select a node to inspect evidence.">
          {graph.edges.map(edge => { const a = lookup.get(edge.source), b = lookup.get(edge.target); return <line key={`${a.id}:${b.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="currentColor" className="text-slate-300 dark:text-muted-foreground" strokeWidth={selectedId === a.id || selectedId === b.id ? 2 : 1} />; })}
          {graph.nodes.map(node => <g key={node.id} transform={`translate(${node.x} ${node.y})`} role="button" tabIndex={0} aria-label={`${node.label}. ${labels[node.signal]}. ${node.records.length} observations`} aria-pressed={selectedId === node.id} onClick={() => setSelectedId(node.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(node.id); } }} className="cursor-pointer outline-none focus:stroke-teal-500" opacity={search && !matchIds.has(node.id) ? 0.2 : 1}>
            <title>{node.label}</title>
            <circle r="22" fill="transparent" />
            <circle r={node.kind === 'memory' ? 22 : node.kind === 'attempt' ? 13 : 9 + Math.min(node.records.length, 5)} fill={colors[node.signal]} stroke={selectedId === node.id ? 'currentColor' : 'transparent'} strokeWidth="3" />
            {visibleLabels.has(node.id) && <text y={node.kind === 'memory' ? 40 : 28} textAnchor="middle" fill="currentColor" stroke="none" className="text-[18px] font-medium">{node.label.length > 30 ? `${node.label.slice(0, 28)}…` : node.label}</text>}
          </g>)}
        </svg>
        <div className="flex flex-wrap items-center gap-2 px-3 pb-3" aria-label="Pan map">
          {[['←', -90, 0, 'Pan left'], ['↑', 0, -90, 'Pan up'], ['↓', 0, 90, 'Pan down'], ['→', 90, 0, 'Pan right']].map(([icon, x, y, label]) => <Button key={label} variant="outline" size="sm" aria-label={label} onClick={() => setPan(p => ({ x: p.x + x / zoom, y: p.y + y / zoom }))}>{icon}</Button>)}
          <span className="text-xs text-muted-foreground">Select any dot for details. Zoom in to reveal more labels.</span>
        </div>
      </div>
      <aside className="min-w-0 border-t p-4 lg:border-l lg:border-t-0" aria-label="Memory evidence">
        {selected ? <>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{selected.kind === 'concept' ? 'Concept evidence' : selected.kind === 'attempt' ? 'Assignment memory' : 'Journal observation'}</p>
          <h3 className="mt-2 break-words text-base font-semibold"><MathText>{selected.label}</MathText></h3>
          <p className="mt-2 text-xs text-muted-foreground">{selected.records.length} recorded {selected.records.length === 1 ? 'observation' : 'observations'}. These are evidence, not a mastery rating.</p>
          <ol className="mt-4 max-h-[380px] space-y-5 overflow-y-auto pr-2">{selected.records.map((record, i) => <li key={`${record.id}:${i}`} className="border-t pt-3 text-sm">
            <p className="mb-2 text-xs text-muted-foreground">{new Date(record.date).toLocaleDateString()} · Attempt {record.attempt}</p>
            {record.detail && <p className="mb-2 text-xs font-medium" style={{ color: colors[record.detail.signal] }}>{labels[record.detail.signal]}</p>}
            <MathText>{record.detail?.observation || record.observations.summary}</MathText>
            <p className="mt-2 text-xs text-muted-foreground">{record.detail?.answer_ids?.length ?? record.source_answer_ids?.length ?? 0} supporting answers{selected.kind === 'observation' ? ' · assignment-level evidence' : ''}</p>
            <button className="mt-2 text-teal-700 underline underline-offset-4 dark:text-teal-300" onClick={() => onAttempt?.(record.attempt)}>View attempt {record.attempt} answers</button>
          </li>)}</ol>
        </> : <><h3 className="font-medium">Explore this student’s learning</h3><p className="mt-2 text-sm text-muted-foreground">Select a node to see what was observed, when it happened, and the assignment behind it.</p><p className="mt-3 text-sm text-muted-foreground">Shared concepts connect across attempts. Older journals appear as separate observations until concept evidence is available.</p></>}
      </aside>
    </div>
    <div className="flex flex-wrap gap-x-4 gap-y-2 border-t px-4 py-3 text-xs text-muted-foreground">{Object.entries(labels).map(([key, label]) => <span key={key} className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: colors[key] }} />{label}</span>)}</div>
    <details className="border-t px-4 py-3 text-sm"><summary className="cursor-pointer">Browse nodes as a list ({matches.length})</summary><ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">{matches.map(node => <li key={node.id}><button onClick={() => select(node)} className="text-left text-teal-700 underline underline-offset-4 dark:text-teal-300">{node.label}</button></li>)}</ul>{!matches.length && <p className="mt-2 text-muted-foreground">No matching concepts or observations.</p>}</details>
  </div>;
}
