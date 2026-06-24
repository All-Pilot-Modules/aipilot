'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/lib/auth';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  BookOpen, Clock, CheckCircle, XCircle, AlertCircle,
  Plus, LogOut, ClipboardList, Settings,
  Sparkles, CalendarDays, ArrowRight, RefreshCw,
  BookMarked, Link as LinkIcon, Globe, Lock,
  Layers, Compass, FlaskConical, Copy, Share2, Brain,
  Zap, ChevronRight,
} from 'lucide-react';
import Link from 'next/link';

// ─── palette helpers ─────────────────────────────────────────────────────────

const MODULE_PALETTES = [
  { accent: '#6366f1', light: 'rgba(99,102,241,0.12)', text: '#a5b4fc' },
  { accent: '#8b5cf6', light: 'rgba(139,92,246,0.12)', text: '#c4b5fd' },
  { accent: '#06b6d4', light: 'rgba(6,182,212,0.12)',  text: '#67e8f9' },
  { accent: '#f59e0b', light: 'rgba(245,158,11,0.12)', text: '#fcd34d' },
  { accent: '#10b981', light: 'rgba(16,185,129,0.12)', text: '#6ee7b7' },
  { accent: '#ef4444', light: 'rgba(239,68,68,0.12)',  text: '#fca5a5' },
  { accent: '#ec4899', light: 'rgba(236,72,153,0.12)', text: '#f9a8d4' },
  { accent: '#14b8a6', light: 'rgba(20,184,166,0.12)', text: '#5eead4' },
];

function getPalette(str) {
  if (!str) return MODULE_PALETTES[0];
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return MODULE_PALETTES[h % MODULE_PALETTES.length];
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─── status helpers ──────────────────────────────────────────────────────────

const claimStatusStyle = {
  pending:  { bg: 'var(--sd-amber-bg)', color: 'var(--sd-amber-text)' },
  approved: { bg: 'var(--sd-green-bg)', color: 'var(--sd-green-text)' },
  denied:   { bg: 'var(--sd-red-bg)',   color: 'var(--sd-red-text)'   },
};

function ClaimStatusIcon({ status }) {
  if (status === 'approved') return <CheckCircle className="w-3 h-3" />;
  if (status === 'denied')   return <XCircle className="w-3 h-3" />;
  return <Clock className="w-3 h-3" />;
}

function formatDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function isDueSoon(iso) {
  if (!iso) return false;
  const diff = new Date(iso) - Date.now();
  return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000;
}

function isPastDue(iso) {
  if (!iso) return false;
  return new Date(iso) < Date.now();
}

function useCopy() {
  const [copied, setCopied] = useState(null);
  const copy = (key, text) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };
  return { copied, copy };
}

// ─── share dialog (logic unchanged) ─────────────────────────────────────────

