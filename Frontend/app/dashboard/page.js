'use client';

import { useAuth } from "@/context/AuthContext";
import { useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
import {
  Users,
  FileText,
  BarChart3,
  Settings,
  TrendingUp,
  Clock,
  BookOpen,
  Target,
  Award,
  Activity,
  Copy,
  RotateCcw,
  ExternalLink,
  Check,
  Share2,
  Eye,
  PlusCircle,
  Calendar,
  ChevronUp,
  Download,
  Bell,
  Zap,
  Shield,
  Globe,
  Star,
  Sparkles,
  CheckCircle,
  XCircle,
  Brain,
  ClipboardList
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useCallback, Suspense, memo } from "react";
import { apiClient } from "@/lib/auth";
import { useAPI } from "@/lib/useSWR";
import { FullPageLoader } from "@/components/LoadingSpinner";
import { StatCardSkeleton, ModuleCardSkeleton } from "@/components/SkeletonLoader";

const DashboardContent = memo(function DashboardContent() {
  const { user, loading, isAuthenticated } = useAuth();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const moduleName = searchParams.get('module');
  const [moduleData, setModuleData] = useState({
    accessCode: "",
    totalStudents: 0,
    totalQuestions: 0,
    totalDocuments: 0
  });

  const [copiedItems, setCopiedItems] = useState({});
  const [moduleId, setModuleId] = useState(null);
  const [rubricSummary, setRubricSummary] = useState(null);
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
  const [progressData, setProgressData] = useState([]);
  const [scoreDistribution, setScoreDistribution] = useState([]);

  const loadRubricSummary = useCallback(async (id) => {
    try {
      const data = await apiClient.get(`/api/modules/${id}/rubric`);
      console.log('📊 Rubric data loaded:', data);
      setRubricSummary(data);
    } catch (error) {
      console.error('Failed to load rubric:', error);
      // Set default values if rubric doesn't exist
      setRubricSummary({
        rubric: {
          feedback_style: {
            tone: 'encouraging',
            detail_level: 'detailed'
          },
          rag_settings: {
            enabled: true
          },
          custom_instructions: null
        }
      });
    }
  }, []);

  // Load recent activities
  const loadRecentActivities = useCallback(async (moduleId, prefetchedAnswers = null) => {
    setLoadingActivities(true);
    try {
      // Get recent student answers
      const answersData = prefetchedAnswers ?? await apiClient.get(`/api/student-answers/?module_id=${moduleId}`);

      if (Array.isArray(answersData)) {
        // Sort by timestamp and take last 10
        const sortedActivities = answersData
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 10)
          .map(answer => ({
            id: answer.id,
            type: 'submission',
            studentName: answer.student_name || `Student ${answer.student_id}`,
            questionText: answer.question_text || `Question ${answer.question_id}`,
            timestamp: answer.created_at,
            score: answer.score
          }));

        setRecentActivities(sortedActivities);
      }
    } catch (error) {
      console.error('Failed to load recent activities:', error);
      setRecentActivities([]);
    } finally {
      setLoadingActivities(false);
    }
  }, []);

  // Load action items (things needing attention)
  const loadActionItems = useCallback(async (moduleId, prefetchedAnswers = null) => {
    setLoadingActions(true);
    try {
      const answersData = prefetchedAnswers ?? await apiClient.get(`/api/student-answers/?module_id=${moduleId}`);

      if (Array.isArray(answersData)) {
        // Count submissions that need manual grading (marked for teacher review)
        const pendingGrades = answersData.filter(a =>
          a.needs_teacher_review === true || a.teacher_grade === null
        ).length;

        // Count unique students who haven't submitted anything
        const uniqueStudents = new Set(answersData.map(a => a.student_id));
        const inactiveStudents = Math.max(0, moduleData.totalStudents - uniqueStudents.size);

        // Find questions with low average scores (< 60%)
        const questionScores = {};
        answersData.forEach(answer => {
          if (answer.score !== null && answer.score !== undefined) {
            if (!questionScores[answer.question_id]) {
              questionScores[answer.question_id] = { total: 0, count: 0 };
            }
            questionScores[answer.question_id].total += answer.score;
            questionScores[answer.question_id].count += 1;
          }
        });

        const lowPerformanceQuestions = Object.values(questionScores).filter(q => {
          const avg = q.total / q.count;
          return avg < 60;
        }).length;

        setActionItems({
          pendingGrades,
          inactiveStudents,
          lowPerformanceQuestions
        });
      }
    } catch (error) {
      console.error('Failed to load action items:', error);
    } finally {
      setLoadingActions(false);
    }
  }, [moduleData.totalStudents]);

  // Load performance metrics
  const loadPerformanceMetrics = useCallback(async (moduleId, prefetchedAnswers = null) => {
    setLoadingMetrics(true);
    try {
      const answersData = prefetchedAnswers ?? await apiClient.get(`/api/student-answers/?module_id=${moduleId}`);

      if (Array.isArray(answersData) && answersData.length > 0) {
        // Calculate average score
        const scoresWithValues = answersData.filter(a => a.score !== null && a.score !== undefined);
        const averageScore = scoresWithValues.length > 0
          ? scoresWithValues.reduce((sum, a) => sum + a.score, 0) / scoresWithValues.length
          : 0;

        // Calculate completion rate
        const questionsData = await apiClient.get(`/api/questions/by-module?module_id=${moduleId}&status=all`);
        const totalPossibleSubmissions = moduleData.totalStudents * (Array.isArray(questionsData) ? questionsData.length : 0);
        const completionRate = totalPossibleSubmissions > 0
          ? (answersData.length / totalPossibleSubmissions) * 100
          : 0;

        // Count AI feedback instances
        const aiFeedbackCount = answersData.filter(a => a.ai_feedback && a.ai_feedback.length > 0).length;

        setPerformanceMetrics({
          averageScore: Math.round(averageScore),
          completionRate: Math.round(completionRate),
          aiFeedbackCount,
          totalSubmissions: answersData.length
        });
      }
    } catch (error) {
      console.error('Failed to load performance metrics:', error);
    } finally {
      setLoadingMetrics(false);
    }
  }, [moduleData.totalStudents]);

  // Load progress data for chart
  const loadProgressData = useCallback(async (moduleId, prefetchedAnswers = null) => {
    try {
      const answersData = prefetchedAnswers ?? await apiClient.get(`/api/student-answers/?module_id=${moduleId}`);

      if (Array.isArray(answersData) && answersData.length > 0) {
        // Group submissions by date (last 7 days)
        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          d.setHours(0, 0, 0, 0);
          return d;
        });

        const submissionsByDate = {};
        last7Days.forEach(date => {
          const dateKey = date.toISOString().split('T')[0];
          submissionsByDate[dateKey] = 0;
        });

        answersData.forEach(answer => {
          if (!answer.created_at) return; // Skip if no created_at date

          const answerDate = new Date(answer.created_at);

          // Check if date is valid
          if (isNaN(answerDate.getTime())) {
            console.warn('Invalid date found:', answer.created_at);
            return; // Skip invalid dates
          }

          const dateKey = answerDate.toISOString().split('T')[0];
          if (submissionsByDate.hasOwnProperty(dateKey)) {
            submissionsByDate[dateKey]++;
          }
        });

        // Convert to chart data with proper date objects
        const chartData = last7Days.map(date => {
          const dateKey = date.toISOString().split('T')[0];
          return {
            date: date,
            dateKey: dateKey,
            dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
            count: submissionsByDate[dateKey] || 0
          };
        });

        console.log('📊 Chart data prepared:', chartData);
        setProgressData(chartData);
      } else {
        // No data - show empty 7 days
        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          return {
            date: d,
            dateKey: d.toISOString().split('T')[0],
            dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
            count: 0
          };
        });
        console.log('📊 No submission data - showing empty 7 days:', last7Days);
        setProgressData(last7Days);
      }
    } catch (error) {
      console.error('Failed to load progress data:', error);
      setProgressData([]);
    }
  }, []);

  // Load score distribution for chart
  const loadScoreDistribution = useCallback(async (moduleId, prefetchedAnswers = null) => {
    try {
      const answersData = prefetchedAnswers ?? await apiClient.get(`/api/student-answers/?module_id=${moduleId}`);

      if (Array.isArray(answersData) && answersData.length > 0) {
        // Filter answers with scores
        const scoredAnswers = answersData.filter(a => a.score !== null && a.score !== undefined);

        if (scoredAnswers.length > 0) {
          // Create score ranges
          const ranges = [
            { range: '0-20%', min: 0, max: 20, count: 0, color: 'bg-red-500 dark:bg-red-600' },
            { range: '21-40%', min: 21, max: 40, count: 0, color: 'bg-orange-500 dark:bg-orange-600' },
            { range: '41-60%', min: 41, max: 60, count: 0, color: 'bg-yellow-500 dark:bg-yellow-600' },
            { range: '61-80%', min: 61, max: 80, count: 0, color: 'bg-blue-500 dark:bg-blue-600' },
            { range: '81-100%', min: 81, max: 100, count: 0, color: 'bg-emerald-500 dark:bg-emerald-600' }
          ];

          scoredAnswers.forEach(answer => {
            const score = answer.score;
            const rangeIndex = ranges.findIndex(r => score >= r.min && score <= r.max);
            if (rangeIndex >= 0) {
              ranges[rangeIndex].count++;
            }
          });

          setScoreDistribution(ranges);
        } else {
          setScoreDistribution([]);
        }
      } else {
        setScoreDistribution([]);
      }
    } catch (error) {
      console.error('Failed to load score distribution:', error);
      setScoreDistribution([]);
    }
  }, []);

  const loadModuleData = useCallback(async () => {
    if (!user) return;

    const userId = user?.id || user?.sub;
    if (!userId) {
      console.warn('User ID not available yet');
      return;
    }

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
            'bg-blue-500 dark:bg-blue-600',
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

          // Rubric summary
          if (metrics.rubric_summary) {
            setRubricSummary(metrics.rubric_summary);
          }
        } catch (error) {
          console.error('Failed to load dashboard metrics:', error);
          setModuleData(prev => ({
            ...prev,
            accessCode: currentModule.access_code
          }));
        }
      }
    } catch (error) {
      console.error('Failed to load module data:', error);
    } finally {
      setLoadingModuleData(false);
      setLoadingActivities(false);
      setLoadingActions(false);
      setLoadingMetrics(false);
    }
  }, [user, moduleName]);

  // Load real module data from database
  useEffect(() => {
    if (isAuthenticated && user && (user.id || user.sub) && moduleName) {
      loadModuleData();
    }
  }, [isAuthenticated, user, moduleName, loadModuleData]);

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

  // Function to check if a navigation item is active
  const isActiveSection = (section) => {
    return pathname.includes(`/dashboard/${section}`);
  };

  // Check if we're on the main dashboard
  const isMainDashboard = pathname === '/dashboard' || (!pathname.includes('/dashboard/') && pathname.includes('/dashboard'));

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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border border-gray-200 dark:border-gray-800 shadow-lg">
          <CardContent className="pt-12 pb-8 px-8 text-center">
            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <Shield className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              You need to be signed in to access the dashboard.
            </p>
            <Button asChild size="lg" className="w-full bg-emerald-600 hover:bg-emerald-700">
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border border-gray-200 dark:border-gray-800 shadow-lg">
          <CardContent className="pt-12 pb-8 px-8 text-center">
            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <BookOpen className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No Module Selected</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              Please select a module from your modules list to view the dashboard.
            </p>
            <Button asChild size="lg" className="w-full bg-emerald-600 hover:bg-emerald-700">
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
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <div className="max-w-[1600px] mx-auto px-6 py-8">
            {/* Clean Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
                    {moduleName}
                  </h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Module Overview
                  </p>
                </div>
                <Badge variant="outline" className="px-4 py-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse"></div>
                  Active
                </Badge>
              </div>
            </div>
            {/* Compact Stats Row - Inspired by Screenshot */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {/* Total Students */}
              <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                      <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide font-semibold">Students</p>
                  {loadingModuleData ? (
                    <Skeleton className="h-9 w-16" />
                  ) : (
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">{moduleData.totalStudents}</p>
                  )}
                </CardContent>
              </Card>

              {/* Total Questions */}
              <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide font-semibold">Questions</p>
                  {loadingModuleData ? (
                    <Skeleton className="h-9 w-16" />
                  ) : (
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">{moduleData.totalQuestions}</p>
                  )}
                </CardContent>
              </Card>

              {/* Avg Score */}
              <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <Award className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide font-semibold">Avg Score</p>
                  {loadingMetrics ? (
                    <Skeleton className="h-9 w-20" />
                  ) : (
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">{performanceMetrics.averageScore}%</p>
                  )}
                </CardContent>
              </Card>

              {/* Student Access Card - Premium Interactive Design */}
              {loadingModuleData ? (
                <Card className="relative overflow-hidden border-2 border-emerald-200 dark:border-emerald-700 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/30 shadow-lg">
                  <CardContent className="p-5 relative">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <Skeleton className="h-3 w-24 mb-2" />
                        <Skeleton className="h-8 w-32" />
                      </div>
                      <Skeleton className="w-10 h-10 rounded-lg" />
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <Skeleton className="w-3 h-3 rounded-full" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Skeleton className="h-9 w-full rounded" />
                      <Skeleton className="h-9 w-full rounded" />
                      <Skeleton className="h-9 w-full rounded" />
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="relative overflow-hidden border-2 border-emerald-200 dark:border-emerald-700 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/30 shadow-lg hover:shadow-xl transition-all duration-300">
                  <CardContent className="p-5 relative">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide mb-2">Access Code</p>
                        <div className="font-mono text-2xl font-black text-emerald-700 dark:text-emerald-300">
                          {moduleData.accessCode}
                        </div>
                      </div>
                      <div className="p-2 bg-emerald-600 dark:bg-emerald-700 rounded-lg">
                        <Share2 className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 mb-3">
                      <Globe className="w-3 h-3" />
                      <span className="text-xs font-semibold">For student access</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        onClick={() => copyToClipboard(moduleData.accessCode, 'code')}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-md hover:shadow-lg h-9 text-xs font-semibold transition-all"
                      >
                        {copiedItems.code ? (
                          <>
                            <Check className="w-3 h-3 mr-2" />
                            Code Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 mr-2" />
                            Copy Code
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => copyToClipboard(generateModuleUrl(), 'link')}
                        variant="outline"
                        className="w-full h-9 text-xs font-semibold border-2 border-emerald-600 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600 hover:text-white transition-all"
                      >
                        {copiedItems.link ? (
                          <>
                            <Check className="w-3 h-3 mr-2" />
                            Link Copied!
                          </>
                        ) : (
                          <>
                            <ExternalLink className="w-3 h-3 mr-2" />
                            Copy Link
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowRegenerateDialog(true)}
                        className="w-full h-9 text-xs font-semibold border-2 border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                      >
                        <RotateCcw className="w-3 h-3 mr-2" />
                        Regenerate
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Action Items Alert - Only Show if There Are Items */}
            {loadingActions ? (
              <div className="bg-gradient-to-br from-amber-50/50 to-orange-50/30 dark:from-amber-950/10 dark:to-orange-950/5 border border-amber-200 dark:border-amber-900/40 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Skeleton className="w-4 h-4 rounded" />
                  <Skeleton className="h-4 w-48" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-3">
                        <Skeleton className="w-10 h-10 rounded-lg flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (actionItems.pendingGrades > 0 || actionItems.inactiveStudents > 0 || actionItems.lowPerformanceQuestions > 0) && (
              <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Bell className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  <p className="text-sm font-semibold text-orange-900 dark:text-orange-100">Needs Your Attention</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {actionItems.pendingGrades > 0 && (
                    <Link href={`/dashboard/grading?module=${moduleName}`}>
                      <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-600 cursor-pointer transition-all">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                            <ClipboardList className="w-4 h-4 text-red-600 dark:text-red-400" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{actionItems.pendingGrades} Pending Grades</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Review needed</p>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )}
                  {actionItems.inactiveStudents > 0 && (
                    <Link href={`/dashboard/students?module=${moduleName}`}>
                      <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-600 cursor-pointer transition-all">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                            <Users className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{actionItems.inactiveStudents} Inactive</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">No submissions yet</p>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )}
                  {actionItems.lowPerformanceQuestions > 0 && (
                    <Link href={`/dashboard/questions?module=${moduleName}`}>
                      <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-600 cursor-pointer transition-all">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <Target className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{actionItems.lowPerformanceQuestions} Low Scores</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Review questions</p>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* Score Distribution Chart - New Addition */}
            {scoreDistribution.length > 0 && (
              <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm mb-6">
                <CardHeader className="border-b border-slate-200 dark:border-slate-700 pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold text-slate-900 dark:text-white">
                      Score Distribution
                    </CardTitle>
                    <Badge variant="outline" className="text-xs">Performance Overview</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {scoreDistribution.map((range, index) => {
                      const maxCount = Math.max(...scoreDistribution.map(r => r.count), 1);
                      const percentage = (range.count / maxCount) * 100;
                      return (
                        <div key={range.range} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-4 h-4 rounded ${range.color}`}></div>
                              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{range.range}</span>
                            </div>
                            <span className="text-sm font-bold text-slate-900 dark:text-white">{range.count} submission{range.count !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="relative w-full h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`absolute top-0 left-0 h-full ${range.color} rounded-full transition-all duration-500`}
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Highest Score</p>
                        <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                          {Math.max(...scoreDistribution.flatMap(r => r.count > 0 ? [r.max] : [0]))}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Avg Score</p>
                        <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                          {performanceMetrics.averageScore}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Graded</p>
                        <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                          {scoreDistribution.reduce((sum, r) => sum + r.count, 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              {/* Activity Chart - Takes 2 columns */}
              <Card className="lg:col-span-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                <CardHeader className="border-b border-slate-200 dark:border-slate-700 pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold text-slate-900 dark:text-white">
                      Activity Overview
                    </CardTitle>
                    <Badge variant="outline" className="text-xs">Last 7 Days</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  {loadingMetrics ? (
                    <>
                      {/* Metrics Row Skeleton */}
                      <div className="grid grid-cols-4 gap-4 mb-6">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div key={i}>
                            <Skeleton className="h-3 w-24 mb-2" />
                            <Skeleton className="h-8 w-16" />
                          </div>
                        ))}
                      </div>
                      {/* Chart Skeleton */}
                      <div>
                        <Skeleton className="h-4 w-32 mb-4" />
                        <div className="flex items-end justify-between gap-3 h-40">
                          {Array.from({ length: 7 }).map((_, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-2">
                              <Skeleton className="w-full rounded-t-lg" style={{ height: `${Math.random() * 100}%`, minHeight: '20px' }} />
                              <Skeleton className="h-3 w-8" />
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Metrics Row */}
                      <div className="grid grid-cols-4 gap-4 mb-6">
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Submissions</p>
                          <p className="text-2xl font-bold text-slate-900 dark:text-white">{performanceMetrics.totalSubmissions}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">AI Feedback</p>
                          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{performanceMetrics.aiFeedbackCount}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Documents</p>
                          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{moduleData.totalDocuments}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Avg Score</p>
                          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{performanceMetrics.averageScore}%</p>
                        </div>
                      </div>

                      {/* Chart */}
                      {progressData.length > 0 ? (
                    <div>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Submission Activity</p>
                      <div className="flex items-end justify-between gap-2 h-40">
                        {progressData.map((day, index) => {
                          const maxCount = Math.max(...progressData.map(d => d.count), 1);
                          const height = (day.count / maxCount) * 100;
                          // Get day name safely
                          const dayLabel = day.dayName ||
                                          (day.date ? new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }) : '') ||
                                          `Day ${index + 1}`;
                          return (
                            <div key={day.dateKey || index} className="flex-1 flex flex-col items-center gap-2">
                              <div
                                className="w-full bg-gradient-to-t from-emerald-500 to-emerald-400 dark:from-emerald-600 dark:to-emerald-500 rounded-t-lg hover:from-emerald-600 hover:to-emerald-500 dark:hover:from-emerald-500 dark:hover:to-emerald-400 transition-all relative group shadow-sm"
                                style={{ height: `${height}%`, minHeight: day.count > 0 ? '12px' : '4px' }}
                              >
                                {day.count > 0 && (
                                  <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-gray-900 dark:bg-gray-700 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 shadow-lg">
                                    {day.count} submission{day.count !== 1 ? 's' : ''}
                                  </div>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                {dayLabel}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                        <div className="text-center py-8">
                          <BarChart3 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                          <p className="text-sm text-slate-500 dark:text-slate-400">No activity data yet</p>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Recent Activity Feed */}
              <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                <CardHeader className="border-b border-slate-200 dark:border-slate-700 pb-4">
                  <CardTitle className="text-lg font-bold text-slate-900 dark:text-white">
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  {loadingActivities ? (
                    <div className="space-y-3">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="pb-3 border-b border-slate-100 dark:border-slate-700 last:border-0">
                          <div className="flex items-start gap-3">
                            <Skeleton className="w-10 h-10 rounded-lg flex-shrink-0" />
                            <div className="flex-1 space-y-2">
                              <Skeleton className="h-4 w-3/4" />
                              <Skeleton className="h-3 w-1/2" />
                              <div className="flex items-center gap-2">
                                <Skeleton className="h-3 w-16" />
                                <Skeleton className="h-5 w-12 rounded" />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : recentActivities.length > 0 ? (
                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                      {recentActivities.map((activity) => {
                        const timeAgo = getTimeAgo(activity.timestamp);
                        const scoreColor = activity.score >= 80 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' :
                                          activity.score >= 60 ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                                          'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300';

                        return (
                          <div key={activity.id} className="pb-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
                            <div className="flex items-start gap-3">
                              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex-shrink-0">
                                <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-gray-900 dark:text-white mb-0.5 truncate">
                                  {activity.studentName}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 truncate">
                                  {activity.questionText}
                                </p>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-400 dark:text-gray-500">{timeAgo}</span>
                                  {activity.score !== null && activity.score !== undefined && (
                                    <>
                                      <span className="text-gray-300 dark:text-gray-600">•</span>
                                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${scoreColor}`}>
                                        {activity.score}%
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Activity className="w-6 h-6 text-gray-400" />
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">No recent activity</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Submissions will appear here</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Quick Links Section */}
            <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
              <CardHeader className="border-b border-slate-200 dark:border-slate-700 pb-4">
                <CardTitle className="text-lg font-bold text-slate-900 dark:text-white">
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Link href={`/dashboard/questions?module=${moduleName}`} className="group">
                    <div className="p-5 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 border border-emerald-200 dark:border-emerald-800 rounded-xl hover:shadow-lg transition-all cursor-pointer">
                      <div className="flex flex-col items-center text-center gap-3">
                        <div className="p-3 bg-emerald-600 dark:bg-emerald-700 rounded-lg">
                          <PlusCircle className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">Add Question</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">Create new</p>
                        </div>
                      </div>
                    </div>
                  </Link>

                  <Link href={`/dashboard/students?module=${moduleName}`} className="group">
                    <div className="p-5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl hover:shadow-lg hover:border-emerald-400 dark:hover:border-emerald-600 transition-all cursor-pointer">
                      <div className="flex flex-col items-center text-center gap-3">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                          <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">Students</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">View all</p>
                        </div>
                      </div>
                    </div>
                  </Link>

                  <Link href={`/dashboard/grading?module=${moduleName}`} className="group">
                    <div className="p-5 bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-800/10 border border-amber-200 dark:border-amber-800 rounded-xl hover:shadow-lg transition-all cursor-pointer">
                      <div className="flex flex-col items-center text-center gap-3">
                        <div className="p-3 bg-amber-600 dark:bg-amber-700 rounded-lg">
                          <ClipboardList className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">Grade</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">Review work</p>
                        </div>
                      </div>
                    </div>
                  </Link>

                  <Link href={`/dashboard/analytics?module=${moduleName}`} className="group">
                    <div className="p-5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl hover:shadow-lg hover:border-purple-400 dark:hover:border-purple-600 transition-all cursor-pointer">
                      <div className="flex flex-col items-center text-center gap-3">
                        <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                          <BarChart3 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">Analytics</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">View data</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
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
              className="bg-orange-600 hover:bg-orange-700 focus:ring-orange-600"
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