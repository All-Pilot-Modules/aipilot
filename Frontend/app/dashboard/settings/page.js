'use client';

import { useAuth } from "@/context/AuthContext";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Slider } from "@/components/ui/slider";
import ConsentFormEditor from "@/components/ConsentFormEditor";
import {
  Brain, Eye, EyeOff, PenLine,
  Loader2, Check, AlertCircle,
  Globe, Lock, ChevronRight,
  GraduationCap, RotateCcw,
  Plus, Trash2, ClipboardList, Info,
  BarChart3, Pencil, Copy, Link2,
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useCallback, Suspense } from "react";
import { apiClient } from "@/lib/auth";

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'general',  label: 'General'  },
  { id: 'grading',  label: 'Grading'  },
  { id: 'features', label: 'Features' },
  { id: 'chatbot',  label: 'Chatbot'  },
  { id: 'survey',   label: 'Survey'   },
  { id: 'consent',  label: 'Consent'  },
];

const SHARED_SAVE_TABS = new Set(['general', 'grading', 'features']);

const GRADING_MODES = [
  {
    value: 'ai_visible',
    label: 'AI Grading',
    sub: 'Automated',
    description: 'AI evaluates and returns score, explanation, and hints to students immediately.',
    icon: Brain,
  },
  {
    value: 'teacher_assist',
    label: 'Reviewed by instructor',
    sub: 'Supervised',
    description: 'AI drafts grade for instructor review. Students see nothing until released.',
    icon: Eye,
  },
  {
    value: 'ai_teacher_only',
    label: 'AI — hidden from students',
    sub: 'Private',
    description: 'AI grades automatically. Scores recorded for instructor only.',
    icon: EyeOff,
  },
  {
    value: 'manual',
    label: 'Manual grading',
    sub: 'Manual',
    description: 'No AI. Instructor reads and assigns points for each response.',
    icon: PenLine,
  },
];

const GRADING_MODE_MAP = {
  ai_visible:      'auto',
  teacher_assist:  'teacher_assist',
  ai_teacher_only: 'teacher_only',
  manual:          'disabled',
};

// ─── Layout primitives ────────────────────────────────────────────────────────

// A horizontal settings row — label/desc on left, control on right
function Row({ label, description, children, noBorder = false }) {
  return (
    <div className={`py-5 flex items-start gap-8 ${noBorder ? '' : 'border-b border-gray-100 dark:border-border'}`}>
      <div className="w-64 shrink-0">
        <p className="text-sm font-medium text-gray-900 dark:text-foreground">{label}</p>
        {description && <p className="text-sm text-gray-500 dark:text-muted-foreground mt-0.5 leading-snug">{description}</p>}
      </div>
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}

function SectionHeading({ children }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-muted-foreground mb-1 pt-2">
      {children}
    </p>
  );
}

