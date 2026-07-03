'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Upload, Zap, BookOpen, BarChart2,
  CheckCircle, Clock, AlertCircle, ArrowLeft,
  FileText, Loader2, Globe, Lock, ChevronRight,
  RefreshCw, Share2, Copy, Users, Trash2,
  ClipboardList, FlaskConical, MessageSquare, Brain,
} from 'lucide-react';
import Link from 'next/link';

// ─── palette helpers ──────────────────────────────────────────────────────────
const PALETTES = [
  { accent: '#6366f1', light: 'rgba(99,102,241,0.12)' },
  { accent: '#10b981', light: 'rgba(16,185,129,0.12)' },
  { accent: '#ef4444', light: 'rgba(239,68,68,0.12)'  },
  { accent: '#3b82f6', light: 'rgba(59,130,246,0.12)' },
  { accent: '#a855f7', light: 'rgba(168,85,247,0.12)' },
  { accent: '#f59e0b', light: 'rgba(245,158,11,0.12)' },
  { accent: '#14b8a6', light: 'rgba(20,184,166,0.12)' },
];

function getPalette(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return PALETTES[Math.abs(h) % PALETTES.length];
}

// ─── processing helpers ───────────────────────────────────────────────────────
const DONE_STATUSES  = ['embedded', 'indexed'];
const ERROR_STATUSES = ['error', 'failed'];

function processingLabel(status) {
  const map = {
    uploaded:   'Uploaded',
    extracting: 'Extracting text…',
    extracted:  'Text extracted',
    chunking:   'Chunking…',
    chunked:    'Chunked',
    embedding:  'Building index…',
    embedded:   'Ready',
    indexed:    'Ready',
    error:      'Error',
    failed:     'Failed',
  };
  return map[status] || status;
}

// ─── step card ────────────────────────────────────────────────────────────────
function StepCard({ number, title, icon: Icon, status, palette, children }) {
  const isDone   = status === 'done';
  const isActive = status === 'active';
  const isLocked = status === 'locked';

  const accentColor = isDone ? '#10b981' : isActive ? (palette?.accent || '#6366f1') : '#94a3b8';

  return (
    <Card className={`overflow-hidden transition-opacity ${isLocked ? 'opacity-40' : 'opacity-100'}
      bg-white dark:bg-slate-800
      ${isDone ? 'border-emerald-200 dark:border-emerald-700' : isActive ? 'border-indigo-200 dark:border-indigo-700' : 'border-slate-200 dark:border-slate-700'}`}>
      <div className={`flex items-center gap-3 px-5 py-3.5 border-b
        ${isDone ? 'border-emerald-100 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20' :
          isActive ? 'border-indigo-100 dark:border-indigo-800/50 bg-indigo-50/50 dark:bg-indigo-950/20' :
          'border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'}`}>
        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold"
          style={{
            background: isDone ? 'rgba(16,185,129,0.15)' : isActive ? `${palette?.accent || '#6366f1'}18` : 'rgba(148,163,184,0.15)',
            border: `1.5px solid ${accentColor}`,
            color: accentColor,
          }}>
          {isDone ? <CheckCircle className="w-3 h-3" /> : number}
        </div>
        <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: accentColor }} />
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</span>
        {isDone && (
          <Badge className="ml-auto text-[10px] px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-0">
            Done
          </Badge>
        )}
      </div>
      {!isLocked && (
        <CardContent className="p-5">{children}</CardContent>
      )}
    </Card>
  );
}

