'use client';
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/auth';
import { MathText } from '@/components/MathText';
import { Button } from '@/components/ui/button';
import LearningMemoryGraph from '@/components/LearningMemoryGraph';

export default function StudentLearningMemory({ moduleId, studentId, onAttempt }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!moduleId || !studentId) return;
    let current = true;
    setData(null); setError('');
    apiClient.get(`/api/modules/${encodeURIComponent(moduleId)}/students/${encodeURIComponent(studentId)}/learning-memory`)
      .then(result => { if(current) setData(result); })
      .catch(() => { if(current) setError('Learning history could not be loaded. Try again after the memory service is available.'); });
    return () => {current = false;};
  }, [moduleId, studentId, revision]);
  return <section className="my-6 rounded-xl border bg-background p-5 sm:p-6" aria-label="AI learning history">
    <div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-semibold">Learning memory</h2><p className="mt-1 text-sm text-muted-foreground">A connected view of observed learning across assignments. Each connection is backed by recorded evidence, not a model of the student’s thoughts.</p></div><Button variant="outline" size="sm" onClick={() => setRevision(v=>v+1)}>Refresh memory</Button></div>
    {error ? <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-300">{error}</p> : !data ? <p role="status" className="mt-4 text-sm text-muted-foreground">Loading learning history…</p> : <>
      {data.entries.length > 0 && <LearningMemoryGraph key={`${moduleId}:${studentId}:${revision}`} entries={data.entries.slice(0, 20)} onAttempt={onAttempt} />}
      {data.entries.length > 20 && <p className="mt-2 text-xs text-muted-foreground">The map shows the latest 20 attempts. Earlier entries remain in the journal below.</p>}
      {data.pending_entries > 0 && <p className="my-4 text-sm text-muted-foreground">{data.pending_entries} assignment entries awaiting complete feedback or memory generation.</p>}
      {data.failed_entries > 0 && <p role="status" className="my-4 text-sm text-amber-700 dark:text-amber-300">{data.failed_entries} learning summaries failed after retries. Assignment feedback is unaffected.</p>}
      {!data.entries.length && <p className="mt-5 text-sm text-muted-foreground">No learning observations yet. The AI adds an entry after assignment feedback is complete and released.</p>}
      <details className="mt-5"><summary className="cursor-pointer text-sm font-medium">Assignment journal · {data.entries.length} entries</summary><ol className="divide-y">{data.entries.map(entry=><li key={entry.id} className="py-4"><div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{new Date(entry.date).toLocaleDateString()} · Attempt {entry.attempt} · AI observation</span><button className="text-teal-700 underline underline-offset-4 dark:text-teal-400" onClick={()=>onAttempt?.(entry.attempt)}>View attempt {entry.attempt} answers</button></div><MathText>{entry.observations.summary}</MathText><details className="mt-3 text-xs text-muted-foreground"><summary className="cursor-pointer">Evidence · {entry.source_answer_ids.length} answers</summary><ul className="mt-2 space-y-1 break-all">{entry.source_answer_ids.map(id=><li key={id}>{id}</li>)}</ul></details></li>)}</ol></details>
    </>}
  </section>;
}
