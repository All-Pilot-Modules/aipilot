'use client';

import { useAuth } from "@/context/AuthContext";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Users, FileText, BarChart3, Settings, BookOpen, Copy, RotateCcw, Check, PlusCircle, Shield, CheckCircle, Brain, ClipboardList, ArrowUpRight, MessageSquare, Share2, Globe, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useCallback, Suspense, memo } from "react";
import { apiClient } from "@/lib/auth";
import { MathText } from "@/components/MathText";
import { FullPageLoader } from "@/components/LoadingSpinner";
import { StatCardSkeleton, ModuleCardSkeleton } from "@/components/SkeletonLoader";
const DashboardContent = memo(function DashboardContent() {
  const { user, loading, isAuthenticated } = useAuth();
  const searchParams = useSearchParams();
  const moduleName = searchParams.get('module');
  const [moduleData, setModuleData] = useState({
    accessCode: "",
    totalStudents: 0,
    totalQuestions: 0,
    totalDocuments: 0
  });

  const [dashboardError, setDashboardError] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [moduleId, setModuleId] = useState(null);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Loading states
  const [loadingModuleData, setLoadingModuleData] = useState(true);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [loadingActions, setLoadingActions] = useState(true);

  // New state for dynamic dashboard features
  const [recentActivities, setRecentActivities] = useState([]);
  const [actionItems, setActionItems] = useState({
    pendingGrades: 0,
    inactiveStudents: 0,
    lowPerformanceQuestions: 0
  });
  const [performanceMetrics, setPerformanceMetrics] = useState({
    averageScore: 0,
    completionRate: 0,
    aiFeedbackCount: 0,
    totalSubmissions: 0
  });
  const [studentInsights, setStudentInsights] = useState(null);
  const [progressData, setProgressData] = useState([]);
  const [scoreDistribution, setScoreDistribution] = useState([]);

  const loadModuleData = useCallback(async () => {
    const userId = user?.id || user?.sub;
    if (!userId) {
      console.warn('User ID not available yet');
      return;
    }

    setDashboardError(null);
    setLoadingModuleData(true);
    setLoadingActivities(true);
    setLoadingActions(true);
    setLoadingMetrics(true);
    try {
      const modules = await apiClient.get(`/api/modules?teacher_id=${userId}`);
      const currentModule = modules.find(m => m.name === moduleName);

      if (currentModule) {
        setModuleId(currentModule.id);

        // Single batched call — backend computes everything and caches for 30s
        try {
          const metrics = await apiClient.get(
            `/api/modules/${currentModule.id}/dashboard-metrics?teacher_id=${userId}`
          );

          setStudentInsights(metrics.student_insights || null);
          setModuleData({
            accessCode: metrics.access_code,
            totalStudents: metrics.total_students,
            totalQuestions: metrics.total_questions,
            totalDocuments: metrics.total_documents
          });

          setPerformanceMetrics({
            averageScore: metrics.average_score,
            completionRate: metrics.completion_rate,
            aiFeedbackCount: metrics.ai_feedback_count,
            totalSubmissions: metrics.total_submissions
          });

          setActionItems({
            pendingGrades: metrics.action_items.pending_grades,
            inactiveStudents: metrics.action_items.inactive_students,
            lowPerformanceQuestions: metrics.action_items.low_performance_questions
          });

          // Score distribution — add colors client-side
          const colors = [
            'bg-red-500 dark:bg-red-600',
            'bg-orange-500 dark:bg-orange-600',
            'bg-yellow-500 dark:bg-yellow-600',
            'bg-primary text-primary-foreground',
            'bg-emerald-500 dark:bg-emerald-600'
          ];
          setScoreDistribution(
            (metrics.score_distribution || []).map((r, i) => ({ ...r, color: colors[i] }))
          );

          // Activity chart — convert dateKey strings to date objects for chart
          setProgressData(
            (metrics.activity_chart || []).map(d => ({
              ...d,
              date: new Date(d.dateKey)
            }))
          );

          // Recent activity
          setRecentActivities(
            (metrics.recent_activity || []).map(a => ({
              id: a.id,
              type: 'submission',
              studentName: `Student ${a.student_id}`,
              questionText: `Question`,
              timestamp: a.timestamp,
              score: a.score
            }))
          );

        } catch (error) {
          setDashboardError('Module statistics could not be loaded. Please try again.');
          console.error('Failed to load dashboard metrics:', error);
          setModuleData(prev => ({
            ...prev,
            accessCode: currentModule.access_code
          }));
        }
      }
    } catch (error) {
      setDashboardError('Could not load this module. Please try again.');
      console.error('Failed to load module data:', error);
    } finally {
      setLoadingModuleData(false);
      setLoadingActivities(false);
      setLoadingActions(false);
      setLoadingMetrics(false);
    }
  }, [user?.id, user?.sub, moduleName]);

  // Load real module data from database
  useEffect(() => {
    if (isAuthenticated && (user?.id || user?.sub) && moduleName) {
      loadModuleData();
    }
  }, [isAuthenticated, user?.id, user?.sub, moduleName, loadModuleData]);

  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItems({...copiedItems, [type]: true});
      setTimeout(() => {
        setCopiedItems(prev => ({...prev, [type]: false}));
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const generateModuleUrl = () => {
    const teacherId = user?.id || user?.sub || user?.email || 'teacher';
    return `${window.location.origin}/${teacherId}/${moduleName}`;
  };

  const regenerateAccessCode = async () => {
    try {
      const userId = user?.id || user?.sub;
      if (!userId) {
        console.warn('User ID not available');
        return;
      }

      // Get the current module
      const modules = await apiClient.get(`/api/modules?teacher_id=${userId}`);
      const currentModule = modules.find(m => m.name === moduleName);

      if (currentModule) {
        // Call the real regenerate API
        const updatedModule = await apiClient.post(`/api/modules/${currentModule.id}/regenerate-code`);
        setModuleData(prev => ({...prev, accessCode: updatedModule.access_code}));
        setShowRegenerateDialog(false); // Close the dialog after successful regeneration
      }
    } catch (error) {
      console.error('Failed to regenerate access code:', error);
      setShowRegenerateDialog(false); // Close the dialog even on error
    }
  };

  // Helper function to format time ago
  const getTimeAgo = (timestamp) => {
    if (!timestamp) return 'Just now';

    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return then.toLocaleDateString();
  };

  const dashboardLink = (section) => `/dashboard/${section}?${new URLSearchParams({module: moduleName || '', ...(moduleId ? {moduleId} : {})})}`;
  const attentionItems = [
    {count: actionItems.pendingGrades, title: 'Answers awaiting review', detail: 'Review and finalize student grades.', route: 'grading'},
    {count: actionItems.inactiveStudents, title: 'Students without submissions', detail: 'Check participation and follow up.', route: 'students'},
    {count: actionItems.lowPerformanceQuestions, title: 'Questions averaging below 60%', detail: 'Review difficult questions and their answer keys.', route: 'questions'},
    ...(!loadingModuleData && !moduleData.totalDocuments ? [{count: '→', title: 'Add course materials', detail: 'Upload documents for question generation and the tutor.', route: 'documents'}] : []),
    ...(!loadingModuleData && !moduleData.totalQuestions ? [{count: '→', title: 'Create your first questions', detail: 'Build an assessment for your students.', route: 'questions'}] : []),
  ].filter(item => item.count);

  if (loading) {
    return (
      <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <AppSidebar />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-6">
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
              <ModuleCardSkeleton />
              <ModuleCardSkeleton />
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-muted/50 dark:bg-card flex items-center justify-center p-4">
        <Card className="max-w-md w-full border border-border shadow-lg">
          <CardContent className="pt-12 pb-8 px-8 text-center">
            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <Shield className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground mb-2">Access Denied</h1>
            <p className="text-gray-600 dark:text-muted-foreground mb-8">
              You need to be signed in to access the dashboard.
            </p>
            <Button asChild size="lg" className="w-full bg-emerald-700 hover:bg-emerald-700 text-white">
              <Link href="/sign-in">
                Sign In to Continue
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!moduleName) {
    return (
      <div className="min-h-screen bg-muted/50 dark:bg-card flex items-center justify-center p-4">
        <Card className="max-w-md w-full border border-border shadow-lg">
          <CardContent className="pt-12 pb-8 px-8 text-center">
            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <BookOpen className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground mb-2">No Module Selected</h1>
            <p className="text-gray-600 dark:text-muted-foreground mb-8">
              Please select a module from your modules list to view the dashboard.
            </p>
            <Button asChild size="lg" className="w-full bg-emerald-700 hover:bg-emerald-700 text-white">
              <Link href="/mymodules">
                <BookOpen className="w-4 h-4 mr-2" />
                Go to My Modules
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <SidebarProvider
      open={sidebarOpen}
      onOpenChange={setSidebarOpen}
      style={{
        "--sidebar-width": "calc(var(--spacing) * 72)",
        "--header-height": "calc(var(--spacing) * 12)"
      }}
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <main id="main-content" className="min-w-0 flex-1 bg-muted/20">
          <div className="mx-auto max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
            <header className="flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0">
                <p className="mb-2 text-sm text-muted-foreground">Module overview</p>
                <h1 className="break-words text-3xl font-semibold tracking-tight text-foreground">{moduleName}</h1>
                <p className="mt-2 text-sm text-muted-foreground">Your teaching workspace. See progress and decide what needs attention.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={loadModuleData} disabled={loadingModuleData}><RotateCcw className={`size-4 ${loadingModuleData ? 'animate-spin' : ''}`} />Refresh</Button>
                <Button asChild className="bg-teal-700 text-white hover:bg-teal-800"><Link href={dashboardLink('questions')}><PlusCircle className="size-4" />Manage questions</Link></Button>
              </div>
            </header>

            <section aria-label="Student access" className="flex flex-col gap-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between dark:border-emerald-800 dark:bg-emerald-950/30">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-white"><Share2 className="size-5" /></div>
                <div className="min-w-0">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">Student access code</h2>
                  {loadingModuleData ? <Skeleton className="mt-2 h-8 w-32" /> : <p className="mt-1 break-all font-mono text-2xl font-bold tracking-wider text-emerald-900 dark:text-emerald-200">{moduleData.accessCode || 'Unavailable'}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">Share this code or the invite link with your students.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={loadingModuleData || !moduleData.accessCode} onClick={() => copyToClipboard(moduleData.accessCode, 'code')} className="bg-emerald-700 text-white hover:bg-emerald-800">
                  {copiedItems.code ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {copiedItems.code ? 'Code Copied!' : 'Copy Code'}
                </Button>
                <Button size="sm" variant="outline" disabled={loadingModuleData || !moduleData.accessCode} onClick={() => copyToClipboard(generateModuleUrl(), 'link')}>
                  {copiedItems.link ? <Check className="size-4" /> : <ExternalLink className="size-4" />}
                  {copiedItems.link ? 'Link Copied!' : 'Copy Link'}
                </Button>
                <Button size="sm" variant="outline" disabled={loadingModuleData || !moduleData.accessCode} onClick={() => setShowRegenerateDialog(true)}><RotateCcw className="size-4" />Regenerate</Button>
              </div>
            </section>

            {dashboardError && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{dashboardError}</div>}

            <section aria-label="Module statistics" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {[
                ['Submitting students', moduleData.totalStudents, 'Students with at least one answer', 'students', Users],
                ['Answer submissions', performanceMetrics.totalSubmissions, 'Includes repeat attempts', 'grading', ClipboardList],
                ['Average score', `${performanceMetrics.averageScore}%`, 'Across scored answers', 'analytics', BarChart3],
                ['AI feedback', performanceMetrics.aiFeedbackCount, 'Feedback records available', 'students', Brain],
              ].map(([label, value, detail, route, Icon]) => <Link key={label} href={dashboardLink(route)} className="rounded-xl border bg-background p-5 transition-colors hover:border-teal-500/50 focus-visible:outline-2 focus-visible:outline-teal-600">
                <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground"><span>{label}</span><Icon className="size-4 shrink-0" /></div>
                {loadingModuleData ? <Skeleton className="my-3 h-9 w-20" /> : <p className="my-2 text-3xl font-semibold tracking-tight tabular-nums">{dashboardError ? '—' : value}</p>}
                <p className="text-xs text-muted-foreground">{detail}</p>
              </Link>)}
            </section>

            <section className="space-y-4" aria-label="Student learning analytics">
              <div><h2 className="text-lg font-semibold">Student learning</h2><p className="mt-1 text-sm text-muted-foreground">Based on students who have submitted. Completed AI scores on each latest answer; these are not final teacher grades.</p></div>
              {loadingMetrics ? <Skeleton className="h-32 w-full" /> : !studentInsights || dashboardError ? <p className="rounded-xl border bg-background p-5 text-sm text-muted-foreground">Student analytics are unavailable. Refresh after the backend has loaded the updated analytics service.</p> : <>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {[
                    ['Question coverage', `${studentInsights.question_coverage}%`, 'Unique questions answered; retries counted once'],
                    ['Below 60%', studentInsights.students_below_60, 'Students with a latest scored average below 60%'],
                    ['Repeat attempts', studentInsights.repeat_students, 'Students who submitted more than one attempt'],
                    ['Score change', studentInsights.average_score_change == null ? '—' : `${studentInsights.average_score_change > 0 ? '+' : ''}${studentInsights.average_score_change} pp`, `First to latest on the same questions · ${studentInsights.comparable_students} students`],
                  ].map(([label,value,detail]) => <div key={label} className="rounded-xl border bg-background p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="my-2 text-2xl font-semibold tabular-nums">{value}</p><p className="text-xs leading-relaxed text-muted-foreground">{detail}</p></div>)}
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <section className="overflow-hidden rounded-xl border bg-background"><div className="border-b p-5"><h3 className="font-semibold">Student overview</h3><p className="mt-1 text-xs text-muted-foreground">Lowest scored averages first. Open a student for their answers and feedback.</p></div><div className="max-h-80 overflow-auto"><table className="w-full text-left text-sm"><thead className="bg-muted/40 text-xs text-muted-foreground"><tr><th className="px-5 py-3">Student</th><th className="p-3">Answered</th><th className="p-3">AI average</th><th className="p-3">Attempts</th></tr></thead><tbody className="divide-y">{studentInsights.students.map(student => <tr key={student.student_id}><td className="max-w-48 break-words px-5 py-3"><Link className="text-teal-700 underline-offset-4 hover:underline dark:text-teal-400" href={`/dashboard/students/${encodeURIComponent(student.student_id)}?${new URLSearchParams({module:moduleName,moduleId})}`}>{student.student_id}</Link></td><td className="p-3 tabular-nums">{student.answered_questions}/{moduleData.totalQuestions}</td><td className="p-3 tabular-nums">{student.average_score == null ? 'Pending' : `${student.average_score}%`}<span className="block text-xs text-muted-foreground">{student.scored_questions} scored</span></td><td className="p-3 tabular-nums">{student.attempts}</td></tr>)}</tbody></table>{!studentInsights.students.length && <p className="p-5 text-sm text-muted-foreground">Students will appear after their first submission.</p>}</div></section>
                  <section className="rounded-xl border bg-background p-5"><h3 className="font-semibold">Questions to review</h3><p className="mt-1 text-xs text-muted-foreground">Lowest averages using each student’s latest answer. Small samples may not reflect question difficulty.</p><div className="mt-4 space-y-4">{studentInsights.question_difficulty.slice(0,5).map(question => <Link key={question.question_id} href={dashboardLink('questions')} className="block rounded-lg p-2 -mx-2 hover:bg-muted/50"><div className="mb-2 flex justify-between gap-3 text-sm"><span className="min-w-0"><MathText>{question.question_text || "Question"}</MathText><span className="text-xs text-muted-foreground">{question.student_count} scored students</span></span><span className="tabular-nums">{question.average_score}%</span></div><div className="h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-teal-600" style={{width:`${Math.max(0,Math.min(100,question.average_score))}%`}} /></div></Link>)}{!studentInsights.question_difficulty.length && <p className="text-sm text-muted-foreground">Available after feedback is successfully graded.</p>}</div></section>
                </div>
              </>}
            </section>

            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0 space-y-6">
                <section className="rounded-xl border bg-background p-5 sm:p-6">
                  <div className="mb-4 flex items-center justify-between gap-3"><h2 className="font-semibold">Needs attention</h2><span className="text-xs text-muted-foreground">Recommended next steps</span></div>
                  {loadingActions ? <Skeleton className="h-24 w-full" /> : dashboardError ? <p className="text-sm text-muted-foreground">Review tasks are unavailable until statistics load.</p> : <div className="divide-y">
                    {attentionItems.length ? attentionItems.map(item => <Link key={item.title} href={dashboardLink(item.route)} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0 group">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-sm font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">{item.count}</span>
                      <div className="min-w-0 flex-1"><p className="text-sm font-medium group-hover:text-teal-700 dark:group-hover:text-teal-400">{item.title}</p><p className="mt-1 text-sm text-muted-foreground">{item.detail}</p></div><ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
                    </Link>) : <div className="flex items-center gap-3 py-2"><CheckCircle className="size-5 text-emerald-600 dark:text-emerald-300" /><div><p className="text-sm font-medium">You’re up to date</p><p className="mt-1 text-sm text-muted-foreground">No review tasks flagged for this module.</p></div></div>}
                  </div>}
                </section>

                <section className="rounded-xl border bg-background p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">Submission activity</h2><p className="mt-1 text-sm text-muted-foreground">Answer submissions over the last 7 days</p></div><Link href={dashboardLink('analytics')} className="text-sm font-medium text-teal-700 hover:underline dark:text-teal-400">View analytics ↗</Link></div>
                  {loadingMetrics ? <Skeleton className="mt-6 h-40 w-full" /> : dashboardError ? <p className="py-10 text-sm text-muted-foreground">Activity could not be loaded.</p> : <div className="mt-6 grid grid-cols-7 gap-2 sm:gap-4" aria-label="Daily answer submissions">
                    {progressData.map(day => <div key={day.dateKey} className="min-w-0 text-center"><div className="flex h-32 flex-col justify-end gap-2"><span className="text-xs tabular-nums text-muted-foreground">{day.count}</span><div className="mx-auto w-full max-w-12 rounded-t-md bg-teal-600/80 dark:bg-teal-500/70" style={{height: `${Math.max(2, day.count / Math.max(1, ...progressData.map(d => d.count)) * 94)}px`}} /></div><p className="mt-3 text-xs text-muted-foreground">{day.dayName}</p></div>)}
                  </div>}
                </section>

                <section className="overflow-hidden rounded-xl border bg-background">
                  <div className="flex items-center justify-between gap-3 border-b px-5 py-4"><h2 className="font-semibold">Recent submissions</h2><Link href={dashboardLink('students')} className="text-sm text-teal-700 hover:underline dark:text-teal-400">View students ↗</Link></div>
                  {loadingActivities ? <div className="space-y-3 p-5"><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : dashboardError ? <p className="p-5 text-sm text-muted-foreground">Recent submissions could not be loaded.</p> : recentActivities.length ? <ul className="divide-y">{recentActivities.slice(0,5).map(activity => <li key={activity.id} className="flex items-center gap-3 px-5 py-4"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{activity.studentName}</p><p className="mt-1 text-xs text-muted-foreground">Answer submitted · {getTimeAgo(activity.timestamp)}</p></div><span className="rounded-md bg-muted px-2.5 py-1 text-sm tabular-nums">{activity.score == null ? 'Not scored' : `${activity.score}%`}</span></li>)}</ul> : <div className="p-6"><p className="text-sm font-medium">No submissions yet</p><p className="mt-1 text-sm text-muted-foreground">Share the module link to invite students. Their activity will appear here.</p></div>}
                </section>
              </div>

              <aside className="min-w-0 space-y-6" aria-label="Module tools">
                <section className="rounded-xl border bg-background p-5"><h2 className="mb-3 font-semibold">Module workspace</h2><nav aria-label="Module shortcuts" className="divide-y">{[
                  ['documents', 'Documents', `${moduleData.totalDocuments} course files`, FileText],
                  ['questions', 'Questions', `${moduleData.totalQuestions} questions`, BookOpen],
                  ['grading', 'Grading', 'Review student answers', ClipboardList],
                  ['survey/responses', 'Survey responses', 'Hear from your students', MessageSquare],
                  ['rubric', 'Feedback rubric', 'Manage grading guidance', Settings],
                ].map(([route,label,detail,Icon]) => <Link key={route} href={dashboardLink(route)} className="group flex items-center gap-3 py-3"><Icon className="size-4 shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="text-sm font-medium group-hover:text-teal-700 dark:group-hover:text-teal-400">{label}</p><p className="mt-0.5 text-xs text-muted-foreground">{dashboardError && ['documents','questions'].includes(route) ? 'Open to view' : detail}</p></div><ArrowUpRight className="size-3.5 text-muted-foreground" /></Link>)}</nav></section>

                <section className="rounded-xl border bg-background p-5"><h2 className="font-semibold">Score distribution</h2><p className="mt-1 text-xs text-muted-foreground">Scored answers across all attempts</p><div className="mt-4 space-y-3">{loadingMetrics ? <Skeleton className="h-24" /> : dashboardError ? <p className="text-sm text-muted-foreground">Scores unavailable.</p> : scoreDistribution.some(range => range.count > 0) ? scoreDistribution.map(range => <div key={range.range}><div className="mb-1.5 flex justify-between text-xs"><span className="text-muted-foreground">{range.range}</span><span className="tabular-nums">{range.count}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-teal-600/70" style={{width: `${range.count / Math.max(1, scoreDistribution.reduce((total, r) => total + r.count, 0)) * 100}%`}} /></div></div>) : <p className="text-sm text-muted-foreground">Scores will appear after answers are graded.</p>}</div></section>
              </aside>
            </div>
          </div>
        </main>
      </SidebarInset>

      {/* Confirmation Dialog for Regenerating Access Code */}
      <AlertDialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate Access Code?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <div>
                  Are you sure you want to regenerate the access code for this module?
                </div>
                <div className="font-semibold text-orange-600 dark:text-orange-400">
                  ⚠️ Warning: The current access code will immediately become invalid.
                </div>
                <div className="text-sm">
                  Students with the old code will no longer be able to access the module.
                  You will need to share the new code with all students.
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={regenerateAccessCode}
              className="bg-orange-700 text-white hover:bg-orange-800 focus:ring-orange-600"
            >
              Yes, Regenerate Code
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
});

export default function Dashboard() {
  return (
    <Suspense fallback={<FullPageLoader text="Loading dashboard..." />}>
      <DashboardContent />
    </Suspense>
  );
}