'use client';

import { useAuth } from "@/context/AuthContext";
import { useSearchParams } from "next/navigation";
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, Users, AlertCircle, BookOpen, TrendingUp, TrendingDown, Trash2, SortAsc, SortDesc, Download } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useCallback, Suspense, useMemo, memo } from "react";
import { apiClient } from "@/lib/auth";
import { useAPI } from "@/lib/useSWR";
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
  const moduleIdFromParam = searchParams.get('moduleId');

  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [progressFilter, setProgressFilter] = useState('all');
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [error, setError] = useState('');
  const [moduleData, setModuleData] = useState(null);
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

  // --- SWR: Cache modules — only needed when moduleId is NOT in the URL ---
  const teacherId = user?.id || user?.sub;
  const { data: modulesData, error: modulesError } = useAPI(
    !moduleIdFromParam && teacherId && moduleName ? `/api/modules?teacher_id=${teacherId}` : null,
    { dedupingInterval: 300000 }
  );

  // Resolve module from fetched list (only used when moduleId not in URL)
  const resolvedModule = useMemo(() => {
    if (!modulesData || !moduleName) return null;
    const modules = modulesData.data || modulesData;
    return modules.find(m => m.name.toLowerCase() === moduleName.toLowerCase()) || null;
  }, [modulesData, moduleName]);

  // Prefer moduleId from URL param (no waterfall), fall back to resolved module
  const moduleId = moduleIdFromParam || resolvedModule?.id || null;

  // Update moduleData state when resolved module changes
  useEffect(() => {
    if (resolvedModule) {
      setModuleData(resolvedModule);
    }
  }, [resolvedModule]);
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
        apiClient.get(`/api/ai-feedback/teacher/module/${modId}/released`, { skipAuthLogout: true }).catch(() => ({ data: [] }))
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

  // Fetch dynamic data once module is known and questions fetch has settled (even if empty)
  useEffect(() => {
    if (moduleId && questionsData !== undefined) {
      fetchDynamicData(moduleId);
    }
  }, [moduleId, questionsData, fetchDynamicData]);

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
    router.push(`/dashboard/students/${encodeURIComponent(student.student_id)}?module=${encodeURIComponent(moduleName)}`);
  };

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

  const getSortIcon = (field) => {
    if (sortField !== field) return <SortAsc className="w-4 h-4 opacity-50" />;
    return sortDirection === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />;
  };

  const GRADE_STATUS = {
    all_graded: { label: 'Graded', variant: 'secondary' },
    partially_graded: { label: 'Partially graded', variant: 'outline' },
    ai_graded: { label: 'AI graded', variant: 'outline' },
  };
  const getGradeStatusBadge = (status) => {
    const { label, variant } = GRADE_STATUS[status] || { label: 'Pending', variant: 'outline' };
    return <Badge variant={variant} className={variant === 'outline' ? 'text-muted-foreground font-normal' : 'font-normal'}>{label}</Badge>;
  };

  const getTrendIcon = (trend) => {
    if (trend === 'up') return <TrendingUp aria-label="Improving" className="w-3.5 h-3.5 text-muted-foreground" />;
    if (trend === 'down') return <TrendingDown aria-label="Declining" className="w-3.5 h-3.5 text-destructive" />;
    return null;
  };

  // A student needs attention when they are failing with little progress, or declining.
  const isAtRisk = (student) =>
    ((student.avg_score || 0) < thresholds.passingScore && (student.progress || 0) < thresholds.progressWarning)
    || student.score_trend === 'down';

  // Export comprehensive module data as Excel (using backend endpoint)
  const exportStudentsComprehensive = async () => {
    if (!moduleData) return;

    try {
      // Call backend export endpoint
      const blob = await apiClient.blob(`/api/modules/${moduleData.id}/export`);

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
      const blob = await apiClient.blob(`/api/modules/${moduleData.id}/export/feedback`);

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
            <AlertCircle aria-hidden="true" className="w-8 h-8 text-destructive mb-3" />
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

  const activeCount = students.filter(s => s.last_access &&
    (Date.now() - new Date(s.last_access).getTime()) / 86400000 <= thresholds.activeDays).length;
  const completedCount = students.filter(s => s.progress === 100).length;
  const inProgressCount = students.filter(s => s.progress > 0 && s.progress < 100).length;
  const avgScore = students.length ? Math.round(students.reduce((acc, s) => acc + (s.avg_score || 0), 0) / students.length) : null;
  const atRiskCount = students.filter(isAtRisk).length;
  const columns = [
    { field: 'student_id', label: 'Student' },
    { field: 'progress', label: 'Progress' },
    { field: 'avg_score', label: 'Avg score' },
    { field: 'attempt_count', label: 'Attempts' },
    { field: 'grade_status', label: 'Grading' },
    { field: 'last_access', label: 'Last active' },
  ];

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
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Students</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {moduleData?.name || moduleName} · {students.length} student{students.length !== 1 ? 's' : ''}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="self-start gap-2" disabled={!students.length}>
                    <Download className="w-4 h-4" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuItem onSelect={exportStudentsComprehensive} className="flex-col items-start gap-0.5">
                    <span className="font-medium">Full module export</span>
                    <span className="text-xs text-muted-foreground">Excel workbook with all sheets</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={exportFeedbackSpecific} className="flex-col items-start gap-0.5">
                    <span className="font-medium">Feedback report</span>
                    <span className="text-xs text-muted-foreground">Every attempt and its feedback</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Stats strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Students', value: students.length, sub: atRiskCount ? `${atRiskCount} need${atRiskCount === 1 ? "s" : ""} attention` : 'Enrolled in module', alert: atRiskCount > 0 },
                { label: 'Active', value: activeCount, sub: `Last ${thresholds.activeDays} days` },
                { label: 'Average score', value: avgScore === null ? '—' : `${avgScore}%`, sub: `Passing is ${thresholds.passingScore}%` },
                { label: 'Completed', value: completedCount, sub: students.length ? `${Math.round(completedCount / students.length * 100)}% of students` : 'No students yet' },
              ].map(({ label, value, sub, alert }) => (
                <div key={label} className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground font-medium">{label}</span>
                  {loadingStudents ? <Skeleton className="h-8 w-14" /> : <span className="text-2xl font-bold tracking-tight tabular-nums">{value}</span>}
                  <span className={`text-[11px] ${alert ? 'text-destructive' : 'text-muted-foreground'}`}>{sub}</span>
                </div>
              ))}
            </div>

            {/* Students table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex flex-col sm:flex-row gap-2 p-3 border-b border-border">
                <div className="relative flex-1">
                  <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    aria-label="Search by student ID"
                    placeholder="Search by student ID"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <select
                  aria-label="Filter by progress"
                  value={progressFilter}
                  onChange={(e) => setProgressFilter(e.target.value)}
                  className="h-9 px-3 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="all">All progress</option>
                  <option value="not-started">Not started</option>
                  <option value="in-progress">In progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              {loadingStudents ? (
                <div className="divide-y divide-border">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-6 px-4 py-3">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-2 w-32" />
                      <Skeleton className="h-4 w-12" />
                      <Skeleton className="h-4 w-20 ml-auto" />
                    </div>
                  ))}
                </div>
              ) : students.length === 0 ? (
                <div className="py-16 px-4 text-center">
                  <Users aria-hidden="true" className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <h3 className="font-medium mb-1">No students yet</h3>
                  <p className="text-sm text-muted-foreground">Students appear here once they start answering questions in this module.</p>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="py-16 px-4 text-center">
                  <Search aria-hidden="true" className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <h3 className="font-medium mb-1">No matching students</h3>
                  <p className="text-sm text-muted-foreground mb-4">Nothing matches your search or filter.</p>
                  <Button variant="outline" size="sm" onClick={() => { setSearchTerm(''); setProgressFilter('all'); }}>Clear filters</Button>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b border-border text-xs text-muted-foreground">
                        <tr>
                          {columns.map(({ field, label }) => (
                            <th key={field} scope="col" className="text-left font-medium px-4 py-2.5 whitespace-nowrap"
                              aria-sort={sortField === field ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                              <button onClick={() => handleSort(field)} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                                {label}
                                {getSortIcon(field)}
                              </button>
                            </th>
                          ))}
                          <th scope="col" className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredStudents.map((student) => {
                          const progress = student.progress || 0;
                          const score = student.avg_score || 0;
                          const attempts = student.attempt_count || 1;
                          return (
                            <tr
                              key={student.id}
                              className="hover:bg-muted/50 transition-colors cursor-pointer"
                              onClick={() => handleStudentClick(student)}
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-medium">{student.student_id}</span>
                                  {isAtRisk(student) && (
                                    <span className="inline-flex items-center gap-1 text-xs text-destructive">
                                      <AlertCircle aria-hidden="true" className="w-3.5 h-3.5" />
                                      Needs attention
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {student.completed_questions || 0} of {student.total_questions || 0} questions
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-24 bg-muted rounded-full h-1.5 overflow-hidden" role="progressbar"
                                    aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={`${student.student_id} progress`}>
                                    <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                                  </div>
                                  <span className="tabular-nums text-xs text-muted-foreground w-9">{progress}%</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5">
                                  <span className={`font-medium tabular-nums ${score < thresholds.passingScore ? 'text-destructive' : ''}`}>{score}%</span>
                                  {getTrendIcon(student.score_trend)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {student.correct_answers || 0} of {student.completed_questions || 0} correct
                                </div>
                              </td>
                              <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                                <span className={moduleData?.max_attempts && attempts >= moduleData.max_attempts ? 'text-destructive' : ''}>{attempts}</span>
                                {moduleData?.max_attempts && <span className="text-muted-foreground"> / {moduleData.max_attempts}</span>}
                              </td>
                              <td className="px-4 py-3">{getGradeStatusBadge(student.grade_status)}</td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                {student.last_access ? (
                                  <>
                                    <div>{new Date(student.last_access).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {new Date(student.last_access).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                    </div>
                                  </>
                                ) : <span className="text-muted-foreground">Never</span>}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-1">
                                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleStudentClick(student); }}>
                                    View
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Delete data for ${student.student_id}`}
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    onClick={(e) => confirmDeleteStudent(student, e)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                    <span>Showing {filteredStudents.length} of {students.length}</span>
                    <span>{completedCount} completed · {inProgressCount} in progress · {students.length - completedCount - inProgressCount} not started</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </SidebarInset>

      {/* Delete Student Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete data for {deletingStudent?.student_id}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the student from this module. It cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-1">
            <p className="text-sm font-medium mb-1.5">This deletes:</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>All student answers and AI feedback</li>
              <li>Student enrollment and consent status</li>
              <li>Survey responses</li>
              <li>Test submissions</li>
              <li>Chat conversations</li>
            </ul>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStudent}
              disabled={deleteLoading}
              className="bg-destructive hover:bg-destructive/90 focus-visible:ring-destructive text-white"
            >
              {deleteLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin motion-reduce:animate-none mr-2"></div>
                  Deleting…
                </>
              ) : (
                'Delete student data'
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