// Inline save status pill for standalone tabs
function SaveStatus({ state }) {
  if (!state) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${state === 'error' ? 'text-red-500' : state === 'saved' ? 'text-emerald-600' : 'text-gray-400'}`}>
      {state === 'saving' && <Loader2 className="w-3 h-3 animate-spin" />}
      {state === 'saved'  && <Check className="w-3 h-3" />}
      {state === 'error'  && <AlertCircle className="w-3 h-3" />}
      {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : 'Error — try again'}
    </span>
  );
}

// ─── Tab content: General ─────────────────────────────────────────────────────

function GeneralTab({ formData, set }) {
  return (
    <div>
      <SectionHeading>Course details</SectionHeading>
      <Row label="Module title" description="The name students see when they enroll.">
        <Input value={formData.name} onChange={e => set('name', e.target.value)} className="h-9 text-sm" />
      </Row>
      <Row label="Description" description="Displayed on the module enrollment card.">
        <Textarea value={formData.description} onChange={e => set('description', e.target.value)} rows={3} className="resize-none text-sm" />
      </Row>
      <Row label="Student instructions" description="Shown at the top of the assignment before students begin.">
        <Textarea value={formData.instructions} onChange={e => set('instructions', e.target.value)} rows={4} className="resize-none text-sm" />
      </Row>

      <SectionHeading className="mt-6">Scheduling &amp; visibility</SectionHeading>
      <Row label="Submission deadline" description="Students cannot submit after this date.">
        <Input type="date" value={formData.due_date} onChange={e => set('due_date', e.target.value)} className="h-9 text-sm" />
      </Row>
      <Row label="Enrollment visibility" description="Who can discover and join this module.">
        <Select value={formData.visibility} onValueChange={v => set('visibility', v)}>
          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="class-only">
              <span className="flex items-center gap-2"><Lock className="w-3.5 h-3.5 text-gray-400" /> Enrolled students only</span>
            </SelectItem>
            <SelectItem value="public">
              <span className="flex items-center gap-2"><Globe className="w-3.5 h-3.5 text-gray-400" /> Public discovery</span>
            </SelectItem>
          </SelectContent>
        </Select>
      </Row>
      <SectionHeading>Access</SectionHeading>
      <Row label="Module active" description="When off, enrolled students cannot open the module or submit responses.">
        <div className="flex items-center h-9">
          <Switch checked={formData.is_active} onCheckedChange={v => set('is_active', v)} />
        </div>
      </Row>
      <Row label="Require research consent" description="Students must complete the IRB consent form before seeing any questions." noBorder>
        <div className="flex items-center h-9">
          <Switch checked={formData.consent_required} onCheckedChange={v => set('consent_required', v)} />
        </div>
      </Row>
    </div>
  );
}

// ─── Tab content: Grading ─────────────────────────────────────────────────────

const TONES = [
  { value: 'encouraging', label: 'Friendly' },
  { value: 'neutral',     label: 'Balanced' },
  { value: 'strict',      label: 'Direct'   },
];

const GRADING_SECTIONS = [
  { id: 'policy',   label: 'Policy'   },
  { id: 'criteria', label: 'Criteria' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'scoring',  label: 'Scoring'  },
];

function GradingTab({ formData, setGradingMode, moduleId }) {
  const gradingMode = formData.assignment_config?.grading?.mode || 'ai_visible';
  const [section, setSection] = useState('policy');

  const [rubric, setRubric] = useState(null);
  const [originalRubric, setOriginalRubric] = useState(null);
  const [rubricLoading, setRubricLoading] = useState(true);
  const [rubricSaving, setRubricSaving] = useState(false);
  const [rubricHasChanges, setRubricHasChanges] = useState(false);
  const [rubricSaveState, setRubricSaveState] = useState(null);
  const [editingCriterion, setEditingCriterion] = useState(null);

  useEffect(() => {
    if (!moduleId) return;
    (async () => {
      try {
        setRubricLoading(true);
        const rubricData = await apiClient.get(`/api/modules/${moduleId}/rubric`);
        setRubric(rubricData.rubric);
        setOriginalRubric(rubricData.rubric);
      } catch (e) { console.error(e); }
      finally { setRubricLoading(false); }
    })();
  }, [moduleId]);

  useEffect(() => {
    if (rubric && originalRubric)
      setRubricHasChanges(JSON.stringify(rubric) !== JSON.stringify(originalRubric));
  }, [rubric, originalRubric]);

  const handleRubricSave = async () => {
    if (!moduleId || !rubric) return;
    setRubricSaving(true); setRubricSaveState('saving');
    try {
      await apiClient.put(`/api/modules/${moduleId}/rubric`, {
        enabled: true,
        feedback_style: rubric.feedback_style,
        custom_instructions: rubric.custom_instructions,
        rag_settings: rubric.rag_settings,
        grading_criteria: rubric.grading_criteria,
        question_type_settings: rubric.question_type_settings,
        grading_thresholds: rubric.grading_thresholds,
      });
      setOriginalRubric(rubric); setRubricHasChanges(false);
      setRubricSaveState('saved'); setTimeout(() => setRubricSaveState(null), 2500);
    } catch (e) {
      console.error(e);
      setRubricSaveState('error'); setTimeout(() => setRubricSaveState(null), 3000);
    } finally { setRubricSaving(false); }
  };

  // Criteria helpers
  const criteria = rubric?.grading_criteria || {};
  const totalWeight = Object.values(criteria).reduce((sum, c) => sum + (c.weight || 0), 0);
  const isWeightValid = Math.abs(totalWeight - 100) < 1;

  const addCriterion = () => {
    const newKey = `criterion_${Date.now()}`;
    setRubric(prev => ({ ...prev, grading_criteria: { ...prev?.grading_criteria, [newKey]: { name: 'New criterion', description: '', weight: 25 } } }));
    setEditingCriterion(newKey);
  };
  const updateCriterion = (key, updates) =>
    setRubric(prev => ({ ...prev, grading_criteria: { ...prev?.grading_criteria, [key]: { ...prev?.grading_criteria?.[key], ...updates } } }));
  const deleteCriterion = (key) => {
    setRubric(prev => { const c = { ...prev?.grading_criteria }; delete c[key]; return { ...prev, grading_criteria: c }; });
    if (editingCriterion === key) setEditingCriterion(null);
  };
  const distributeEvenly = () => {
    const count = Object.keys(criteria).length;
    if (!count) return;
    const even = Math.floor(100 / count);
    const rem = 100 - even * count;
    const newC = {};
    Object.keys(criteria).forEach((k, i) => { newC[k] = { ...criteria[k], weight: even + (i < rem ? 1 : 0) }; });
    setRubric(prev => ({ ...prev, grading_criteria: newC }));
  };

  const setRubricField = (key, val) => setRubric(prev => ({ ...prev, [key]: val }));
  const setFeedbackTone = (tone) => setRubric(prev => ({ ...prev, feedback_style: { ...prev?.feedback_style, tone } }));
  const setRagSetting  = (key, val) => setRubric(prev => ({ ...prev, rag_settings: { ...prev?.rag_settings, [key]: val } }));
  const setThreshold   = (key, val) => setRubric(prev => ({ ...prev, grading_thresholds: { ...prev?.grading_thresholds, [key]: val } }));

  const selectedTone = rubric?.feedback_style?.tone || 'encouraging';
  const ragSettings  = rubric?.rag_settings || {};
  const thresholds   = rubric?.grading_thresholds || {};

  const isRubricSection = section !== 'policy';

  return (
    <div>
      {/* ── Segmented section selector ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-muted rounded-lg">
          {GRADING_SECTIONS.map(s => (
            <button key={s.id} onClick={() => setSection(s.id)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${section === s.id ? 'bg-white dark:bg-card shadow-sm text-gray-900 dark:text-foreground' : 'text-gray-500 dark:text-muted-foreground hover:text-gray-700 dark:hover:text-foreground'}`}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Rubric save — visible when not on Policy */}
        {isRubricSection && (
          <div className="flex items-center gap-2">
            <SaveStatus state={rubricSaveState} />
            {rubricHasChanges && (
              <Button variant="outline" size="sm" onClick={() => { setRubric(originalRubric); setRubricHasChanges(false); }} disabled={rubricSaving} className="h-8 text-xs">
                <RotateCcw className="w-3 h-3 mr-1" />Discard
              </Button>
            )}
            <Button size="sm" onClick={handleRubricSave} disabled={rubricSaving || !rubricHasChanges}
              className="h-8 text-xs bg-gray-900 hover:bg-gray-800 text-white">
              {rubricSaving ? <><Loader2 className="w-3 h-3 animate-spin mr-1" />Saving…</> : 'Save rubric'}
            </Button>
          </div>
        )}
      </div>

      {/* ── Policy ── */}
      {section === 'policy' && (
        <div>
          <p className="text-sm text-gray-500 dark:text-muted-foreground mb-5">
            Select how student responses will be evaluated for this module.
          </p>
          <div className="divide-y divide-gray-100 dark:divide-border">
            {GRADING_MODES.map(({ value, label, description, icon: Icon }) => {
              const active = gradingMode === value;
              return (
                <button key={value} type="button" onClick={() => setGradingMode(value)}
                  className="w-full flex items-center gap-4 py-4 text-left hover:bg-gray-50 dark:hover:bg-muted/20 transition-colors -mx-6 px-6">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${active ? 'border-gray-900 dark:border-gray-300' : 'border-gray-300 dark:border-border'}`}>
                    {active && <div className="w-2 h-2 rounded-full bg-gray-900 dark:bg-gray-400" />}
                  </div>
                  <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-gray-900 dark:text-gray-300' : 'text-gray-400 dark:text-muted-foreground'}`} />
                  <div className="min-w-0">
                    <p className={`text-sm font-medium ${active ? 'text-gray-900 dark:text-foreground' : 'text-gray-700 dark:text-foreground'}`}>{label}</p>
                    <p className="text-xs text-gray-400 dark:text-muted-foreground mt-0.5">{description}</p>
                  </div>
                </button>
              );
            })}
          </div>
          {gradingMode === 'teacher_assist' && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 mt-4">
              <Info className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Pending reviews appear as a badge on the Grading tab. Students see no results until you explicitly release each evaluation.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Rubric sections (Criteria / Feedback / Scoring) ── */}
      {isRubricSection && (rubricLoading || !moduleId) && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
        </div>
      )}

      {isRubricSection && !rubricLoading && moduleId && (
        <>
          {/* ── Criteria ── */}
          {section === 'criteria' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-500 dark:text-muted-foreground">Define what the AI evaluates and how much each area is worth.</p>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${isWeightValid ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400' : 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400'}`}>
                    {totalWeight}% total
                  </span>
                  {Object.keys(criteria).length > 1 && (
                    <Button variant="outline" size="sm" onClick={distributeEvenly} className="h-8 text-xs gap-1">
                      <BarChart3 className="w-3 h-3" />Equal weights
                    </Button>
                  )}
                  <Button size="sm" onClick={addCriterion} className="h-8 text-xs gap-1 bg-gray-900 dark:bg-foreground text-white dark:text-background hover:bg-gray-700 dark:hover:bg-foreground/90">
                    <Plus className="w-3 h-3" />Add criterion
                  </Button>
                </div>
              </div>

              {Object.keys(criteria).length === 0 ? (
                <div className="text-center py-14 border border-dashed border-gray-200 dark:border-border rounded-lg">
                  <p className="text-sm text-gray-400 dark:text-muted-foreground mb-3">No criteria defined yet</p>
                  <Button variant="outline" size="sm" onClick={addCriterion} className="text-xs gap-1">
                    <Plus className="w-3 h-3" />Add first criterion
                  </Button>
                </div>
              ) : (
                <div className="border border-gray-100 dark:border-border rounded-lg overflow-hidden">
                  <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-gray-50 dark:bg-muted/20 text-xs font-medium text-gray-400 dark:text-muted-foreground border-b border-gray-100 dark:border-border">
                    <div className="col-span-3">Name</div>
                    <div className="col-span-5">Description</div>
                    <div className="col-span-3">Weight</div>
                    <div className="col-span-1" />
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-border">
                    {Object.entries(criteria).map(([key, c]) => (
                      <div key={key}>
                        {editingCriterion === key ? (
                          <div className="p-4 bg-gray-50/40 dark:bg-muted/20/10 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs text-gray-500 dark:text-muted-foreground mb-1.5 block">Name</Label>
                                <Input value={c.name || ''} onChange={e => updateCriterion(key, { name: e.target.value })} className="h-8 text-sm" />
                              </div>
                              <div>
                                <Label className="text-xs text-gray-500 dark:text-muted-foreground mb-1.5 block">Weight — {c.weight || 0}%</Label>
                                <Slider value={[c.weight || 0]} onValueChange={([v]) => updateCriterion(key, { weight: v })} min={0} max={100} step={5} className="mt-3" />
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs text-gray-500 dark:text-muted-foreground mb-1.5 block">Description</Label>
                              <Textarea value={c.description || ''} onChange={e => updateCriterion(key, { description: e.target.value })} rows={2} className="text-sm resize-none" />
                            </div>
                            <div className="flex justify-end">
                              <Button variant="outline" size="sm" onClick={() => setEditingCriterion(null)} className="h-7 text-xs">Done</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-gray-50 dark:hover:bg-muted/10 transition-colors">
                            <div className="col-span-3">
                              <p className="text-sm font-medium text-gray-800 dark:text-foreground truncate">{c.name || key}</p>
                            </div>
                            <div className="col-span-5">
                              <p className="text-xs text-gray-400 dark:text-muted-foreground line-clamp-2">{c.description || '—'}</p>
                            </div>
                            <div className="col-span-3 flex items-center gap-2">
                              <Slider value={[c.weight || 0]} onValueChange={([v]) => updateCriterion(key, { weight: v })} min={0} max={100} step={5} className="flex-1" />
                              <span className="text-xs font-medium text-gray-500 dark:text-muted-foreground w-8 text-right shrink-0">{c.weight || 0}%</span>
                            </div>
                            <div className="col-span-1 flex items-center justify-end gap-0.5">
                              <button onClick={() => setEditingCriterion(key)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-muted text-gray-300 hover:text-gray-600 dark:hover:text-foreground transition-colors">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => deleteCriterion(key)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/20 text-gray-300 hover:text-red-400 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Feedback ── */}
          {section === 'feedback' && (
            <div>
              <Row label="Feedback tone" description="How the AI communicates with students.">
                <div className="flex items-center gap-0.5 p-0.5 bg-gray-100 dark:bg-muted rounded-lg w-fit">
                  {TONES.map(t => (
                    <button key={t.value} onClick={() => setFeedbackTone(t.value)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${selectedTone === t.value ? 'bg-white dark:bg-card shadow-sm text-gray-900 dark:text-foreground' : 'text-gray-500 dark:text-muted-foreground hover:text-gray-700 dark:hover:text-foreground'}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </Row>
              <Row label="Custom instructions" description="Additional guidance for AI feedback (optional)." noBorder>
                <div>
                  <Textarea
                    value={rubric?.custom_instructions || ''}
                    onChange={e => setRubricField('custom_instructions', e.target.value)}
                    placeholder="E.g., Focus on mathematical accuracy and proper notation…"
                    rows={4}
                    maxLength={300}
                    className="resize-none text-sm"
                  />
                  <p className="text-xs text-gray-400 dark:text-muted-foreground mt-1 text-right">{(rubric?.custom_instructions || '').length} / 300</p>
                </div>
              </Row>
            </div>
          )}

          {/* ── Scoring ── */}
          {section === 'scoring' && (
            <div>
              <Row label="Passing score" description="Minimum score required for students to pass.">
                <div className="flex items-center gap-4">
                  <Slider value={[thresholds.passing_score ?? 60]} onValueChange={([v]) => setThreshold('passing_score', v)} min={0} max={100} step={1} className="flex-1" />
                  <span className="text-sm font-semibold text-gray-700 dark:text-foreground w-10 text-right shrink-0">{thresholds.passing_score ?? 60}%</span>
                </div>
              </Row>
              <Row label="Partial credit" description="Students earn points for partially correct answers.">
                <div className="flex items-center h-9">
                  <Switch checked={thresholds.partial_credit ?? true} onCheckedChange={v => setThreshold('partial_credit', v)} />
                </div>
              </Row>

              <SectionHeading>Course materials</SectionHeading>
              <Row label="Reference uploaded files" description="AI draws on your uploaded documents when giving feedback.">
                <div className="flex items-center h-9">
                  <Switch checked={ragSettings.enabled ?? true} onCheckedChange={v => setRagSetting('enabled', v)} />
                </div>
              </Row>
              {(ragSettings.enabled ?? true) && (
                <>
                  <Row label="Document sections" description="Number of relevant sections to pull per response.">
                    <div className="flex items-center gap-4">
                      <Slider value={[ragSettings.max_context_chunks ?? 3]} onValueChange={([v]) => setRagSetting('max_context_chunks', v)} min={1} max={5} step={1} className="flex-1" />
                      <span className="text-sm font-semibold text-gray-700 dark:text-foreground w-6 text-right shrink-0">{ragSettings.max_context_chunks ?? 3}</span>
                    </div>
                  </Row>
                  <Row label="Show source references" description="Include links to specific course sections in feedback." noBorder>
                    <div className="flex items-center h-9">
                      <Switch checked={ragSettings.include_source_references ?? true} onCheckedChange={v => setRagSetting('include_source_references', v)} />
                    </div>
                  </Row>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Tab content: Features ────────────────────────────────────────────────────

function Stepper({ value, min = 1, max = 10, onChange }) {
  return (
    <div className="flex items-center gap-0 border border-gray-200 dark:border-border rounded-lg overflow-hidden w-fit">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="w-8 h-8 flex items-center justify-center text-gray-500 dark:text-muted-foreground hover:bg-gray-50 dark:hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-lg leading-none"
      >
        −
      </button>
      <span className="w-8 text-center text-sm font-semibold text-gray-800 dark:text-foreground border-x border-gray-200 dark:border-border h-8 flex items-center justify-center">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="w-8 h-8 flex items-center justify-center text-gray-500 dark:text-muted-foreground hover:bg-gray-50 dark:hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-lg leading-none"
      >
        +
      </button>
    </div>
  );
}

function FeaturesTab({ formData, setFeature }) {
  const feat = formData.assignment_config?.features || {};

  return (
    <div>
      <SectionHeading>Assignment features</SectionHeading>

      {/* Multiple attempts */}
      <Row label="Multiple attempts" description="Allow students to submit more than once.">
        <div className="flex items-center h-9">
          <Switch checked={feat.multiple_attempts?.enabled ?? true} onCheckedChange={v => setFeature('multiple_attempts', 'enabled', v)} />
        </div>
      </Row>
      {feat.multiple_attempts?.enabled && (
        <>
          <Row label="Maximum attempts" description="How many times a student can submit.">
            <Stepper
              value={feat.multiple_attempts?.max_attempts ?? 2}
              min={1} max={5}
              onChange={v => setFeature('multiple_attempts', 'max_attempts', v)}
            />
          </Row>
          <Row label="Feedback between attempts" description="Show AI feedback after each submission.">
            <div className="flex items-center h-9">
              <Switch checked={feat.multiple_attempts?.show_feedback_after_each ?? true} onCheckedChange={v => setFeature('multiple_attempts', 'show_feedback_after_each', v)} />
            </div>
          </Row>
        </>
      )}

      {/* AI Chatbot */}
      <Row label="AI tutoring assistant" description="Conversational AI available to students during the assignment.">
        <div className="flex items-center h-9">
          <Switch checked={feat.chatbot_feedback?.enabled ?? true} onCheckedChange={v => setFeature('chatbot_feedback', 'enabled', v)} />
        </div>
      </Row>
      {feat.chatbot_feedback?.enabled && (
        <div className="pb-4 border-b border-gray-100 dark:border-border -mt-1">
          <p className="text-xs text-gray-400 dark:text-muted-foreground pl-0">
            Customize tone and instructions in the <strong className="text-gray-600 dark:text-foreground">Chatbot</strong> tab.
          </p>
        </div>
      )}

      {/* Mastery learning */}
      <Row label="Mastery learning" description="Adaptive practice queue until the student demonstrates proficiency." noBorder={!feat.mastery_learning?.enabled}>
        <div className="flex items-center h-9">
          <Switch checked={feat.mastery_learning?.enabled ?? false} onCheckedChange={v => setFeature('mastery_learning', 'enabled', v)} />
        </div>
      </Row>
      {feat.mastery_learning?.enabled && (
        <>
          <Row label="Consecutive correct" description="Correct answers in a row needed to complete mastery.">
            <Stepper
              value={feat.mastery_learning?.streak_required ?? 3}
              min={1} max={10}
              onChange={v => setFeature('mastery_learning', 'streak_required', v)}
            />
          </Row>
          <Row label="Randomize order" description="Shuffle question order on each practice attempt.">
            <div className="flex items-center h-9">
              <Switch checked={feat.mastery_learning?.queue_randomization ?? true} onCheckedChange={v => setFeature('mastery_learning', 'queue_randomization', v)} />
            </div>
          </Row>
          <Row label="Reset streak on wrong" description="A wrong answer resets the consecutive-correct count." noBorder>
            <div className="flex items-center h-9">
              <Switch checked={feat.mastery_learning?.reset_on_wrong ?? false} onCheckedChange={v => setFeature('mastery_learning', 'reset_on_wrong', v)} />
            </div>
          </Row>
        </>
      )}
    </div>
  );
}

// ─── Standalone tabs ──────────────────────────────────────────────────────────

function SpinnerBox() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
    </div>
  );
}

function StandaloneHeader({ title, description, saveState, hasChanges, isSaving, onSave, onDiscard, extraActions }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-foreground">{title}</p>
        {description && <p className="text-sm text-gray-500 dark:text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {extraActions}
        <SaveStatus state={saveState} />
        {hasChanges && onDiscard && (
          <Button variant="outline" size="sm" onClick={onDiscard} disabled={isSaving} className="h-8 text-xs">
            <RotateCcw className="w-3 h-3 mr-1.5" />Discard
          </Button>
        )}
        <Button size="sm" onClick={onSave} disabled={isSaving || !hasChanges}
          className="h-8 text-xs bg-gray-900 hover:bg-gray-800 text-white">
          {isSaving ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />Saving…</> : 'Save changes'}
        </Button>
      </div>
    </div>
  );
}


function ChatbotTab({ moduleId }) {
  const [data, setData] = useState(null);
  const [instructions, setInstructions] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState(null);

  const load = useCallback(async () => {
    if (!moduleId) return;
    try {
      setLoading(true);
      const response = await apiClient.get(`/api/modules/${moduleId}/chatbot-instructions`);
      setData(response);
      setInstructions(response.chatbot_instructions || '');
      setIsCustom(response.is_custom || false);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [moduleId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!moduleId || !instructions.trim()) return;
    setSaving(true); setSaveState('saving');
    try {
      await apiClient.put(`/api/modules/${moduleId}/chatbot-instructions`, { instructions });
      setIsCustom(true);
      setSaveState('saved'); setTimeout(() => setSaveState(null), 2500);
    } catch (e) {
      console.error(e);
      setSaveState('error'); setTimeout(() => setSaveState(null), 3000);
    } finally { setSaving(false); }
  };

  const charCount = instructions.length;
  const maxChars = 5000;

  if (!moduleId || loading) return <SpinnerBox />;

  return (
    <>
      <StandaloneHeader
        title="Chatbot instructions"
        description="Define how the AI tutor should respond to student questions."
        saveState={saveState}
        hasChanges={charCount > 0}
        isSaving={saving}
        onSave={handleSave}
        extraActions={
          isCustom && <span className="text-xs font-medium px-2 py-0.5 rounded border border-gray-200 dark:border-border bg-gray-50 dark:bg-muted/20/20 text-gray-700 dark:text-gray-400">Custom</span>
        }
      />

      {!data?.chatbot_enabled && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 mb-4">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            The chatbot is disabled for this module. Enable it in the <strong>Features</strong> tab to activate it.
          </p>
        </div>
      )}

      <textarea
        value={instructions}
        onChange={e => setInstructions(e.target.value)}
        disabled={!data?.chatbot_enabled}
        rows={16}
        className="w-full px-4 py-3 border border-gray-200 dark:border-border rounded-lg bg-white dark:bg-background text-sm font-mono text-gray-800 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40 disabled:cursor-not-allowed resize-none"
        placeholder="You are a supportive AI tutor for this module…"
      />
      <div className="flex items-center justify-between mt-2">
        <span className={`text-xs ${charCount > maxChars ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>{charCount} / {maxChars}</span>
        <button onClick={() => { if (confirm('Reset to default instructions?')) load(); }} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-foreground transition-colors">
          Reset to default
        </button>
      </div>

      <div className="mt-6 border-t border-gray-100 dark:border-border pt-4 grid grid-cols-3 gap-4">
        {[
          { title: 'Response style', body: 'Define the tone (formal, casual, encouraging) and complexity level.' },
          { title: 'Teaching philosophy', body: 'Specify if the chatbot should give direct answers or guide discovery.' },
          { title: 'Content boundaries', body: "Set guidelines on what topics the chatbot shouldn't discuss." },
        ].map(tip => (
          <div key={tip.title}>
            <p className="text-xs font-semibold text-gray-700 dark:text-foreground mb-1">{tip.title}</p>
            <p className="text-xs text-gray-400 dark:text-muted-foreground leading-relaxed">{tip.body}</p>
          </div>
        ))}
      </div>
    </>
  );
}

function SurveyTab({ moduleId }) {
  const [surveyQuestions, setSurveyQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!moduleId) return;
    (async () => {
      try {
        setLoading(true); setError(null);
        const config = await apiClient.get(`/api/modules/${moduleId}/survey`);
        setSurveyQuestions(config.survey_questions || []);
      } catch (e) {
        console.error(e);
        setError('Failed to load survey configuration.');
      } finally { setLoading(false); }
    })();
  }, [moduleId]);

  const handleAdd = () => setSurveyQuestions(prev => [...prev, { id: `q${prev.length + 1}`, question: '', type: 'long', required: false, placeholder: '' }]);
  const handleRemove = (i) => setSurveyQuestions(prev => prev.filter((_, idx) => idx !== i));
  const handleChange = (i, field, value) => setSurveyQuestions(prev => { const u = [...prev]; u[i] = { ...u[i], [field]: value }; return u; });

  const handleSave = async () => {
    for (const q of surveyQuestions) {
      if (!q.question.trim()) { setError('All questions must have text.'); return; }
    }
    setSaving(true); setSaveState('saving'); setError(null);
    try {
      await apiClient.put(`/api/modules/${moduleId}/survey`, { survey_questions: surveyQuestions });
      setSaveState('saved'); setTimeout(() => setSaveState(null), 2500);
    } catch (e) {
      console.error(e);
      setSaveState('error'); setError(e.message || 'Failed to save.');
      setTimeout(() => setSaveState(null), 3000);
    } finally { setSaving(false); }
  };

  if (!moduleId || loading) return <SpinnerBox />;

  return (
    <>
      <StandaloneHeader
        title="Survey questions"
        description="Create questions to gather student feedback after submission."
        saveState={saveState}
        hasChanges={true}
        isSaving={saving}
        onSave={handleSave}
        extraActions={
          <Button variant="outline" size="sm" onClick={handleAdd} className="h-8 text-xs gap-1.5">
            <Plus className="w-3 h-3" />Add question
          </Button>
        }
      />

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-4 py-3 mb-4">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {surveyQuestions.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 dark:border-border rounded-xl">
          <ClipboardList className="w-8 h-8 text-gray-200 dark:text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500 dark:text-foreground mb-1">No survey questions yet</p>
          <p className="text-xs text-gray-400 dark:text-muted-foreground mb-4">Create questions to gather student feedback</p>
          <Button variant="outline" size="sm" onClick={handleAdd} className="text-xs gap-1.5">
            <Plus className="w-3 h-3" />Add first question
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {surveyQuestions.map((q, i) => (
            <div key={i} className="border border-gray-200 dark:border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-muted/20 border-b border-gray-100 dark:border-border">
                <span className="text-xs font-medium text-gray-500 dark:text-muted-foreground">Question {i + 1}</span>
                <button onClick={() => handleRemove(i)} className="text-gray-300 hover:text-red-400 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <Textarea value={q.question} onChange={e => handleChange(i, 'question', e.target.value)} placeholder="Question text…" rows={2} className="resize-none text-sm" />
                <Input value={q.placeholder || ''} onChange={e => handleChange(i, 'placeholder', e.target.value)} placeholder="Placeholder hint for students (optional)" className="text-sm h-9" />
                <div className="flex items-center gap-4">
                  <select value={q.type} onChange={e => handleChange(i, 'type', e.target.value)}
                    className="h-8 px-2 border border-gray-200 dark:border-border rounded-md bg-white dark:bg-background text-xs text-gray-700 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="short">Short answer</option>
                    <option value="long">Long answer</option>
                  </select>
                  <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-muted-foreground cursor-pointer select-none">
                    <Switch checked={q.required} onCheckedChange={v => handleChange(i, 'required', v)} />
                    Required
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function ConsentTab({ moduleId, moduleData }) {
  if (!moduleId || !moduleData) return <SpinnerBox />;
  return (
    <>
      <div className="mb-6">
        <p className="text-sm font-medium text-gray-900 dark:text-foreground">Research consent form</p>
        <p className="text-sm text-gray-500 dark:text-muted-foreground mt-0.5">
          Customize the consent form students see before accessing this module. Supports Markdown.
        </p>
      </div>
      <ConsentFormEditor
        moduleId={moduleId}
        initialConsentText={moduleData.consent_form_text}
        initialConsentRequired={moduleData.consent_required}
      />
    </>
  );
}

// ─── Access code right panel ──────────────────────────────────────────────────

function AccessCodePanel({ moduleData, moduleId, onRegenerated }) {
  const [copied, setCopied] = useState(null);
  const [regenerating, setRegenerating] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);

  const accessCode = moduleData?.access_code;
  const joinLink = typeof window !== 'undefined' && accessCode
    ? `${window.location.origin}/join/${accessCode}` : '';

  const copy = async (type) => {
    const text = type === 'code' ? accessCode : joinLink;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (e) { console.error(e); }
  };

  const regenerate = async () => {
    if (!moduleId) return;
    setRegenerating(true);
    try {
      const res = await apiClient.post(`/api/modules/${moduleId}/regenerate-code`);
      onRegenerated(res.access_code || res.new_access_code || res.data?.access_code);
      setConfirmRegen(false);
    } catch (e) { console.error(e); }
    finally { setRegenerating(false); }
  };

  if (!accessCode) return null;

  return (
    <div className="sticky top-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-muted-foreground mb-4">Student Access</p>

      {/* Code display */}
      <div className="rounded-xl border border-gray-100 dark:border-border bg-gray-50 dark:bg-muted/20 p-4 mb-3 text-center">
        <p className="text-[11px] text-gray-400 dark:text-muted-foreground mb-2 uppercase tracking-wider">Access code</p>
        <p className="text-2xl font-mono font-bold tracking-[0.25em] text-gray-900 dark:text-foreground">{accessCode}</p>
        <p className="text-[11px] text-gray-400 dark:text-muted-foreground mt-2">For student enrollment</p>
      </div>

      {/* Actions */}
      <div className="space-y-1.5">
        <button onClick={() => copy('code')}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-foreground rounded-lg border border-gray-200 dark:border-border hover:bg-gray-50 dark:hover:bg-muted/20 transition-colors">
          {copied === 'code'
            ? <Check className="w-4 h-4 text-emerald-500 shrink-0" />
            : <Copy className="w-4 h-4 text-gray-400 shrink-0" />}
          <span className="text-sm">{copied === 'code' ? 'Copied!' : 'Copy code'}</span>
        </button>
        <button onClick={() => copy('link')}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-foreground rounded-lg border border-gray-200 dark:border-border hover:bg-gray-50 dark:hover:bg-muted/20 transition-colors">
          {copied === 'link'
            ? <Check className="w-4 h-4 text-emerald-500 shrink-0" />
            : <Link2 className="w-4 h-4 text-gray-400 shrink-0" />}
          <span className="text-sm">{copied === 'link' ? 'Copied!' : 'Copy join link'}</span>
        </button>

        {!confirmRegen ? (
          <button onClick={() => setConfirmRegen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-400 dark:text-muted-foreground rounded-lg border border-gray-200 dark:border-border hover:text-amber-600 hover:border-amber-200 dark:hover:text-amber-400 dark:hover:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/10 transition-colors">
            <RotateCcw className="w-4 h-4 shrink-0" />
            Regenerate
          </button>
        ) : (
          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-2">
            <p className="text-xs text-amber-700 dark:text-amber-300 leading-snug">
              Old code stops working immediately. Students will need the new code.
            </p>
            <div className="flex gap-2">
              <button onClick={regenerate} disabled={regenerating}
                className="flex-1 flex items-center justify-center gap-1.5 h-7 text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-md transition-colors disabled:opacity-50">
                {regenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Yes, regenerate'}
              </button>
              <button onClick={() => setConfirmRegen(false)}
                className="px-3 h-7 text-xs font-medium border border-gray-200 dark:border-border rounded-md hover:bg-gray-50 dark:hover:bg-muted/20 transition-colors text-gray-600 dark:text-foreground">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function SettingsPageContent() {
  const { user, loading, isAuthenticated } = useAuth();
  const searchParams = useSearchParams();
  const moduleName = searchParams.get('module');

  const [activeTab, setActiveTab] = useState('general');
  const [moduleData, setModuleData] = useState(null);
  const [moduleId, setModuleId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveState, setSaveState] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalFormData, setOriginalFormData] = useState(null);

  const [formData, setFormData] = useState({
    name: '', description: '', instructions: '',
    is_active: true, visibility: 'class-only', due_date: '',
    consent_required: true,
    assignment_config: {
      grading: { mode: 'ai_visible' },
      features: {
        multiple_attempts: { enabled: true, max_attempts: 2, show_feedback_after_each: true },
        chatbot_feedback:  { enabled: true, conversation_mode: 'guided', ai_model: 'gpt-4' },
        mastery_learning:  { enabled: false, streak_required: 3, queue_randomization: true, reset_on_wrong: false },
      },
    },
  });

  useEffect(() => {
    if (!loading && moduleName && user) fetchModuleData();
    else if (!loading && !moduleName) setIsLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, moduleName]);

  useEffect(() => {
    if (formData && originalFormData)
      setHasChanges(JSON.stringify(formData) !== JSON.stringify(originalFormData));
  }, [formData, originalFormData]);

  const fetchModuleData = async () => {
    try {
      setIsLoading(true);
      const userId = user?.id || user?.sub;
      if (!userId) { setIsLoading(false); return; }
      const res = await apiClient.get(`/api/modules?teacher_id=${userId}`);
      const modules = res?.data || res || [];
      const mod = modules.find(m => m.name === moduleName);
      if (mod) {
        setModuleData(mod); setModuleId(mod.id);
        const d = {
          name: mod.name, description: mod.description || '', instructions: mod.instructions || '',
          is_active: mod.is_active ?? true, visibility: mod.visibility || 'class-only',
          due_date: mod.due_date ? new Date(mod.due_date).toISOString().split('T')[0] : '',
          consent_required: mod.consent_required ?? true,
          assignment_config: mod.assignment_config || formData.assignment_config,
        };
        setFormData(d); setOriginalFormData(d);
      }
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const handleSave = async () => {
    if (!moduleId || !moduleData) return;
    setIsSaving(true); setSaveState('saving');
    try {
      const payload = {
        teacher_id: moduleData.teacher_id, name: formData.name,
        description: formData.description, instructions: formData.instructions,
        is_active: formData.is_active, visibility: formData.visibility,
        due_date: formData.due_date ? new Date(formData.due_date).toISOString() : null,
        consent_required: formData.consent_required, assignment_config: formData.assignment_config,
      };
      const backendMode = GRADING_MODE_MAP[formData.assignment_config?.grading?.mode];
      const reqs = [apiClient.put(`/api/modules/${moduleId}`, payload)];
      if (backendMode) reqs.push(apiClient.patch(`/api/modules/${moduleId}/grading-settings`, { mode: backendMode }));
      await Promise.all(reqs);
      setModuleData(p => ({ ...p, ...formData }));
      setOriginalFormData(formData); setHasChanges(false);
      setSaveState('saved'); setTimeout(() => setSaveState(null), 2500);
    } catch (e) {
      console.error(e);
      setSaveState('error'); setTimeout(() => setSaveState(null), 3000);
    } finally { setIsSaving(false); }
  };

  const set = (key, value) => setFormData(p => ({ ...p, [key]: value }));
  const setFeature = (feature, key, value) =>
    setFormData(p => ({
      ...p,
      assignment_config: { ...p.assignment_config, features: { ...p.assignment_config.features, [feature]: { ...p.assignment_config.features[feature], [key]: value } } },
    }));
  const setGradingMode = (mode) =>
    setFormData(p => ({ ...p, assignment_config: { ...p.assignment_config, grading: { ...p.assignment_config?.grading, mode } } }));

  const shell = (
    <SidebarProvider style={{ "--sidebar-width": "calc(var(--spacing) * 72)", "--header-height": "calc(var(--spacing) * 12)" }}>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );

  if (loading || isLoading) return shell;
  if (!isAuthenticated) return <div className="p-8 text-center"><Button asChild><Link href="/sign-in">Sign in</Link></Button></div>;
  if (!moduleName) return shell;

  const isSharedTab = SHARED_SAVE_TABS.has(activeTab);

  return (
    <SidebarProvider style={{ "--sidebar-width": "calc(var(--spacing) * 72)", "--header-height": "calc(var(--spacing) * 12)" }}>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />

        <div className="flex flex-1 flex-col bg-white dark:bg-background min-h-screen">

          {/* ── Page top: title + tabs ────────────────────────────────────── */}
          <div className="border-b border-gray-200 dark:border-border bg-white dark:bg-card">
            <div className="px-6">

              {/* Breadcrumb */}
              <div className="flex items-center gap-1.5 pt-6 pb-1 text-xs text-gray-400 dark:text-muted-foreground">
                <Link href="/mymodules" className="hover:text-gray-600 dark:hover:text-foreground transition-colors">Modules</Link>
                <ChevronRight className="w-3 h-3" />
                <span className="text-gray-600 dark:text-foreground font-medium truncate max-w-[200px]">{moduleName}</span>
                <ChevronRight className="w-3 h-3" />
                <span>Settings</span>
              </div>

              {/* Page title */}
              <div className="flex items-center justify-between mt-2 pb-4">
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-semibold text-gray-900 dark:text-foreground tracking-tight">Settings</h1>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${formData.is_active ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400' : 'border-gray-200 dark:border-border bg-gray-100 dark:bg-muted text-gray-400'}`}>
                    {formData.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              {/* Tab bar */}
              <div className="flex items-end gap-0 -mb-px overflow-x-auto">
                {TABS.map(tab => {
                  const active = activeTab === tab.id;
                  return (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                      className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors duration-100 select-none whitespace-nowrap ${
                        active
                          ? 'border-gray-900 dark:border-foreground text-gray-900 dark:text-foreground'
                          : 'border-transparent text-gray-500 dark:text-muted-foreground hover:text-gray-700 dark:hover:text-foreground'
                      }`}>
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Tab content + right panel ────────────────────────────────── */}
          <div className="flex flex-1 min-h-0">

            {/* Main content */}
            <div className="flex-1 min-w-0 px-6 py-6 pb-24">
              {activeTab === 'general'  && <GeneralTab  formData={formData} set={set} />}
              {activeTab === 'grading'  && <GradingTab  formData={formData} setGradingMode={setGradingMode} moduleId={moduleId} />}
              {activeTab === 'features' && <FeaturesTab formData={formData} setFeature={setFeature} />}
              {activeTab === 'chatbot'  && <ChatbotTab  moduleId={moduleId} />}
              {activeTab === 'survey'   && <SurveyTab   moduleId={moduleId} />}
              {activeTab === 'consent'  && <ConsentTab  moduleId={moduleId} moduleData={moduleData} />}
            </div>

            {/* Right panel — access code */}
            {moduleData?.access_code && (
              <aside className="w-64 shrink-0 border-l border-gray-200 dark:border-border px-5 py-6">
                <AccessCodePanel
                  moduleData={moduleData}
                  moduleId={moduleId}
                  onRegenerated={(newCode) => setModuleData(prev => ({ ...prev, access_code: newCode }))}
                />
              </aside>
            )}
          </div>

          {/* ── Sticky bottom action bar — only for shared-save tabs ──── */}
          {isSharedTab && (
            <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-gray-200 dark:border-border bg-white/95 dark:bg-card/95 backdrop-blur-sm">
              {/* match the sidebar offset so the bar doesn't overlap it */}
              <div className="flex items-center justify-end gap-3 px-6 py-3">
                <SaveStatus state={saveState} />
                <Button variant="outline" size="sm" onClick={() => { if (originalFormData) { setFormData(originalFormData); setHasChanges(false); } }} disabled={!hasChanges || isSaving} className="h-8 text-sm">
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={!hasChanges || isSaving} className="h-8 text-sm bg-gray-900 hover:bg-gray-800 text-white">
                  {isSaving ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Saving…</> : 'Save changes'}
                </Button>
              </div>
            </div>
          )}

        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-background">
        <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
      </div>
    }>
      <SettingsPageContent />
    </Suspense>
  );
}
