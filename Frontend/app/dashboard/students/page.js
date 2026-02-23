'use client';

import { useAuth } from "@/context/AuthContext";
import { useSearchParams } from "next/navigation";
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search, Users, AlertCircle, X, Calendar, Clock, Award, BookOpen, TrendingUp, TrendingDown, Minus, User, Edit, Trash2, MoreHorizontal, UserPlus, Save, CheckCircle, XCircle, HelpCircle, List, ExternalLink, Filter, SortAsc, SortDesc, Download, FileText, FileJson, GraduationCap, Target, BarChart3, Activity, Zap, Shield } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useCallback, useRef, Suspense, useMemo, memo } from "react";
import { apiClient } from "@/lib/auth";
import { useAPI, prefetchAPI } from "@/lib/useSWR";
import { useRouter } from "next/navigation";

// Dynamically import AlertDialog components
const AlertDialog = dynamic(() => import("@/components/ui/alert-dialog").then(mod => ({ default: mod.AlertDialog })), { ssr: false });
const AlertDialogAction = dynamic(() => import("@/components/ui/alert-dialog").then(mod => ({ default: mod.AlertDialogAction })), { ssr: false });
const AlertDialogCancel = dynamic(() => import("@/components/ui/alert-dialog").then(mod => ({ default: mod.AlertDialogCancel })), { ssr: false });
const AlertDialogContent = dynamic(() => import("@/components/ui/alert-dialog").then(mod => ({ default: mod.AlertDialogContent })), { ssr: false });
const AlertDialogDescription = dynamic(() => import("@/components/ui/alert-dialog").then(mod => ({ default: mod.AlertDialogDescription })), { ssr: false });
const AlertDialogFooter = dynamic(() => import("@/components/ui/alert-dialog").then(mod => ({ default: mod.AlertDialogFooter })), { ssr: false });
const AlertDialogHeader = dynamic(() => import("@/components/ui/alert-dialog").then(mod => ({ default: mod.AlertDialogHeader })), { ssr: false });
const AlertDialogTitle = dynamic(() => import("@/components/ui/alert-dialog").then(mod => ({ default: mod.AlertDialogTitle })), { ssr: false });