function ShareModuleDialog({ mod, open, onClose }) {
  const { copied, copy } = useCopy();
  const joinLink = mod?.access_code && typeof window !== 'undefined'
    ? `${window.location.origin}/join/${mod.access_code}` : '';
  const isPublic = mod?.visibility === 'public';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent style={{ background: 'var(--sd-card)', border: '1px solid var(--sd-border)', color: 'var(--sd-text)' }}
        className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-100">
            <Share2 className="w-4 h-4" style={{ color: '#6366f1' }} />
            Share &ldquo;{mod?.name}&rdquo;
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Invite classmates to study together.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Access Code</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 font-mono text-center text-2xl font-bold tracking-[0.3em] rounded-lg py-3 select-all"
                style={{ background: 'var(--sd-card2)', color: 'var(--sd-indigo-text)', border: '1px solid var(--sd-border)' }}>
                {mod?.access_code || '------'}
              </div>
              <button
                onClick={() => copy('code', mod?.access_code || '')}
                disabled={!mod?.access_code}
                className="h-12 w-12 rounded-lg flex items-center justify-center transition-colors"
                style={{ background: copied === 'code' ? 'rgba(16,185,129,0.15)' : 'var(--sd-card2)', border: '1px solid var(--sd-border)' }}
              >
                {copied === 'code'
                  ? <CheckCircle className="w-4 h-4 text-emerald-400" />
                  : <Copy className="w-4 h-4 text-slate-400" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Join Link</label>
            <div className="flex items-center gap-2">
              <input readOnly value={joinLink}
                onClick={e => e.target.select()}
                className="flex-1 text-xs font-mono px-3 h-9 rounded-lg outline-none"
                style={{ background: 'var(--sd-card2)', border: '1px solid var(--sd-border)', color: 'var(--sd-muted2)' }} />
              <button onClick={() => copy('link', joinLink)} disabled={!joinLink}
                className="h-9 w-9 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--sd-card2)', border: '1px solid var(--sd-border)' }}>
                {copied === 'link'
                  ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs p-3 rounded-lg"
            style={{ background: isPublic ? 'var(--sd-cyan-bg)' : 'var(--sd-surface)', color: isPublic ? 'var(--sd-cyan-text)' : 'var(--sd-muted)', border: `1px solid ${isPublic ? 'var(--sd-cyan-bd)' : 'var(--sd-border)'}` }}>
            {isPublic ? <Globe className="w-3.5 h-3.5 flex-shrink-0" /> : <Lock className="w-3.5 h-3.5 flex-shrink-0" />}
            {isPublic ? 'Public — also discoverable without a code.' : 'Private — only accessible via code or link.'}
          </div>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
            style={{ background: 'var(--sd-card2)', border: '1px solid var(--sd-border)' }}>
            Done
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── new module dialog (logic unchanged) ─────────────────────────────────────

function NewModuleDialog({ open, onClose, onCreated, userId }) {
  const [form, setForm] = useState({ name: '', description: '', isPublic: false, maxAttempts: 3, dueDate: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const reset = () => { setForm({ name: '', description: '', isPublic: false, maxAttempts: 3, dueDate: '' }); setError(null); };
  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Module name is required.'); return; }
    setLoading(true); setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        teacher_id: userId,
        visibility: form.isPublic ? 'public' : 'class-only',
        is_active: true,
        due_date: form.dueDate || null,
        assignment_config: {
          features: {
            multiple_attempts: { enabled: true, max_attempts: form.maxAttempts, show_feedback_after_each: true },
            chatbot_feedback:  { enabled: true, conversation_mode: 'guided', ai_model: 'gpt-4' },
            mastery_learning:  { enabled: true, streak_required: 3 },
          },
          display_settings: { show_progress_bar: true, show_streak_counter: true, show_attempt_counter: true },
        },
      };
      const created = await apiClient.post('/api/modules', payload);
      reset(); onCreated(created);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to create module.');
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent style={{ background: 'var(--sd-card)', border: '1px solid var(--sd-border)', color: 'var(--sd-text)' }}
        className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-100">
            <Zap className="w-4 h-4" style={{ color: '#f59e0b' }} />
            New Learning Module
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Upload study material and AI generates practice questions.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300">
              Module name <span style={{ color: '#f87171' }}>*</span>
            </label>
            <input
              placeholder="e.g. Organic Chemistry Chapter 5"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              autoFocus
              className="w-full px-3 h-10 rounded-lg text-sm outline-none transition-colors"
              style={{ background: 'var(--sd-card2)', border: '1px solid var(--sd-border)', color: 'var(--sd-text)' }}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300">
              Description <span className="text-slate-500 font-normal">(optional)</span>
            </label>
            <textarea
              placeholder="What is this module about?"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
              style={{ background: 'var(--sd-card2)', border: '1px solid var(--sd-border)', color: 'var(--sd-text)' }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300">Max attempts</label>
              <select
                className="w-full h-9 rounded-lg px-3 text-sm outline-none"
                style={{ background: 'var(--sd-card2)', border: '1px solid var(--sd-border)', color: 'var(--sd-text)' }}
                value={form.maxAttempts}
                onChange={e => setForm(f => ({ ...f, maxAttempts: Number(e.target.value) }))}
              >
                <option value={1}>1 attempt</option>
                <option value={2}>2 attempts</option>
                <option value={3}>3 attempts</option>
                <option value={5}>5 attempts</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300">
                Due date <span className="text-slate-500 font-normal">(opt.)</span>
              </label>
              <input
                type="date"
                className="w-full h-9 rounded-lg px-3 text-sm outline-none"
                style={{ background: 'var(--sd-card2)', border: '1px solid var(--sd-border)', color: 'var(--sd-muted2)', colorScheme: 'var(--sd-color-scheme)' }}
                value={form.dueDate}
                onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg"
            style={{ background: 'var(--sd-card2)', border: '1px solid var(--sd-border)' }}>
            <div>
              <p className="text-sm font-medium text-slate-200">Make public</p>
              <p className="text-xs text-slate-500 mt-0.5">Other students can find and join</p>
            </div>
            <Switch checked={form.isPublic} onCheckedChange={v => setForm(f => ({ ...f, isPublic: v }))} />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-xs p-3 rounded-lg"
              style={{ background: 'var(--sd-red-bg)', color: 'var(--sd-red-text)', border: '1px solid var(--sd-red-bd)' }}>
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{error}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={handleClose} disabled={loading}
              className="flex-1 h-9 text-sm rounded-lg transition-colors text-slate-400 hover:text-slate-200"
              style={{ background: 'var(--sd-card2)', border: '1px solid var(--sd-border)' }}>
              Cancel
            </button>
            <button type="submit" disabled={loading || !form.name.trim()}
              className="flex-1 h-9 text-sm rounded-lg font-medium transition-opacity disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff' }}>
              {loading ? 'Creating…' : 'Create Module'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── enrolled module card ─────────────────────────────────────────────────────

function EnrolledModuleCard({ mod }) {
  const due     = mod.due_date;
  const overdue = isPastDue(due);
  const soon    = isDueSoon(due);
  const palette = getPalette(mod.name);

  return (
    <Link href={`/student/module/${mod.id}`} className="group block">
      <div className="relative rounded-xl p-5 h-full flex flex-col gap-3 transition-all duration-200
        hover:-translate-y-0.5 hover:shadow-lg"
        style={{
          background: 'var(--sd-card)',
          border: '1px solid var(--sd-border)',
          boxShadow: 'none',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = palette.accent + '60'; e.currentTarget.style.boxShadow = `0 8px 32px ${palette.accent}18`; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--sd-border)'; e.currentTarget.style.boxShadow = 'none'; }}>

        {/* Color stripe */}
        <div className="absolute top-0 left-0 w-1 h-full rounded-l-xl" style={{ background: `linear-gradient(180deg, ${palette.accent}, ${palette.accent}40)` }} />

        <div className="flex items-start justify-between gap-2 pl-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: palette.light, color: palette.accent }}>
                {mod.name.charAt(0).toUpperCase()}
              </div>
              <p className="font-semibold text-slate-100 truncate text-sm leading-tight">{mod.name}</p>
            </div>
            {mod.description && (
              <p className="text-xs text-slate-500 line-clamp-2 pl-9">{mod.description}</p>
            )}
          </div>
          <ArrowRight className="w-4 h-4 text-slate-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pl-2">
          {mod.is_active
            ? <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--sd-green-bg)', color: 'var(--sd-green-text)', border: '1px solid var(--sd-green-bd)' }}>Active</span>
            : <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(100,116,139,0.12)', color: 'var(--sd-muted2)', border: '1px solid var(--sd-border)' }}>Inactive</span>
          }
          {!mod.is_claimed && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--sd-amber-bg)', color: 'var(--sd-amber-text)', border: '1px solid var(--sd-amber-bd)' }}>Guest</span>
          )}
          {due && overdue && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--sd-red-bg)', color: 'var(--sd-red-text)', border: '1px solid var(--sd-red-bd)' }}>Past due</span>
          )}
          {due && soon && !overdue && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--sd-orange-bg)', color: 'var(--sd-orange-text)', border: '1px solid var(--sd-orange-bd)' }}>Due soon</span>
          )}
        </div>

        {due && (
          <div className={`flex items-center gap-1.5 text-xs pl-2 ${overdue ? 'text-rose-400' : soon ? 'text-orange-400' : 'text-slate-500'}`}>
            <CalendarDays className="w-3 h-3" />Due {formatDate(due)}
          </div>
        )}
        {mod.enrolled_at && !due && (
          <p className="text-xs text-slate-600 pl-2">Joined {formatDate(mod.enrolled_at)}</p>
        )}
      </div>
    </Link>
  );
}

// ─── my module card ───────────────────────────────────────────────────────────

function MyModuleCard({ mod, onShare }) {
  const isPublic = mod.visibility === 'public';
  const palette  = getPalette(mod.name);

  return (
    <div className="rounded-xl overflow-hidden flex flex-col"
      style={{ background: 'var(--sd-card)', border: '1px solid var(--sd-border)' }}>

      {/* Coloured top stripe */}
      <div className="h-1 flex-shrink-0"
        style={{ background: `linear-gradient(90deg, ${palette.accent}, ${palette.accent}50)` }} />

      <div className="p-5 flex flex-col gap-4 flex-1">

        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
              style={{ background: palette.light, color: palette.accent }}>
              {mod.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-100 truncate leading-tight">{mod.name}</p>
              {mod.description && (
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{mod.description}</p>
              )}
            </div>
          </div>
          <span className="flex-shrink-0 text-xs flex items-center gap-1 px-2 py-0.5 rounded-full"
            style={isPublic
              ? { background: 'var(--sd-cyan-bg)', color: 'var(--sd-cyan-text)', border: '1px solid var(--sd-cyan-bd)' }
              : { background: 'var(--sd-card2)', color: 'var(--sd-muted)', border: '1px solid var(--sd-border)' }}>
            {isPublic ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
            {isPublic ? 'Public' : 'Private'}
          </span>
        </div>

        {/* Actions */}
        <div className="mt-auto" style={{ borderTop: '1px solid var(--sd-border)', paddingTop: 14 }}>
          <Link href={`/student/module/${mod.id}`}
            className="flex items-center justify-center gap-2 w-full h-10 rounded-lg font-semibold text-sm mb-2 transition-opacity hover:opacity-90"
            style={{ background: `linear-gradient(135deg, ${palette.accent}, ${palette.accent}99)`, color: '#fff' }}>
            <FlaskConical className="w-4 h-4" />Study Module
          </Link>
          <div className="grid grid-cols-2 gap-2">
            <Link href={`/student-dashboard/modules/${mod.id}`}
              className="flex items-center justify-center gap-1.5 h-9 text-xs rounded-lg font-medium transition-colors"
              style={{ background: 'var(--sd-card2)', border: '1px solid var(--sd-border)', color: 'var(--sd-text)' }}>
              <Settings className="w-3.5 h-3.5" />Manage
            </Link>
            <button onClick={() => onShare(mod)}
              className="flex items-center justify-center gap-1.5 h-9 text-xs rounded-lg font-medium transition-colors"
              style={{ background: 'var(--sd-card2)', border: '1px solid var(--sd-border)', color: 'var(--sd-text)' }}>
              <Share2 className="w-3.5 h-3.5" />Share
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── discover card ────────────────────────────────────────────────────────────

function DiscoverCard({ mod, onJoin, joining }) {
  const palette = getPalette(mod.name);
  return (
    <div className="relative rounded-xl p-5 h-full flex flex-col gap-3"
      style={{ background: 'var(--sd-card)', border: '1px solid var(--sd-border)' }}>
      <div className="absolute top-0 left-0 w-1 h-full rounded-l-xl"
        style={{ background: `linear-gradient(180deg, ${palette.accent}, ${palette.accent}40)` }} />

      <div className="pl-2 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: palette.light, color: palette.accent }}>
            {mod.name.charAt(0).toUpperCase()}
          </div>
          <p className="font-semibold text-slate-100 truncate text-sm">{mod.name}</p>
        </div>
        {mod.description && (
          <p className="text-xs text-slate-500 line-clamp-2 pl-9">{mod.description}</p>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs text-slate-500 pl-2">
        <span className="flex items-center gap-1"><User className="w-3 h-3" />{mod.owner_username || 'Unknown'}</span>
        {mod.question_count != null && (
          <span className="flex items-center gap-1"><ClipboardList className="w-3 h-3" />{mod.question_count} questions</span>
        )}
      </div>

      <button
        className="mt-auto ml-2 h-8 text-xs rounded-lg font-medium flex items-center justify-center gap-1.5 transition-opacity hover:opacity-80"
        style={{ background: palette.light, color: palette.text, border: `1px solid ${palette.accent}30` }}
        onClick={() => onJoin(mod.id)}
        disabled={joining === mod.id}>
        {joining === mod.id
          ? <><RefreshCw className="w-3 h-3 animate-spin" />Joining…</>
          : <><Plus className="w-3 h-3" />Join</>}
      </button>
    </div>
  );
}

// ─── tab bar ─────────────────────────────────────────────────────────────────

function TabBar({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1.5 p-1 rounded-xl" style={{ background: 'var(--sd-card2)', border: '1px solid var(--sd-border)' }}>
      {tabs.map(({ id, label, icon: Icon, count }) => (
        <button key={id} onClick={() => onChange(id)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap flex-1 justify-center"
          style={active === id
            ? { background: 'var(--sd-border)', color: 'var(--sd-text)', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }
            : { color: 'var(--sd-muted)' }}>
          <Icon className="w-3.5 h-3.5" />{label}
          {count != null && (
            <span className="text-xs px-1.5 py-0.5 rounded-full font-medium min-w-[20px] text-center"
              style={active === id
                ? { background: 'var(--sd-indigo-pill-bg)', color: 'var(--sd-indigo-text)' }
                : { background: 'var(--sd-border)', color: 'var(--sd-muted)' }}>
              {count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function StudentDashboard() {
  const { user, logout } = useAuth();

  const [modules,        setModules]        = useState([]);
  const [publicModules,  setPublicModules]  = useState([]);
  const [claims,         setClaims]         = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [activeTab,      setActiveTab]      = useState('my-modules');
  const [showNewModule,  setShowNewModule]  = useState(false);
  const [joiningId,      setJoiningId]      = useState(null);
  const [joinMsg,        setJoinMsg]        = useState(null);
  const [discoverLoaded, setDiscoverLoaded] = useState(false);
  const [sharingMod,     setSharingMod]     = useState(null);

  const [claimForm,    setClaimForm]    = useState({ banner_id: '', access_code: '' });
  const [claimMsg,     setClaimMsg]     = useState(null);
  const [claimLoading, setClaimLoading] = useState(false);
  const [greeting,     setGreeting]     = useState('Welcome back');
  useEffect(() => setGreeting(getGreeting()), []);
  const [showClaim,    setShowClaim]    = useState(false);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const [mods, cls] = await Promise.all([
        apiClient.get('/api/student/my-modules').catch(() => []),
        apiClient.get('/api/claims/my-claims').catch(() => []),
      ]);
      setModules(Array.isArray(mods) ? mods : []);
      setClaims(Array.isArray(cls)  ? cls  : []);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  const fetchPublicModules = useCallback(async () => {
    try {
      const data = await apiClient.get('/api/modules/public').catch(() => []);
      setPublicModules(Array.isArray(data) ? data : []);
    } catch { setPublicModules([]); }
    setDiscoverLoaded(true);
  }, []);

  useEffect(() => { if (user) fetchData(); }, [user, fetchData]);
  useEffect(() => {
    if (activeTab === 'discover' && !discoverLoaded) fetchPublicModules();
  }, [activeTab, discoverLoaded, fetchPublicModules]);

  const enrolledModules = modules.filter(m => m.teacher_id !== user?.id);
  const myModules       = modules.filter(m => m.teacher_id === user?.id);
  const enrolledIds     = new Set(modules.map(m => m.id));
  const discoverList    = publicModules.filter(m => !enrolledIds.has(m.id));
  const canCreate       = user?.can_create_modules;
  const effectiveTab    = (!canCreate && activeTab !== 'enrolled') ? 'enrolled' : activeTab;

  const handleModuleCreated = () => { setShowNewModule(false); fetchData(true); setActiveTab('my-modules'); };

  const handleJoinPublic = async (moduleId) => {
    setJoiningId(moduleId); setJoinMsg(null);
    try {
      await apiClient.post(`/api/student/join-public/${moduleId}`);
      setJoinMsg({ type: 'success', text: 'Joined! Check the Enrolled tab.' });
      fetchData(true); fetchPublicModules();
    } catch (err) {
      setJoinMsg({ type: 'error', text: err?.response?.data?.detail || 'Failed to join module.' });
    } finally { setJoiningId(null); }
  };

  const submitClaim = async (e) => {
    e.preventDefault();
    if (!claimForm.banner_id || !claimForm.access_code) {
      setClaimMsg({ type: 'error', text: 'Both Banner ID and access code are required.' }); return;
    }
    setClaimLoading(true); setClaimMsg(null);
    try {
      const res = await apiClient.post('/api/claims/request', claimForm);
      setClaimMsg({ type: 'success', text: res.message || 'Claim submitted. Awaiting teacher approval.' });
      setClaimForm({ banner_id: '', access_code: '' });
      const updated = await apiClient.get('/api/claims/my-claims').catch(() => []);
      setClaims(Array.isArray(updated) ? updated : []);
    } catch (err) {
      setClaimMsg({ type: 'error', text: err?.response?.data?.detail || err?.message || 'Failed to submit claim.' });
    } finally { setClaimLoading(false); }
  };


  const tabs = [
    ...(canCreate ? [{ id: 'my-modules', label: 'My Modules', icon: Layers, count: myModules.length }] : []),
    { id: 'enrolled',  label: 'Enrolled',  icon: BookOpen, count: enrolledModules.length },
    ...(canCreate ? [{ id: 'discover',   label: 'Discover',   icon: Compass }] : []),
  ];

  // ── loading ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="sd-page min-h-screen flex items-center justify-center" style={{ background: 'var(--sd-bg)' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 20px rgba(99,102,241,0.4)' }}>
          <Brain className="w-5 h-5 text-white" />
        </div>
        <div className="flex gap-1">
          {[0,1,2].map(i => (
            <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
              style={{ background: '#6366f1', animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
        <p className="text-sm" style={{ color: 'var(--sd-muted)' }}>Loading your dashboard…</p>
      </div>
    </div>
  );

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="sd-page min-h-screen flex flex-col" style={{ background: 'var(--sd-bg)', color: 'var(--sd-text)' }}>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden" style={{ background: 'var(--sd-hero)', borderBottom: '1px solid var(--sd-border)' }}>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              <Brain className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-slate-100 truncate">
                {greeting}, <span style={{ color: 'var(--sd-username)' }}>{user?.username}</span>
              </h1>
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <Sparkles className="w-3 h-3 flex-shrink-0" style={{ color: '#6366f1' }} />AI-Powered Learning
              </p>
            </div>
          </div>

          {/* Quick resume */}
          {enrolledModules.filter(m => m.is_active).length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {enrolledModules.filter(m => m.is_active).slice(0, 3).map(mod => {
                const p = getPalette(mod.name);
                return (
                  <Link key={mod.id} href={`/student/module/${mod.id}`}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all hover:scale-[1.02] text-xs font-medium"
                    style={{ background: 'var(--sd-surface)', border: `1px solid ${p.accent}40`, color: p.accent }}>
                    <div className="w-4 h-4 rounded flex items-center justify-center font-bold flex-shrink-0 text-[10px]"
                      style={{ background: p.light }}>
                      {mod.name.charAt(0)}
                    </div>
                    <span className="max-w-[110px] truncate">{mod.name}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">

        {/* Tabs */}
        <TabBar tabs={tabs} active={effectiveTab} onChange={setActiveTab} />

        {/* ── Enrolled tab ── */}
        {effectiveTab === 'enrolled' && (
          <div className="space-y-6">
            {enrolledModules.length === 0 ? (
              <div className="rounded-xl py-20 text-center"
                style={{ background: 'var(--sd-card)', border: '1px solid var(--sd-border)' }}>
                <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-4"
                  style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <BookOpen className="w-6 h-6" style={{ color: '#6366f1' }} />
                </div>
                <p className="font-semibold text-slate-200 mb-1">No modules yet</p>
                <p className="text-sm text-slate-500 max-w-xs mx-auto mb-6">
                  {canCreate
                    ? 'Create a module from the My Modules tab, then share it with others or enroll yourself.'
                    : 'Get an access code from your instructor and join your first module.'}
                </p>
                {!canCreate && (
                  <Link href="/join"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff' }}>
                    <Plus className="w-4 h-4" />Join a Module
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {enrolledModules.map(mod => <EnrolledModuleCard key={mod.id} mod={mod} />)}
              </div>
            )}

            {/* Claim past activity — only for students who don't create modules */}
            {!canCreate && <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--sd-border)' }}>
              <div className="flex items-center justify-between px-5 py-4"
                style={{ background: 'var(--sd-card)' }}>
                <div>
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <BookMarked className="w-3.5 h-3.5 text-slate-500" />
                    Claim Past Activity
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Link a guest session to your account</p>
                </div>
                <button
                  onClick={() => { setShowClaim(v => !v); setClaimMsg(null); }}
                  className="flex items-center gap-1.5 text-xs px-3 h-7 rounded-lg transition-colors"
                  style={showClaim
                    ? { background: 'var(--sd-indigo-pill-bg)', color: 'var(--sd-indigo-text)', border: '1px solid var(--sd-indigo-pill-bd)' }
                    : { background: 'var(--sd-card2)', border: '1px solid var(--sd-border)', color: 'var(--sd-muted)' }}>
                  {showClaim ? 'Cancel' : <><LinkIcon className="w-3 h-3" />New Claim</>}
                </button>
              </div>

              {showClaim && (
                <div className="px-5 pb-5 pt-3" style={{ background: 'var(--sd-card2)', borderTop: '1px solid var(--sd-border)' }}>
                  <form onSubmit={submitClaim} className="space-y-3">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-400">Banner ID</label>
                        <input placeholder="e.g. B00123456"
                          className="w-full h-8 px-3 rounded-lg text-sm outline-none"
                          style={{ background: 'var(--sd-card2)', border: '1px solid var(--sd-border)', color: 'var(--sd-text)' }}
                          value={claimForm.banner_id}
                          onChange={e => setClaimForm(f => ({ ...f, banner_id: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-400">Access Code</label>
                        <input placeholder="e.g. XYZ789"
                          className="w-full h-8 px-3 rounded-lg text-sm outline-none"
                          style={{ background: 'var(--sd-card2)', border: '1px solid var(--sd-border)', color: 'var(--sd-text)' }}
                          value={claimForm.access_code}
                          onChange={e => setClaimForm(f => ({ ...f, access_code: e.target.value }))} />
                      </div>
                    </div>
                    {claimMsg && (
                      <div className="flex items-start gap-2 text-xs p-2.5 rounded-lg"
                        style={claimMsg.type === 'success'
                          ? { background: 'var(--sd-green-bg)', color: 'var(--sd-green-text)', border: '1px solid var(--sd-green-bd)' }
                          : { background: 'var(--sd-red-bg)', color: 'var(--sd-red-text)', border: '1px solid var(--sd-red-bd)' }}>
                        {claimMsg.type === 'success'
                          ? <CheckCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                          : <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />}
                        {claimMsg.text}
                      </div>
                    )}
                    <button type="submit" disabled={claimLoading}
                      className="h-8 px-4 text-xs rounded-lg font-medium disabled:opacity-50"
                      style={{ background: 'var(--sd-indigo-pill-bg)', color: 'var(--sd-indigo-text)', border: '1px solid var(--sd-indigo-pill-bd)' }}>
                      {claimLoading ? 'Submitting…' : 'Submit Claim'}
                    </button>
                  </form>
                </div>
              )}

              {claims.length > 0 && (
                <div className="divide-y" style={{ borderTop: '1px solid var(--sd-border)' }}>
                  {claims.map(c => {
                    const s = claimStatusStyle[c.status] || claimStatusStyle.pending;
                    return (
                      <div key={c.id} className="flex items-center justify-between px-5 py-3"
                        style={{ background: 'var(--sd-card2)' }}>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-200 truncate">{c.module_name || 'Unknown module'}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Banner ID: <span className="font-mono">{c.banner_id}</span>
                            {c.created_at && ` · ${formatDate(c.created_at)}`}
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ml-3 flex-shrink-0"
                          style={{ background: s.bg, color: s.color }}>
                          <ClaimStatusIcon status={c.status} />
                          {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>}
          </div>
        )}

        {/* ── My Modules tab ── */}
        {effectiveTab === 'my-modules' && canCreate && (
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">

            {/* Left: create panel */}
            <div className="sticky top-6">
              <div className="rounded-xl overflow-hidden" style={{ background: 'var(--sd-card)', border: '1px solid var(--sd-border)' }}>
                <div className="h-1" style={{ background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }} />
                <div className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                      <Plus className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-100 text-sm">Create New Module</p>
                      <p className="text-xs text-slate-500">Configure your module settings</p>
                    </div>
                  </div>
                  <button onClick={() => setShowNewModule(true)}
                    className="w-full h-11 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff' }}>
                    <Plus className="w-4 h-4" />Create Module
                  </button>
                  <div className="mt-4 space-y-2.5">
                    {[
                      'Create a module',
                      'Upload your study material',
                      'AI generates practice questions',
                      'Study and review feedback',
                    ].map((step, i) => (
                      <div key={i} className="flex items-center gap-2.5 text-xs" style={{ color: 'var(--sd-muted)' }}>
                        <div className="w-5 h-5 rounded-full flex items-center justify-center font-bold flex-shrink-0 text-[10px]"
                          style={{ background: 'var(--sd-indigo-pill-bg)', color: 'var(--sd-indigo-text)' }}>
                          {i + 1}
                        </div>
                        {step}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: modules grid */}
            <div>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-semibold text-slate-100">Your Modules</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {myModules.length > 0
                      ? `${myModules.length} module${myModules.length !== 1 ? 's' : ''} · upload docs & AI generates questions`
                      : 'No modules yet — create your first one'}
                  </p>
                </div>
              </div>

              {myModules.length === 0 ? (
                <div className="rounded-xl py-16 text-center"
                  style={{ background: 'var(--sd-card)', border: '1px dashed var(--sd-border)' }}>
                  <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-4"
                    style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <Zap className="w-6 h-6" style={{ color: '#f59e0b' }} />
                  </div>
                  <p className="font-semibold text-slate-200 mb-1">No modules created yet</p>
                  <p className="text-sm text-slate-500 max-w-xs mx-auto">
                    Get started by creating your first module using the panel on the left.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {myModules.map(mod => (
                    <MyModuleCard key={mod.id} mod={mod} onShare={m => setSharingMod(m)} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Discover tab ── */}
        {effectiveTab === 'discover' && canCreate && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Public modules from other students — join with one click.
              </p>
              <button
                onClick={() => { setDiscoverLoaded(false); fetchPublicModules(); }}
                className="flex items-center gap-1.5 px-3 h-7 text-xs rounded-lg"
                style={{ background: 'var(--sd-card2)', border: '1px solid var(--sd-border)', color: 'var(--sd-muted)' }}>
                <RefreshCw className="w-3 h-3" />Refresh
              </button>
            </div>

            {joinMsg && (
              <div className="flex items-center gap-2 text-xs p-3 rounded-lg"
                style={joinMsg.type === 'success'
                  ? { background: 'var(--sd-green-bg)', color: 'var(--sd-green-text)', border: '1px solid var(--sd-green-bd)' }
                  : { background: 'var(--sd-red-bg)', color: 'var(--sd-red-text)', border: '1px solid var(--sd-red-bd)' }}>
                {joinMsg.type === 'success'
                  ? <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  : <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />}
                {joinMsg.text}
              </div>
            )}

            {!discoverLoaded ? (
              <div className="flex items-center justify-center py-20">
                <div className="flex gap-1">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
                      style={{ background: '#6366f1', animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            ) : discoverList.length === 0 ? (
              <div className="rounded-xl py-20 text-center"
                style={{ background: 'var(--sd-card)', border: '1px solid var(--sd-border)' }}>
                <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-4"
                  style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <Compass className="w-6 h-6" style={{ color: '#6366f1' }} />
                </div>
                <p className="font-semibold text-slate-200 mb-1">Nothing here yet</p>
                <p className="text-sm text-slate-500 max-w-xs mx-auto">
                  Be the first — create a module and make it public!
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {discoverList.map(mod => (
                  <DiscoverCard key={mod.id} mod={mod} onJoin={handleJoinPublic} joining={joiningId} />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="py-5 mt-auto" style={{ borderTop: '1px solid var(--sd-border)' }}>
        <p className="text-center text-xs text-slate-600">
          AI Pilot · Student Portal ·{' '}
          <a href="mailto:nyu@brockport.edu" className="hover:text-slate-400 transition-colors underline underline-offset-2">
            nyu@brockport.edu
          </a>
        </p>
      </footer>

      {/* ── Dialogs ──────────────────────────────────────────────────────── */}
      {canCreate && (
        <NewModuleDialog
          open={showNewModule}
          onClose={() => setShowNewModule(false)}
          onCreated={handleModuleCreated}
          userId={user?.id}
        />
      )}
      <ShareModuleDialog
        mod={sharingMod}
        open={!!sharingMod}
        onClose={() => setSharingMod(null)}
      />
    </div>
  );
}