// ─── stat card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, iconBg, iconColor }) {
  return (
    <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all">
      <CardContent className="p-5">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${iconBg}`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide font-semibold mb-1">{label}</p>
        <p className="text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
      </CardContent>
    </Card>
  );
}

// ─── share section ────────────────────────────────────────────────────────────
function ShareSection({ module }) {
  const [copied,   setCopied]   = useState(null);
  const [joinLink, setJoinLink] = useState('');

  useEffect(() => {
    if (module?.access_code && typeof window !== 'undefined') {
      setJoinLink(`${window.location.origin}/join/${module.access_code}`);
    }
  }, [module?.access_code]);

  const copy = (key, text) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const isPublic = module?.visibility === 'public';

  return (
    <Card className="overflow-hidden border-2 border-emerald-200 dark:border-emerald-700 bg-gradient-to-br from-emerald-50 to-emerald-100/60 dark:from-emerald-950/30 dark:to-emerald-900/20 shadow-md">
      <CardHeader className="pb-3 pt-4 px-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-600 dark:bg-emerald-700 rounded-lg">
              <Share2 className="w-4 h-4 text-white" />
            </div>
            <CardTitle className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
              Share Module
            </CardTitle>
          </div>
          <Badge className={`text-[10px] px-2 border-0 ${isPublic
            ? 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300'
            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
            {isPublic ? <Globe className="w-2.5 h-2.5 mr-1" /> : <Lock className="w-2.5 h-2.5 mr-1" />}
            {isPublic ? 'Public' : 'Private'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5 space-y-4">
        {/* Access code */}
        <div>
          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide mb-2">
            Access Code
          </p>
          <div className="flex gap-2">
            <div className="flex-1 bg-white/70 dark:bg-slate-800/70 border border-emerald-200 dark:border-emerald-700/50 rounded-lg px-3 py-2 font-mono text-xl font-black text-center tracking-[0.25em] text-emerald-700 dark:text-emerald-300">
              {module?.access_code || '—'}
            </div>
            <Button
              size="icon"
              variant="outline"
              onClick={() => copy('code', module?.access_code || '')}
              disabled={!module?.access_code}
              className="h-10 w-10 flex-shrink-0 border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/30">
              {copied === 'code'
                ? <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                : <Copy className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
            </Button>
          </div>
        </div>

        {/* Join link */}
        {joinLink && (
          <div>
            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide mb-2">
              Join Link
            </p>
            <div className="flex gap-2">
              <input readOnly value={joinLink} onClick={e => e.target.select()}
                className="flex-1 min-w-0 bg-white/70 dark:bg-slate-800/70 border border-emerald-200 dark:border-emerald-700/50 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-600 dark:text-slate-400 outline-none" />
              <Button
                size="icon"
                variant="outline"
                onClick={() => copy('link', joinLink)}
                disabled={!joinLink}
                className="h-8 w-8 flex-shrink-0 border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/30">
                {copied === 'link'
                  ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  : <Copy className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
              </Button>
            </div>
          </div>
        )}

        {/* Visibility note */}
        <div className={`flex items-start gap-2 p-2.5 rounded-lg text-xs
          ${isPublic
            ? 'bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/50'
            : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600'}`}>
          {isPublic
            ? <Globe className="w-3 h-3 flex-shrink-0 mt-0.5" />
            : <Lock className="w-3 h-3 flex-shrink-0 mt-0.5" />}
          <span>{isPublic
            ? 'Discoverable by all students — no code needed.'
            : 'Only accessible with the code or link above.'}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── delete dialog ────────────────────────────────────────────────────────────
function DeleteDialog({ moduleName, open, onClose, onConfirm, deleting }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-destructive">Delete Module</DialogTitle>
          <DialogDescription>
            This will permanently delete &ldquo;{moduleName}&rdquo; along with all documents, questions, and answers. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={deleting}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={deleting}>
            {deleting ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Deleting…</> : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────
export default function StudentModuleManage() {
  const { moduleId } = useParams();
  const { user }     = useAuth();
  const router       = useRouter();

  const [module,        setModule]        = useState(null);
  const [document,      setDocument]      = useState(null);
  const [qCount,        setQCount]        = useState(0);
  const [enrolledCount, setEnrolledCount] = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);

  const fileRef         = useRef(null);
  const [uploading,     setUploading]     = useState(false);
  const [uploadError,   setUploadError]   = useState(null);
  const [polling,       setPolling]       = useState(false);

  const [generating,    setGenerating]    = useState(false);
  const [generateMsg,   setGenerateMsg]   = useState(null);
  const [generateError, setGenerateError] = useState(null);

  const [togglingVis,   setTogglingVis]   = useState(false);
  const [showDelete,    setShowDelete]    = useState(false);
  const [deleting,      setDeleting]      = useState(false);

  // ── fetch ─────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      const [mod, docs] = await Promise.all([
        apiClient.get(`/api/modules/${moduleId}`),
        apiClient.get(`/api/documents?module_id=${moduleId}&teacher_id=${user?.id}`).catch(() => []),
      ]);
      setModule(mod);
      const docList = Array.isArray(docs) ? docs : [];
      const firstDoc = docList[0] || null;
      setDocument(firstDoc);
      if (firstDoc) {
        const qs = await apiClient.get(`/api/student/modules/${moduleId}/questions`).catch(() => []);
        setQCount(Array.isArray(qs) ? qs.length : 0);
      }
      const metrics = await apiClient.get(
        `/api/modules/${moduleId}/dashboard-metrics?teacher_id=${user?.id}`
      ).catch(() => null);
      if (metrics?.total_students != null)     setEnrolledCount(metrics.total_students);
      else if (metrics?.enrollment_count != null) setEnrolledCount(metrics.enrollment_count);
    } catch {
      setError('Could not load module.');
    } finally {
      setLoading(false);
    }
  }, [moduleId, user]);

  useEffect(() => { if (user) fetchAll(); }, [user, fetchAll]);

  // ── poll doc processing ───────────────────────────────────────────────────
  useEffect(() => {
    if (!document?.id) return;
    if (DONE_STATUSES.includes(document.processing_status))  return;
    if (ERROR_STATUSES.includes(document.processing_status)) return;
    setPolling(true);
    const id = setInterval(async () => {
      try {
        const updated = await apiClient.get(`/api/documents/${document.id}`);
        setDocument(updated);
        if (DONE_STATUSES.includes(updated.processing_status) || ERROR_STATUSES.includes(updated.processing_status)) {
          clearInterval(id);
          setPolling(false);
        }
      } catch {
        clearInterval(id);
        setPolling(false);
      }
    }, 3000);
    return () => clearInterval(id);
  }, [document?.id, document?.processing_status]);

  // ── upload ────────────────────────────────────────────────────────────────
  const handleUpload = async (file) => {
    if (!file || !module) return;
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('module_name', module.name);
      form.append('teacher_id', user.id);
      const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
      const cookies = typeof document !== 'undefined' ? document.cookie : '';
      const cookieToken = cookies.split(';').find(c => c.trim().startsWith('token='))?.split('=')[1];
      const authToken = cookieToken || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
      const resp = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        body: form,
      });
      if (!resp.ok) throw new Error(await resp.text());
      const doc = await resp.json();
      setDocument(doc);
    } catch (e) {
      setUploadError(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // ── generate questions ────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!document) return;
    setGenerating(true);
    setGenerateError(null);
    setGenerateMsg(null);
    try {
      const res = await apiClient.post(`/api/documents/${document.id}/generate-questions`, {
        num_short: 3,
        num_long: 2,
        num_mcq: 5,
      });
      setGenerateMsg(`Generated ${res.generated_count} questions — ready to study!`);
      setQCount(res.generated_count);
    } catch (e) {
      setGenerateError(e?.response?.data?.detail || e.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  // ── visibility toggle ─────────────────────────────────────────────────────
  const toggleVisibility = async () => {
    if (!module) return;
    setTogglingVis(true);
    try {
      const newVis = module.visibility === 'public' ? 'class-only' : 'public';
      await apiClient.put(`/api/modules/${moduleId}`, { ...module, visibility: newVis });
      setModule(m => ({ ...m, visibility: newVis }));
    } catch {
      // ignore
    } finally {
      setTogglingVis(false);
    }
  };

  // ── delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await apiClient.delete(`/api/modules/${moduleId}`);
      router.push('/student-dashboard?tab=my-modules');
    } catch {
      setDeleting(false);
      setShowDelete(false);
    }
  };

  // ── derived state ─────────────────────────────────────────────────────────
  const docReady     = document && DONE_STATUSES.includes(document.processing_status);
  const docError     = document && ERROR_STATUSES.includes(document.processing_status);
  const hasQuestions = qCount > 0;
  const isPublic     = module?.visibility === 'public';
  const palette      = getPalette(module?.name || '');

  const step1Status = document      ? 'done'   : 'active';
  const step2Status = !document     ? 'locked' : (hasQuestions ? 'done' : 'active');
  const step3Status = !hasQuestions ? 'locked' : 'active';
  const step4Status = !hasQuestions ? 'locked' : 'active';

  // ── loading / error ───────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
          <Brain className="w-5 h-5 text-white" />
        </div>
        <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <p className="text-red-500 dark:text-red-400">{error}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">

      {/* ── Sticky header ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-3">
          <Link href="/student-dashboard"
            className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />My Modules
          </Link>
          <span className="text-slate-300 dark:text-slate-600">/</span>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate max-w-xs">
            {module?.name}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={fetchAll} title="Refresh">
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
            <Button variant="outline" size="icon"
              className="h-8 w-8 border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
              onClick={() => setShowDelete(true)} title="Delete module">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">

        {/* ── Module identity header ──────────────────────────────────────── */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0"
              style={{ background: palette.light, color: palette.accent }}>
              {module?.name?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{module?.name}</h1>
              {module?.description && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{module.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <Badge variant="outline" className={`px-3 py-1 text-xs font-semibold flex items-center gap-1.5
              ${isPublic
                ? 'border-cyan-300 dark:border-cyan-700 bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300'
                : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400'}`}>
              {isPublic ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
              {isPublic ? 'Public' : 'Private'}
            </Badge>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {togglingVis ? 'Saving…' : (isPublic ? 'Make private' : 'Make public')}
              </span>
              <Switch checked={isPublic} onCheckedChange={toggleVisibility} disabled={togglingVis} />
            </div>
          </div>
        </div>

        {/* ── Stats row ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={Users}
            label="Enrolled"
            value={enrolledCount ?? '—'}
            iconBg="bg-indigo-100 dark:bg-indigo-900/30"
            iconColor="text-indigo-600 dark:text-indigo-400"
          />
          <StatCard
            icon={ClipboardList}
            label="Questions"
            value={qCount > 0 ? qCount : '—'}
            iconBg="bg-blue-100 dark:bg-blue-900/30"
            iconColor="text-blue-600 dark:text-blue-400"
          />
          <StatCard
            icon={RefreshCw}
            label="Max Attempts"
            value={module?.assignment_config?.features?.multiple_attempts?.max_attempts ?? '—'}
            iconBg="bg-purple-100 dark:bg-purple-900/30"
            iconColor="text-purple-600 dark:text-purple-400"
          />
          <StatCard
            icon={MessageSquare}
            label="Feedback Mode"
            value={module?.assignment_config?.features?.chatbot_feedback?.conversation_mode || 'guided'}
            iconBg="bg-emerald-100 dark:bg-emerald-900/30"
            iconColor="text-emerald-600 dark:text-emerald-400"
          />
        </div>

        {/* ── Two-column layout ───────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">

          {/* Left: step workflow */}
          <div className="space-y-4">

            {/* Step 1: Upload */}
            <StepCard number={1} title="Upload a Document" icon={Upload} status={step1Status} palette={palette}>
              {document ? (
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
                    ${docError ? 'bg-red-100 dark:bg-red-900/30' : docReady ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-indigo-100 dark:bg-indigo-900/30'}`}>
                    <FileText className={`w-4 h-4 ${docError ? 'text-red-500' : docReady ? 'text-emerald-500' : 'text-indigo-500'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                      {document.original_filename || document.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {docError
                        ? <AlertCircle className="w-3 h-3 text-red-500" />
                        : docReady
                        ? <CheckCircle className="w-3 h-3 text-emerald-500" />
                        : <Loader2 className="w-3 h-3 text-indigo-500 animate-spin" />}
                      <span className={`text-xs ${docError ? 'text-red-500' : docReady ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                        {processingLabel(document.processing_status)}
                        {polling && !docReady && !docError && ' — processing…'}
                      </span>
                    </div>
                  </div>
                  {docError && (
                    <Button variant="outline" size="sm" className="h-7 text-xs flex-shrink-0"
                      onClick={() => setDocument(null)}>Replace</Button>
                  )}
                </div>
              ) : (
                <div>
                  <div
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors
                      ${uploading ? 'cursor-default border-slate-200 dark:border-slate-700' : 'cursor-pointer border-slate-300 dark:border-slate-600 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20'}`}
                    onClick={() => !uploading && fileRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleUpload(f); }}>
                    {uploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                        <p className="text-sm text-slate-500 dark:text-slate-400">Uploading…</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-11 h-11 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                          <Upload className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Drop file here or click to browse</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">PDF, DOCX, or PPTX</p>
                      </div>
                    )}
                  </div>
                  {uploadError && (
                    <p className="text-xs text-red-500 dark:text-red-400 mt-2 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />{uploadError}
                    </p>
                  )}
                  <input ref={fileRef} type="file" accept=".pdf,.docx,.pptx" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
                </div>
              )}
            </StepCard>

            {/* Step 2: Generate */}
            <StepCard number={2} title="Generate Questions" icon={Zap} status={step2Status} palette={palette}>
              {hasQuestions ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm text-slate-700 dark:text-slate-200">{qCount} questions ready</span>
                  </div>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5"
                    onClick={handleGenerate} disabled={generating || !docReady}>
                    {generating
                      ? <><Loader2 className="w-3 h-3 animate-spin" />Generating…</>
                      : <><Zap className="w-3 h-3" />Regenerate</>}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    AI will generate multiple-choice, short-answer, and essay questions from your document.
                  </p>
                  {!docReady && !docError && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />Waiting for document to finish processing…
                    </p>
                  )}
                  {docError      && <p className="text-xs text-red-500 dark:text-red-400">Document processing failed. Please re-upload.</p>}
                  {generateError && <p className="text-xs text-red-500 dark:text-red-400">{generateError}</p>}
                  {generateMsg   && <p className="text-xs text-emerald-600 dark:text-emerald-400">{generateMsg}</p>}
                  <Button size="sm" className="gap-2 font-semibold"
                    style={docReady && !generating ? { background: palette.accent } : {}}
                    onClick={handleGenerate} disabled={!docReady || generating}>
                    {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    {generating ? 'Generating…' : 'Generate Questions'}
                  </Button>
                </div>
              )}
            </StepCard>

            {/* Step 3: Test */}
            <StepCard number={3} title="Take the Test" icon={BookOpen} status={step3Status} palette={palette}>
              <div className="space-y-3">
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  Test yourself on the questions generated from your document.
                </p>
                <Button asChild size="sm" className="gap-2 font-semibold text-white"
                  style={{ background: palette.accent }}>
                  <Link href={`/student/module/${moduleId}?tab=assignments`}>
                    <BookOpen className="w-4 h-4" />Start Test<ChevronRight className="w-4 h-4" />
                  </Link>
                </Button>
              </div>
            </StepCard>

            {/* Step 4: Feedback */}
            <StepCard number={4} title="Review Feedback" icon={BarChart2} status={step4Status} palette={palette}>
              <div className="space-y-3">
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  Review AI feedback and see how you did on each question.
                </p>
                <Button asChild variant="outline" size="sm" className="gap-2 font-semibold">
                  <Link href={`/student/module/${moduleId}?tab=feedback`}>
                    <BarChart2 className="w-4 h-4" />See Feedback<ChevronRight className="w-4 h-4" />
                  </Link>
                </Button>
              </div>
            </StepCard>

          </div>

          {/* Right: quick actions + share */}
          <div className="space-y-4">

            {hasQuestions && (
              <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                <CardHeader className="pb-2 pt-4 px-5">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Quick Actions</p>
                </CardHeader>
                <CardContent className="px-5 pb-5 space-y-2">
                  <Button asChild className="w-full justify-start gap-2.5 font-semibold text-sm h-10"
                    style={{ background: 'var(--sd-indigo-pill-bg)', color: 'var(--sd-indigo-text)', border: '1px solid rgba(99,102,241,0.3)' }}>
                    <Link href={`/student/module/${moduleId}?tab=assignments`}>
                      <FlaskConical className="w-4 h-4" />Take Test
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full justify-start gap-2.5 font-semibold text-sm h-10 border-slate-200 dark:border-slate-700">
                    <Link href={`/student/module/${moduleId}?tab=feedback`}>
                      <BarChart2 className="w-4 h-4" />View Feedback
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            <ShareSection module={module} />

          </div>

        </div>
      </main>

      <DeleteDialog
        moduleName={module?.name}
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        deleting={deleting}
      />
    </div>
  );
}