const StudentsPageContent = memo(function StudentsPageContent() {
  const { user, loading, isAuthenticated } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const moduleName = searchParams.get('module');

  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [progressFilter, setProgressFilter] = useState('all');
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [error, setError] = useState('');
  const [moduleData, setModuleData] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportButtonRef = useRef(null);
  const [deletingStudent, setDeletingStudent] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Configurable thresholds - can be set from module config or use defaults
  // These control how students are categorized and displayed:
  // - passingScore: Minimum score to be considered "passing" (default: 60%)
  // - excellentScore: Score threshold for "Excellent" label and award icon (default: 80%)
  // - goodScore: Average score threshold for "good" class indicator (default: 70%)
  // - progressWarning: Progress % below which shows red warning (default: 50%)
  // - progressGood: Progress % above which shows green indicator (default: 80%)
  // - activeDays: Days since last access to be considered "active" (default: 7)
  //
  // Teachers can configure these in module settings via assignment_config:
  // Example: { passing_score: 65, excellent_score: 85, active_days: 14 }
  const thresholds = {
    passingScore: moduleData?.assignment_config?.passing_score || 60,
    excellentScore: moduleData?.assignment_config?.excellent_score || 80,
    goodScore: moduleData?.assignment_config?.good_score || 70,
    progressWarning: moduleData?.assignment_config?.progress_warning || 50,
    progressGood: moduleData?.assignment_config?.progress_good || 80,
    activeDays: moduleData?.assignment_config?.active_days || 7
  };

  // --- SWR: Cache modules (stable per session, 5-min dedup) ---
  const teacherId = user?.id || user?.sub;
  const { data: modulesData, error: modulesError } = useAPI(
    teacherId && moduleName ? `/api/modules?teacher_id=${teacherId}` : null,
    { dedupingInterval: 300000 }
  );

  // Resolve the specific module from the cached list
  const resolvedModule = useMemo(() => {
    if (!modulesData || !moduleName) return null;
    const modules = modulesData.data || modulesData;
    return modules.find(m => m.name.toLowerCase() === moduleName.toLowerCase()) || null;
  }, [modulesData, moduleName]);

  // Update moduleData state when resolved module changes
  useEffect(() => {
    if (resolvedModule) {
      setModuleData(resolvedModule);
    }
  }, [resolvedModule]);

  // --- SWR: Cache questions (stable per session, 5-min dedup) ---
  const moduleId = resolvedModule?.id;
  const { data: questionsData } = useAPI(
    moduleId ? `/api/student/modules/${moduleId}/questions` : null,
    { dedupingInterval: 300000 }
  );
  const questions = useMemo(() => questionsData?.data || questionsData || [], [questionsData]);

  // --- Dynamic data: Fetch answers + feedback in PARALLEL (changes frequently, always fresh) ---
  const fetchDynamicData = useCallback(async (modId) => {
    try {
      setLoadingStudents(true);
      setError('');

      // Fetch answers and feedback in parallel
      const [moduleAnswersResponse, feedbackResponse] = await Promise.all([
        apiClient.get(`/api/student-answers/?module_id=${modId}`),
        apiClient.get(`/api/student/modules/${modId}/feedback`).catch(() => ({ data: [] }))
      ]);

      const allModuleAnswers = moduleAnswersResponse.data || moduleAnswersResponse || [];
      const allFeedback = feedbackResponse?.data || feedbackResponse || [];

      // Build feedback lookup
      const feedbackByAnswerId = {};
      allFeedback.forEach(feedback => {
        feedbackByAnswerId[feedback.answer_id] = feedback;
      });

      // Extract unique students from answers
      let realStudents = [];
      if (allModuleAnswers.length > 0) {
        const studentMap = new Map();
        allModuleAnswers.forEach(answer => {
          if (answer.student_id) {
            const studentKey = answer.student_id;
            if (!studentMap.has(studentKey)) {
              studentMap.set(studentKey, {
                id: answer.student_id,
                name: answer.student_id,
                student_id: answer.student_id,
                last_access: answer.submitted_at || new Date().toISOString()
              });
            } else {
              const existing = studentMap.get(studentKey);
              if (answer.submitted_at && new Date(answer.submitted_at) > new Date(existing.last_access)) {
                existing.last_access = answer.submitted_at;
              }
            }
          }
        });
        realStudents = Array.from(studentMap.values());
      }

      // Calculate performance for each student
      if (realStudents.length > 0 && questions.length > 0 && allModuleAnswers.length > 0) {
        const isAnswerCorrectForScoring = (answer, question) => {
          const questionType = (answer.question_type || question?.question_type || '').toLowerCase();
          const isMCQ = questionType === 'mcq' || questionType === 'multiple_choice';
          if (isMCQ) {
            if (typeof answer.answer === 'object' && typeof answer.correct_answer === 'object') {
              return JSON.stringify(answer.answer) === JSON.stringify(answer.correct_answer);
            }
            return answer.answer === answer.correct_answer;
          }
          const feedback = feedbackByAnswerId[answer.id];
          if (feedback?.score !== null && feedback?.score !== undefined) {
            const scorePercent = feedback.score > 1 ? feedback.score : feedback.score * 100;
            const passingThreshold = moduleData?.assignment_config?.passing_score || 60;
            return scorePercent >= passingThreshold;
          }
          if (typeof answer.answer === 'object' && typeof answer.correct_answer === 'object') {
            return JSON.stringify(answer.answer) === JSON.stringify(answer.correct_answer);
          }
          return answer.answer === answer.correct_answer;
        };

        const studentsWithPerformance = realStudents.map(student => {
          const studentAnswers = allModuleAnswers.filter(answer => answer.student_id === student.student_id);
          const totalQuestions = questions.length;
          const uniqueQuestionIds = new Set(studentAnswers.map(answer => answer.question_id));
          const answeredQuestions = uniqueQuestionIds.size;

          const correctAnswers = Array.from(uniqueQuestionIds).filter(questionId => {
            const answersForQuestion = studentAnswers
              .filter(answer => answer.question_id === questionId)
              .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
            const mostRecentAnswer = answersForQuestion[0];
            const question = questions.find(q => q.id === questionId);
            return isAnswerCorrectForScoring(mostRecentAnswer, question);
          }).length;

          const attemptSet = new Set(studentAnswers.map(a => a.attempt || 1));
          const attemptCount = attemptSet.size;

          const studentAnswerIds = studentAnswers.map(a => a.id);
          const answersWithFeedback = studentAnswerIds.filter(id => feedbackByAnswerId[id]);
          const answersWithTeacherGrade = answersWithFeedback.filter(id => feedbackByAnswerId[id]?.teacher_grade);
          let gradeStatus = 'pending';
          if (answersWithTeacherGrade.length > 0 && answersWithTeacherGrade.length >= answersWithFeedback.length) {
            gradeStatus = 'all_graded';
          } else if (answersWithTeacherGrade.length > 0) {
            gradeStatus = 'partially_graded';
          } else if (answersWithFeedback.length > 0) {
            gradeStatus = 'ai_graded';
          }

          let scoreTrend = null;
          if (attemptCount >= 2) {
            const attemptNumbers = Array.from(attemptSet).sort((a, b) => a - b);
            const latestAttemptNum = attemptNumbers[attemptNumbers.length - 1];
            const prevAttemptNum = attemptNumbers[attemptNumbers.length - 2];

            const computeAttemptScore = (attemptNum) => {
              const attemptAnswers = studentAnswers.filter(a => (a.attempt || 1) === attemptNum);
              if (attemptAnswers.length === 0) return 0;
              const correct = attemptAnswers.filter(a => {
                const q = questions.find(qq => qq.id === a.question_id);
                return isAnswerCorrectForScoring(a, q);
              }).length;
              return Math.round((correct / attemptAnswers.length) * 100);
            };

            const latestScore = computeAttemptScore(latestAttemptNum);
            const prevScore = computeAttemptScore(prevAttemptNum);
            if (latestScore > prevScore) scoreTrend = 'up';
            else if (latestScore < prevScore) scoreTrend = 'down';
            else scoreTrend = 'same';
          }

          return {
            ...student,
            total_questions: totalQuestions,
            completed_questions: answeredQuestions,
            correct_answers: correctAnswers,
            incorrect_answers: answeredQuestions - correctAnswers,
            avg_score: answeredQuestions > 0 ? Math.round((correctAnswers / answeredQuestions) * 100) : 0,
            progress: Math.min(100, Math.round((answeredQuestions / totalQuestions) * 100)),
            attempt_count: attemptCount,
            grade_status: gradeStatus,
            score_trend: scoreTrend
          };
        });

        setStudents(studentsWithPerformance);
      } else {
        setStudents(realStudents);
      }
    } catch (error) {
      let errorMessage = 'Failed to load module data. Please try again.';
      if (error.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error.detail) {
        errorMessage = error.detail;
      }
      if (errorMessage.includes('Authentication required') || errorMessage.includes('401')) {
        errorMessage = 'Please sign in to access this page.';
      }
      setError(errorMessage);
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  }, [questions, moduleData?.assignment_config?.passing_score]);

  // Handle SWR errors for module resolution
  useEffect(() => {
    if (modulesError) {
      const msg = modulesError.message || 'Failed to load modules.';
      setError(msg.includes('Authentication required') || msg.includes('401')
        ? 'Please sign in to access this page.' : msg);
      setLoadingStudents(false);
    }
  }, [modulesError]);

  // Handle module not found
  useEffect(() => {
    if (modulesData && moduleName && !resolvedModule) {
      setError(`Module "${moduleName}" not found in your modules`);
      setLoadingStudents(false);
    }
  }, [modulesData, moduleName, resolvedModule]);

  // Fetch dynamic data once module + questions are available
  useEffect(() => {
    if (moduleId && questions.length > 0) {
      fetchDynamicData(moduleId);
    }
  }, [moduleId, questions, fetchDynamicData]);

  // Filter and sort students based on search term, progress filter, and sort options
  useEffect(() => {
    let filtered = students;
    
    // Apply search filter
    if (searchTerm.trim() !== '') {
      filtered = filtered.filter(student =>
        student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.student_id?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply progress filter
    if (progressFilter !== 'all') {
      filtered = filtered.filter(student => {
        const progress = student.progress || 0;
        switch (progressFilter) {
          case 'not-started': return progress === 0;
          case 'in-progress': return progress > 0 && progress < 100;
          case 'completed': return progress === 100;
          default: return true;
        }
      });
    }
    
    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      let aValue = a[sortField] || '';
      let bValue = b[sortField] || '';
      
      // Convert to string for consistent comparison
      aValue = aValue.toString().toLowerCase();
      bValue = bValue.toString().toLowerCase();
      
      if (sortDirection === 'asc') {
        return aValue.localeCompare(bValue, undefined, { numeric: true });
      } else {
        return bValue.localeCompare(aValue, undefined, { numeric: true });
      }
    });

    setFilteredStudents(filtered);
  }, [students, searchTerm, sortField, sortDirection, progressFilter]);

  const handleStudentClick = async (student) => {
    // Store the current filtered student list in localStorage for prev/next navigation
    const studentIds = filteredStudents.map(s => s.student_id);
    const currentIndex = studentIds.indexOf(student.student_id);
    localStorage.setItem('studentNavList', JSON.stringify(studentIds));
    localStorage.setItem('studentNavModule', moduleName);
    // Navigate to dedicated student detail page
    router.push(`/dashboard/students/${student.student_id}?module=${encodeURIComponent(moduleName)}`);
  };

  // Prefetch student detail data on hover for instant navigation
  const handleStudentHover = useCallback((student) => {
    if (!moduleId) return;
    // Prefetch data that will be cached via SWR on the detail page
    prefetchAPI(`/api/student/modules/${moduleId}/feedback?student_id=${student.student_id}`);
  }, [moduleId]);

  const handleDeleteStudent = async () => {
    if (!deletingStudent || !moduleData) return;

    setDeleteLoading(true);
    setError('');

    try {
      await apiClient.delete(`/api/student-answers/modules/${moduleData.id}/students/${deletingStudent.student_id}`);

      // Remove student from local state
      setStudents(students.filter(s => s.student_id !== deletingStudent.student_id));

      // Close dialog
      setShowDeleteDialog(false);
      setDeletingStudent(null);
    } catch (error) {
      console.error('Failed to delete student:', error);
      setError(`Failed to delete student: ${error.response?.data?.detail || error.message}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  const confirmDeleteStudent = (student, e) => {
    e.stopPropagation();
    setDeletingStudent(student);
    setShowDeleteDialog(true);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getProgressBadgeColor = (progress) => {
    if (progress === 0) return 'bg-gray-100 text-gray-800';
    if (progress < thresholds.progressWarning) return 'bg-red-100 text-red-800';
    if (progress < thresholds.progressGood) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return <SortAsc className="w-4 h-4 opacity-50" />;
    return sortDirection === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />;
  };

  const getGradeStatusBadge = (status) => {
    switch (status) {
      case 'all_graded':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-700"><CheckCircle className="w-3 h-3" />All Graded</span>;
      case 'partially_graded':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-700"><HelpCircle className="w-3 h-3" />Partial</span>;
      case 'ai_graded':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-700"><Shield className="w-3 h-3" />AI Graded</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700"><Clock className="w-3 h-3" />Pending</span>;
    }
  };

  const getTrendIcon = (trend) => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-500" />;
    if (trend === 'same') return <Minus className="w-4 h-4 text-gray-400" />;
    return null;
  };

  const getAtRiskStyle = (student) => {
    const score = student.avg_score || 0;
    const progress = student.progress || 0;
    // Red: below passing AND low progress
    if (score < thresholds.passingScore && progress < thresholds.progressWarning) {
      return 'border-l-4 border-l-red-500 bg-red-50/50 dark:bg-red-950/20';
    }
    // Yellow: declining scores
    if (student.score_trend === 'down') {
      return 'border-l-4 border-l-yellow-500 bg-yellow-50/30 dark:bg-yellow-950/10';
    }
    return '';
  };

  // Export comprehensive module data as Excel (using backend endpoint)
  const exportStudentsComprehensive = async () => {
    if (!moduleData) return;

    try {
      // Call backend export endpoint
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/modules/${moduleData.id}/export`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('token') : ''}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      // Get the blob from response
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${moduleData.name}_export_${new Date().toISOString().split('T')[0]}.xlsx`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting module data:', error);
      alert('Failed to export module data. Please try again.');
    }
  };

  // Export feedback-specific format
  const exportFeedbackSpecific = async () => {
    if (!moduleData) return;

    try {
      // Call backend feedback export endpoint
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/modules/${moduleData.id}/export/feedback`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('token') : ''}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      // Get the blob from response
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${moduleData.name}_feedback_export_${new Date().toISOString().split('T')[0]}.xlsx`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting feedback data:', error);
      alert('Failed to export feedback data. Please try again.');
    }
  };



  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-xl mb-4">Access Denied</h1>
        <Button asChild>
          <Link href="/sign-in">Sign In</Link>
        </Button>
      </div>
    );
  }

  if (!moduleName) {
    return (
      <SidebarProvider>
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col items-center justify-center p-8">
            <div className="max-w-2xl w-full">
              <div className="text-center mb-8">
                <Users className="w-16 h-16 text-primary mx-auto mb-4" />
                <h1 className="text-3xl font-bold mb-2">Select a Module</h1>
                <p className="text-muted-foreground">
                  Choose a module from the sidebar to view student performance and analytics
                </p>
              </div>
              <Card className="border-2 border-dashed">
                <CardContent className="p-8 text-center">
                  <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">How to get started</h3>
                  <ol className="text-left space-y-2 text-muted-foreground max-w-md mx-auto">
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-primary">1.</span>
                      <span>Click the <strong>Module selector</strong> in the sidebar</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-primary">2.</span>
                      <span>Choose a module from the dropdown</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-primary">3.</span>
                      <span>View student performance and progress</span>
                    </li>
                  </ol>
                  <div className="mt-6">
                    <Button asChild variant="outline">
                      <Link href="/mymodules">
                        <BookOpen className="w-4 h-4 mr-2" />
                        View My Modules
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  if (error) {
    return (
      <SidebarProvider>
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col items-center justify-center p-8">
            <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
            <h1 className="text-xl font-semibold mb-2">Error</h1>
            <p className="text-muted-foreground mb-4">{error}</p>
            <div className="flex gap-2">
              <Button onClick={() => window.location.reload()}>Try Again</Button>
              <Button variant="outline" asChild>
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider
      style={{
        "--sidebar-width": "calc(var(--spacing) * 72)",
        "--header-height": "calc(var(--spacing) * 12)"
      }}
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="min-h-screen bg-background">
          <div className="max-w-7xl mx-auto px-6 py-8">
            {/* Header with Gradient Background */}
            <div className="mb-8 relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 dark:from-blue-500/5 dark:via-purple-500/5 dark:to-pink-500/5 rounded-2xl"></div>
              <div className="relative p-8 rounded-2xl border border-border/50 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <GraduationCap className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h1 className="text-3xl font-bold text-foreground">Student Performance</h1>
                        <div className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                          {moduleData?.name || moduleName}
                        </div>
                      </div>
                      <p className="text-muted-foreground flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" />
                        Track and analyze student progress, performance, and engagement
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 relative">
                    <Button
                      variant="outline"
                      size="default"
                      onClick={() => setShowExportMenu(!showExportMenu)}
                      disabled={!students.length}
                      className="shadow-sm hover:shadow-md transition-shadow"
                    >
                      <Download className="mr-2 w-4 h-4" />
                      Export Data
                    </Button>
                    {showExportMenu && students.length > 0 && (
                      <>
                        {/* Backdrop overlay to close menu on outside click */}
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setShowExportMenu(false)}
                        />
                        {/* Dropdown menu - appears ABOVE the button */}
                        <div className="absolute right-0 bottom-full mb-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                          <div className="p-2">
                            <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Export Format</div>
                            <button
                              onClick={() => {
                                exportStudentsComprehensive();
                                setShowExportMenu(false);
                              }}
                              className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center gap-3 transition-colors"
                            >
                              <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                                <FileText className="w-4 h-4 text-green-600 dark:text-green-400" />
                              </div>
                              <div>
                                <div className="font-medium text-gray-900 dark:text-gray-100">Comprehensive Export</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">Complete data with 8 sheets</div>
                              </div>
                            </button>
                            <button
                              onClick={() => {
                                exportFeedbackSpecific();
                                setShowExportMenu(false);
                              }}
                              className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center gap-3 transition-colors"
                            >
                              <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                                <BarChart3 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                              </div>
                              <div>
                                <div className="font-medium text-gray-900 dark:text-gray-100">Feedback Report</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">All attempts & feedback per student</div>
                              </div>
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Search and Filters */}
            <Card className="mb-6 border-border bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-lg">Search & Filter</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by student ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <select
                    value={progressFilter}
                    onChange={(e) => setProgressFilter(e.target.value)}
                    className="px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="all">All Progress</option>
                    <option value="not-started">Not Started (0%)</option>
                    <option value="in-progress">In Progress (1-99%)</option>
                    <option value="completed">Completed (100%)</option>
                  </select>
                  <div className="flex items-center text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
                    {filteredStudents.length} of {students.length} students
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Enhanced Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <Card className="border-border bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30 backdrop-blur-sm overflow-hidden relative group hover:shadow-lg transition-all">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <CardContent className="p-6 relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <div className="px-2 py-1 bg-blue-200/50 dark:bg-blue-800/50 rounded-full">
                      <TrendingUp className="w-3 h-3 text-blue-700 dark:text-blue-300" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">Total Students</p>
                    {loadingStudents ? (
                      <Skeleton className="h-9 w-16 mb-1" />
                    ) : (
                      <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                        {students.length}
                      </p>
                    )}
                    <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1">Enrolled in module</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/30 backdrop-blur-sm overflow-hidden relative group hover:shadow-lg transition-all">
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <CardContent className="p-6 relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center shadow-lg">
                      <Activity className="w-6 h-6 text-white" />
                    </div>
                    <div className="px-2 py-1 bg-green-200/50 dark:bg-green-800/50 rounded-full">
                      <Zap className="w-3 h-3 text-green-700 dark:text-green-300" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-1">Active Students</p>
                    {loadingStudents ? (
                      <Skeleton className="h-9 w-16 mb-1" />
                    ) : (
                      <p className="text-3xl font-bold text-green-900 dark:text-green-100">
                        {students.filter(s => {
                          const lastAccess = new Date(s.last_access);
                          const daysSinceAccess = (Date.now() - lastAccess.getTime()) / (1000 * 60 * 60 * 24);
                          return daysSinceAccess <= thresholds.activeDays;
                        }).length}
                      </p>
                    )}
                    <p className="text-xs text-green-600/70 dark:text-green-400/70 mt-1">Last {thresholds.activeDays} days</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/30 backdrop-blur-sm overflow-hidden relative group hover:shadow-lg transition-all">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <CardContent className="p-6 relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center shadow-lg">
                      <Target className="w-6 h-6 text-white" />
                    </div>
                    <div className={`px-2 py-1 rounded-full ${
                      !loadingStudents && students.length > 0 &&
                      Math.round(students.reduce((acc, s) => acc + s.avg_score, 0) / students.length) >= thresholds.goodScore
                        ? 'bg-green-200/50 dark:bg-green-800/50'
                        : 'bg-purple-200/50 dark:bg-purple-800/50'
                    }`}>
                      <CheckCircle className={`w-3 h-3 ${
                        !loadingStudents && students.length > 0 &&
                        Math.round(students.reduce((acc, s) => acc + s.avg_score, 0) / students.length) >= thresholds.goodScore
                          ? 'text-green-700 dark:text-green-300'
                          : 'text-purple-700 dark:text-purple-300'
                      }`} />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-1">Avg Score</p>
                    {loadingStudents ? (
                      <Skeleton className="h-9 w-20 mb-1" />
                    ) : (
                      <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">
                        {students.length > 0 ?
                          Math.round(students.reduce((acc, s) => acc + s.avg_score, 0) / students.length) + '%' :
                          '-'
                        }
                      </p>
                    )}
                    <p className="text-xs text-purple-600/70 dark:text-purple-400/70 mt-1">Overall performance</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/30 backdrop-blur-sm overflow-hidden relative group hover:shadow-lg transition-all">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <CardContent className="p-6 relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                      <Award className="w-6 h-6 text-white" />
                    </div>
                    <div className="px-2 py-1 bg-orange-200/50 dark:bg-orange-800/50 rounded-full">
                      <TrendingUp className="w-3 h-3 text-orange-700 dark:text-orange-300" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-orange-700 dark:text-orange-300 mb-1">Completion Rate</p>
                    {loadingStudents ? (
                      <Skeleton className="h-9 w-20 mb-1" />
                    ) : (
                      <p className="text-3xl font-bold text-orange-900 dark:text-orange-100">
                        {students.length > 0 ?
                          Math.round(students.filter(s => s.progress === 100).length / students.length * 100) + '%' :
                          '-'
                        }
                      </p>
                    )}
                    <p className="text-xs text-orange-600/70 dark:text-orange-400/70 mt-1">
                      {!loadingStudents && students.length > 0 && `${students.filter(s => s.progress === 100).length} completed`}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Students Table */}
            {loadingStudents ? (
              <Card className="border-border bg-card/50 backdrop-blur-sm">
                <CardHeader className="border-b pb-4">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-10 w-32" />
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-4 p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
                        <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-5 w-32" />
                          <Skeleton className="h-4 w-48" />
                        </div>
                        <Skeleton className="h-6 w-16 rounded" />
                        <Skeleton className="h-6 w-20 rounded" />
                        <Skeleton className="h-8 w-24" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : students.length === 0 ? (
              <Card className="border-border bg-card/50 backdrop-blur-sm">
                <CardContent className="py-16 text-center">
                  <div className="text-6xl mb-4">👥</div>
                  <h3 className="text-lg font-semibold mb-2">No students enrolled</h3>
                  <p className="text-muted-foreground mb-4">
                    This module does not have any students yet. Students will appear here automatically when they start taking tests.
                  </p>
                </CardContent>
              </Card>
            ) : filteredStudents.length === 0 ? (
              <Card className="border-border bg-card/50 backdrop-blur-sm">
                <CardContent className="py-16 text-center">
                  <div className="text-6xl mb-4">🔍</div>
                  <h3 className="text-lg font-semibold mb-2">No students found</h3>
                  <p className="text-muted-foreground mb-4">
                    No students match your search term &quot;{searchTerm}&quot;. Try adjusting your search.
                  </p>
                  <Button variant="outline" onClick={() => setSearchTerm('')}>
                    Clear Search
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-border bg-card/50 backdrop-blur-sm shadow-lg">
                <CardHeader className="border-b bg-muted/20">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <List className="w-5 h-5" />
                      Student Performance Table
                    </CardTitle>
                    <div className="text-sm text-muted-foreground">
                      {filteredStudents.length} students
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b bg-gradient-to-r from-muted/40 to-muted/20">
                        <tr>
                          <th className="text-left p-4 font-semibold text-sm uppercase tracking-wide">
                            <button
                              onClick={() => handleSort('student_id')}
                              className="flex items-center gap-2 hover:text-primary transition-colors group"
                            >
                              <User className="w-4 h-4 opacity-50 group-hover:opacity-100" />
                              Student ID
                              {getSortIcon('student_id')}
                            </button>
                          </th>
                          <th className="text-left p-4 font-semibold text-sm uppercase tracking-wide">
                            <button
                              onClick={() => handleSort('progress')}
                              className="flex items-center gap-2 hover:text-primary transition-colors group"
                            >
                              <BarChart3 className="w-4 h-4 opacity-50 group-hover:opacity-100" />
                              Progress
                              {getSortIcon('progress')}
                            </button>
                          </th>
                          <th className="text-left p-4 font-semibold text-sm uppercase tracking-wide">
                            <button
                              onClick={() => handleSort('avg_score')}
                              className="flex items-center gap-2 hover:text-primary transition-colors group"
                            >
                              <Target className="w-4 h-4 opacity-50 group-hover:opacity-100" />
                              Avg Score
                              {getSortIcon('avg_score')}
                            </button>
                          </th>
                          <th className="text-left p-4 font-semibold text-sm uppercase tracking-wide">
                            <button
                              onClick={() => handleSort('attempt_count')}
                              className="flex items-center gap-2 hover:text-primary transition-colors group"
                            >
                              <Activity className="w-4 h-4 opacity-50 group-hover:opacity-100" />
                              Attempts
                              {getSortIcon('attempt_count')}
                            </button>
                          </th>
                          <th className="text-left p-4 font-semibold text-sm uppercase tracking-wide">
                            <button
                              onClick={() => handleSort('grade_status')}
                              className="flex items-center gap-2 hover:text-primary transition-colors group"
                            >
                              <Shield className="w-4 h-4 opacity-50 group-hover:opacity-100" />
                              Grade Status
                              {getSortIcon('grade_status')}
                            </button>
                          </th>
                          <th className="text-left p-4 font-semibold text-sm uppercase tracking-wide">
                            <button
                              onClick={() => handleSort('last_access')}
                              className="flex items-center gap-2 hover:text-primary transition-colors group"
                            >
                              <Clock className="w-4 h-4 opacity-50 group-hover:opacity-100" />
                              Last Access
                              {getSortIcon('last_access')}
                            </button>
                          </th>
                          <th className="text-left p-4 font-semibold text-sm uppercase tracking-wide">
                            <div className="flex items-center gap-2">
                              <ExternalLink className="w-4 h-4 opacity-50" />
                              Actions
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {filteredStudents.map((student, index) => (
                          <tr
                            key={student.id}
                            className={`hover:bg-muted/40 transition-all cursor-pointer group relative ${getAtRiskStyle(student)}`}
                            onClick={() => handleStudentClick(student)}
                            onMouseEnter={() => handleStudentHover(student)}
                          >
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="relative">
                                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-md group-hover:shadow-lg transition-shadow">
                                    {student.student_id?.charAt(0)?.toUpperCase() || 'S'}
                                  </div>
                                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"></div>
                                </div>
                                <div>
                                  <div className="font-mono text-sm font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent group-hover:from-blue-500 group-hover:to-purple-500 transition-all">
                                    {student.student_id}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {student.completed_questions || 0}/{student.total_questions || 0} questions
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-semibold">{student.progress || 0}%</span>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getProgressBadgeColor(student.progress || 0)}`}>
                                    {(student.progress || 0) === 0 ? 'NOT STARTED' :
                                     (student.progress || 0) === 100 ? 'COMPLETE' : 'IN PROGRESS'}
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden shadow-inner">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 shadow-sm ${
                                      (student.progress || 0) === 0 ? 'bg-gray-400' :
                                      (student.progress || 0) < thresholds.progressWarning ? 'bg-gradient-to-r from-red-400 to-red-500' :
                                      (student.progress || 0) < thresholds.progressGood ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' :
                                      'bg-gradient-to-r from-green-400 to-green-500'
                                    }`}
                                    style={{width: `${student.progress || 0}%`}}
                                  ></div>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="relative">
                                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shadow-md ${
                                    (student.avg_score || 0) >= thresholds.excellentScore ? 'bg-gradient-to-br from-green-400 to-green-600 text-white' :
                                    (student.avg_score || 0) >= thresholds.passingScore ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white' :
                                    'bg-gradient-to-br from-red-400 to-red-600 text-white'
                                  }`}>
                                    {student.avg_score || 0}
                                  </div>
                                  {(student.avg_score || 0) >= thresholds.excellentScore && (
                                    <div className="absolute -top-1 -right-1">
                                      <Award className="w-4 h-4 text-yellow-500 fill-yellow-400" />
                                    </div>
                                  )}
                                </div>
                                <div className="text-xs space-y-1">
                                  <div className="flex items-center gap-1">
                                    <span className={`font-semibold ${
                                      (student.avg_score || 0) >= thresholds.excellentScore ? 'text-green-600 dark:text-green-400' :
                                      (student.avg_score || 0) >= thresholds.passingScore ? 'text-yellow-600 dark:text-yellow-400' :
                                      'text-red-600 dark:text-red-400'
                                    }`}>
                                      {(student.avg_score || 0) >= thresholds.excellentScore ? 'Excellent' :
                                       (student.avg_score || 0) >= thresholds.passingScore ? 'Good' : 'Needs Work'}
                                    </span>
                                    {getTrendIcon(student.score_trend)}
                                  </div>
                                  <div className="text-muted-foreground">
                                    {student.correct_answers || 0}/{student.completed_questions || 0} correct
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold">
                                  {student.attempt_count || 1}
                                </span>
                                {moduleData?.max_attempts && (
                                  <span className="text-xs text-muted-foreground">
                                    / {moduleData.max_attempts}
                                  </span>
                                )}
                              </div>
                              {moduleData?.max_attempts && (
                                <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-1.5 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      (student.attempt_count || 1) >= moduleData.max_attempts
                                        ? 'bg-red-500' : 'bg-blue-500'
                                    }`}
                                    style={{width: `${Math.min(100, ((student.attempt_count || 1) / moduleData.max_attempts) * 100)}%`}}
                                  ></div>
                                </div>
                              )}
                            </td>
                            <td className="p-4">
                              {getGradeStatusBadge(student.grade_status)}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-muted-foreground" />
                                <div className="text-sm">
                                  <div className="font-medium">
                                    {student.last_access ? new Date(student.last_access).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric'
                                    }) : 'Never'}
                                  </div>
                                  {student.last_access && (
                                    <div className="text-xs text-muted-foreground">
                                      {new Date(student.last_access).toLocaleTimeString('en-US', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        hour12: true
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-2"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStudentClick(student);
                                  }}
                                >
                                  View
                                  <ExternalLink className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                                  onClick={(e) => confirmDeleteStudent(student, e)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Enhanced Table Footer */}
                  <div className="border-t bg-gradient-to-r from-muted/20 to-muted/10 px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          <span className="text-muted-foreground">
                            <span className="font-semibold text-foreground">{students.filter(s => s.progress === 100).length}</span> Completed
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                          <span className="text-muted-foreground">
                            <span className="font-semibold text-foreground">{students.filter(s => s.progress > 0 && s.progress < 100).length}</span> In Progress
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                          <span className="text-muted-foreground">
                            <span className="font-semibold text-foreground">{students.filter(s => s.progress === 0).length}</span> Not Started
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-full">
                        <CheckCircle className="w-3 h-3" />
                        <span>Click any row to view detailed analytics</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </SidebarInset>

      {/* Delete Student Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Delete Student Data
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete all data for student {deletingStudent?.student_id} from this module?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-800 dark:text-red-200 font-semibold mb-2">
                This will permanently delete:
              </p>
              <ul className="text-sm text-red-700 dark:text-red-300 space-y-1 list-disc list-inside">
                <li>All student answers and AI feedback</li>
                <li>Student enrollment and consent status</li>
                <li>Survey responses</li>
                <li>Test submissions</li>
                <li>Chat conversations</li>
              </ul>
            </div>
            <p className="text-sm font-semibold text-red-600 dark:text-red-400">
              This action cannot be undone.
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStudent}
              disabled={deleteLoading}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {deleteLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Student Data
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
});

export default function StudentsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <StudentsPageContent />
    </Suspense>
  );
}