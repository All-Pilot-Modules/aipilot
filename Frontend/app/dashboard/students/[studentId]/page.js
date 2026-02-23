'use client';

import { useAuth } from "@/context/AuthContext";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ArrowLeft, User, Calendar, Clock, Award, BookOpen, TrendingUp, TrendingDown, Minus, CheckCircle, XCircle, HelpCircle, List, Download, BarChart3, PieChart, Bot, FileDown, FileText, FileJson, ClipboardList, MessageSquare, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, AlertCircle, Target, GraduationCap, Activity, Shield, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useCallback, Suspense, useMemo, memo } from "react";
import { apiClient } from "@/lib/auth";
import { useAPI } from "@/lib/useSWR";

function StudentDetailPageContent() {
  const { user, loading, isAuthenticated } = useAuth();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const studentId = params.studentId;
  const moduleName = searchParams.get('module');
  
  const [student, setStudent] = useState(null);
  const [studentAnswers, setStudentAnswers] = useState([]);
  const [unansweredQuestions, setUnansweredQuestions] = useState([]);
  const [moduleData, setModuleData] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [aiFeedbackMap, setAiFeedbackMap] = useState({});
  const [teacherGradesMap, setTeacherGradesMap] = useState({});
  const [answersByAttempt, setAnswersByAttempt] = useState({});
  const [selectedAttempt, setSelectedAttempt] = useState(1);
  const [surveyData, setSurveyData] = useState(null);
  const [surveyResponse, setSurveyResponse] = useState(null);
  const [showSurvey, setShowSurvey] = useState(false);
  const [compactMode, setCompactMode] = useState(false);

  // Prev/Next student navigation from localStorage
  const [studentNavList, setStudentNavList] = useState([]);
  const [currentStudentIndex, setCurrentStudentIndex] = useState(-1);

  useEffect(() => {
    try {
      const navList = JSON.parse(localStorage.getItem('studentNavList') || '[]');
      const navModule = localStorage.getItem('studentNavModule');
      if (navList.length > 0 && navModule === moduleName) {
        setStudentNavList(navList);
        const idx = navList.indexOf(studentId);
        setCurrentStudentIndex(idx);
      }
    } catch (e) {
      // ignore
    }
  }, [studentId, moduleName]);

  const navigateToStudent = (direction) => {
    const newIndex = currentStudentIndex + direction;
    if (newIndex >= 0 && newIndex < studentNavList.length && moduleName) {
      // Use window.location for full navigation to avoid webpack chunk errors
      // in dev mode when navigating within the same dynamic route
      window.location.href = `/dashboard/students/${studentNavList[newIndex]}?module=${encodeURIComponent(moduleName)}`;
    }
  };

  // --- SWR: Cache modules (stable per session, 5-min dedup) ---
  const teacherId = user?.id || user?.sub;
  const { data: modulesData, error: modulesError } = useAPI(
    teacherId && moduleName ? `/api/modules?teacher_id=${teacherId}` : null,
    { dedupingInterval: 300000 }
  );

  // Resolve module from cached list
  const resolvedModule = useMemo(() => {
    if (!modulesData || !moduleName) return null;
    const modules = modulesData.data || modulesData;
    return modules.find(m => m.name.toLowerCase() === moduleName.toLowerCase()) || null;
  }, [modulesData, moduleName]);

  const resolvedModuleId = resolvedModule?.id;

  // --- SWR: Cache questions (stable per session, 5-min dedup) ---
  const { data: questionsData } = useAPI(
    resolvedModuleId ? `/api/student/modules/${resolvedModuleId}/questions` : null,
    { dedupingInterval: 300000 }
  );

  const fetchStudentDetails = useCallback(async (module, questions) => {
    try {
      setLoadingData(true);
      setError('');

      setModuleData(module);

      // Fetch survey+response, answers, and feedback ALL IN PARALLEL
      const [surveyResult, moduleAnswersResponse, feedbackResult] = await Promise.all([
        // Survey config + student response (sequential pair, wrapped)
        (async () => {
          try {
            const surveyConfig = await apiClient.get(`/api/modules/${module.id}/survey`);
            let response = null;
            try {
              const studentSurveyResponse = await apiClient.get(
                `/api/student/modules/${module.id}/survey?student_id=${studentId}`
              );
              response = studentSurveyResponse.my_response || null;
            } catch { /* No survey response yet */ }
            return { config: surveyConfig, response };
          } catch { return { config: null, response: null }; }
        })(),
        // Student answers
        apiClient.get(`/api/student-answers?module_id=${module.id}`),
        // AI feedback
        apiClient.get(`/api/student/modules/${module.id}/feedback?student_id=${studentId}`)
          .catch(() => ({ data: [] }))
      ]);

      // Process survey
      if (surveyResult.config) setSurveyData(surveyResult.config);
      if (surveyResult.response) setSurveyResponse(surveyResult.response);

      // Process answers
      const allModuleAnswers = moduleAnswersResponse.data || moduleAnswersResponse || [];
      const studentModuleAnswers = allModuleAnswers.filter(answer => answer.student_id === studentId);

      // Process feedback
      let feedbackData = feedbackResult?.data || feedbackResult || [];
      let feedbackByAnswerId = {};
      let teacherGradesByAnswerId = {};
      feedbackData.forEach(feedback => {
        feedbackByAnswerId[feedback.answer_id] = feedback;
        if (feedback.teacher_grade) {
          teacherGradesByAnswerId[feedback.answer_id] = feedback.teacher_grade;
        }
      });
      setAiFeedbackMap(feedbackByAnswerId);
      setTeacherGradesMap(teacherGradesByAnswerId);

      // Group answers by attempt number
      const attemptGroups = {};
      studentModuleAnswers.forEach(answer => {
        const attempt = answer.attempt || 1;
        if (!attemptGroups[attempt]) {
          attemptGroups[attempt] = [];
        }
        attemptGroups[attempt].push(answer);
      });

      // If no answers at all, create a default attempt 1 group
      if (Object.keys(attemptGroups).length === 0) {
        attemptGroups[1] = [];
      }

      setAnswersByAttempt(attemptGroups);

      // Get all unique attempts sorted by descending order (most recent first)
      const attempts = Object.keys(attemptGroups).map(Number).sort((a, b) => b - a);

      // Build student info from answers
      const studentInfo = {
        id: studentId,
        name: studentId, // Display student banner ID as name
        student_id: studentId,
        last_access: studentModuleAnswers.length > 0
          ? studentModuleAnswers.reduce((latest, answer) => {
              return new Date(answer.submitted_at) > new Date(latest) ? answer.submitted_at : latest;
            }, studentModuleAnswers[0].submitted_at)
          : null
      };

      // Calculate performance metrics across ALL attempts
      const totalQuestions = questions.length;

      // Count UNIQUE questions answered (not total answers, to avoid counting multiple attempts)
      const uniqueQuestionIds = new Set(studentModuleAnswers.map(answer => answer.question_id));
      const answeredQuestions = uniqueQuestionIds.size;

      // For each unique question, get the most recent answer to check correctness
      const correctAnswers = Array.from(uniqueQuestionIds).filter(questionId => {
        // Get all answers for this question, sorted by date (most recent first)
        const answersForQuestion = studentModuleAnswers
          .filter(answer => answer.question_id === questionId)
          .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));

        // Check if the most recent answer is correct
        const mostRecentAnswer = answersForQuestion[0];
        const question = questions.find(q => q.id === questionId);
        const questionType = (mostRecentAnswer.question_type || question?.question_type || '').toLowerCase();
        const isMCQ = questionType === 'mcq' || questionType === 'multiple_choice';

        // For MCQ: use binary correct/incorrect
        if (isMCQ) {
          if (typeof mostRecentAnswer.answer === 'object' && typeof mostRecentAnswer.correct_answer === 'object') {
            return JSON.stringify(mostRecentAnswer.answer) === JSON.stringify(mostRecentAnswer.correct_answer);
          }
          return mostRecentAnswer.answer === mostRecentAnswer.correct_answer;
        }

        // For short/essay questions: use AI score with 60% threshold
        const feedback = feedbackByAnswerId[mostRecentAnswer.id];
        if (feedback?.score !== null && feedback?.score !== undefined) {
          const scorePercent = feedback.score > 1 ? feedback.score : feedback.score * 100;
          return scorePercent >= 60; // 60% or higher counts as "correct"
        }

        // Fallback to boolean check if no score available
        if (typeof mostRecentAnswer.answer === 'object' && typeof mostRecentAnswer.correct_answer === 'object') {
          return JSON.stringify(mostRecentAnswer.answer) === JSON.stringify(mostRecentAnswer.correct_answer);
        }
        return mostRecentAnswer.answer === mostRecentAnswer.correct_answer;
      }).length;

      // --- Compute per-attempt scores for attempt comparison ---
      const isCorrectForScoring = (answer, question) => {
        const questionType = (answer.question_type || question?.question_type || '').toLowerCase();
        const isMCQ = questionType === 'mcq' || questionType === 'multiple_choice';
        if (isMCQ) {
          if (typeof answer.answer === 'object' && typeof answer.correct_answer === 'object') {
            return JSON.stringify(answer.answer) === JSON.stringify(answer.correct_answer);
          }
          return answer.answer === answer.correct_answer;
        }
        const fb = feedbackByAnswerId[answer.id];
        if (fb?.score !== null && fb?.score !== undefined) {
          const sp = fb.score > 1 ? fb.score : fb.score * 100;
          return sp >= 60;
        }
        if (typeof answer.answer === 'object' && typeof answer.correct_answer === 'object') {
          return JSON.stringify(answer.answer) === JSON.stringify(answer.correct_answer);
        }
        return answer.answer === answer.correct_answer;
      };

      const attemptScores = attempts.map(attemptNum => {
        const attemptAnswers = studentModuleAnswers.filter(a => (a.attempt || 1) === attemptNum);
        const answered = attemptAnswers.length;
        const correct = attemptAnswers.filter(a => {
          const q = questions.find(qq => qq.id === a.question_id);
          return isCorrectForScoring(a, q);
        }).length;
        return {
          attempt: attemptNum,
          answered,
          correct,
          score: answered > 0 ? Math.round((correct / answered) * 100) : 0
        };
      }).sort((a, b) => a.attempt - b.attempt);

      // --- Grade status counts ---
      const allStudentAnswerIds = studentModuleAnswers.map(a => a.id);
      const teacherGradedCount = allStudentAnswerIds.filter(id => feedbackByAnswerId[id]?.teacher_grade).length;
      const aiOnlyCount = allStudentAnswerIds.filter(id => feedbackByAnswerId[id] && !feedbackByAnswerId[id]?.teacher_grade).length;
      const ungradedCount = allStudentAnswerIds.filter(id => !feedbackByAnswerId[id]).length;

      const studentWithPerformance = {
        ...studentInfo,
        total_questions: totalQuestions,
        completed_questions: answeredQuestions,
        avg_score: answeredQuestions > 0 ? Math.round((correctAnswers / answeredQuestions) * 100) : 0,
        progress: Math.min(100, Math.round((answeredQuestions / totalQuestions) * 100)),
        correct_answers: correctAnswers,
        incorrect_answers: answeredQuestions - correctAnswers,
        unanswered: totalQuestions - answeredQuestions,
        total_attempts: attempts.length,
        attempt_scores: attemptScores,
        teacher_graded_count: teacherGradedCount,
        ai_only_count: aiOnlyCount,
        ungraded_count: ungradedCount
      };

      setStudent(studentWithPerformance);

      // Format answers properly - helper function
      const formatAnswer = (answer, options) => {
          if (!answer) return null;

          // Handle string that looks like JSON
          if (typeof answer === 'string') {
            try {
              const parsed = JSON.parse(answer);
              if (typeof parsed === 'object') {
                return formatAnswer(parsed, options);
              }
            } catch (e) {
              // Not JSON, continue
            }

            // Single letter MCQ answer
            if (answer.length === 1 && options) {
              try {
                const parsedOptions = typeof options === 'string' ? JSON.parse(options) : options;
                const optionText = parsedOptions[answer];
                return optionText ? `${answer}) ${optionText}` : answer;
              } catch (e) {
                return answer;
              }
            }

            return answer;
          }

          if (typeof answer === 'object') {
            // Handle {blanks: {"0": "val", "1": "val"}} format (fill-in-the-blank)
            if (answer.blanks && typeof answer.blanks === 'object') {
              const entries = Object.entries(answer.blanks).sort(([a], [b]) => Number(a) - Number(b));
              return entries.map(([, val]) => val).join(', ');
            }

            // Handle {selected_option_id: "B"} format
            const optionKey = answer.selected_option_id || answer.selected_option;
            if (optionKey && options) {
              try {
                const parsedOptions = typeof options === 'string' ? JSON.parse(options) : options;
                const optionText = parsedOptions[optionKey];
                return optionText ? `${optionKey}) ${optionText}` : optionKey;
              } catch (e) {
                return optionKey;
              }
            }
            if (optionKey) return optionKey;
            return JSON.stringify(answer);
          }

          return answer;
        };

      // Simple helper function to extract option ID from answer for comparison
      const extractOptionId = (answer) => {
        if (!answer) return null;

        // New format: {selected_option_id: "A"}
        if (typeof answer === 'object' && answer.selected_option_id) {
          return answer.selected_option_id.toUpperCase();
        }

        // Old format: {selected_option: "A"}
        if (typeof answer === 'object' && answer.selected_option) {
          return answer.selected_option.toUpperCase();
        }

        // Plain string format
        if (typeof answer === 'string') {
          const trimmed = answer.trim();
          // If it's a single letter (A, B, C, D), return uppercase
          if (trimmed.length === 1 && /[A-Za-z]/.test(trimmed)) {
            return trimmed.toUpperCase();
          }
          // For text responses, return as-is
          return trimmed;
        }

        return null;
      };

      // Simple comparison function
      const isAnswerCorrect = (studentAnswer, correctOptionId, correctAnswer) => {
        // For MCQ: compare option IDs
        const studentOptionId = extractOptionId(studentAnswer);
        const correctId = (correctOptionId || correctAnswer || '').trim().toUpperCase();

        return studentOptionId === correctId;
      };

      // Build question data from ALL questions, matching with student answers
      const studentQuestionData = questions.map((question) => {
        // Find all answers for this question from the student (across all attempts)
        const answersByAttemptForQuestion = studentModuleAnswers.filter(
          answer => answer.question_id === question.id
        );

        // Create an entry for each attempt that exists, or one entry if no attempts
        if (answersByAttemptForQuestion.length === 0) {
          // No answer for this question - show as unanswered
          const options = question.options;
          const correctOptionId = question.correct_option_id;
          const correctAnswer = question.correct_answer;

          return {
            question_id: question.id,
            answer_id: null,
            question_text: question.question_text,
            question_type: question.question_type || 'unknown',
            image_url: question.image_url || null,
            correct_answer: formatAnswer(correctOptionId || correctAnswer, options),
            student_answer: null,
            is_correct: null,
            answered_at: null,
            attempt: 1, // Default to attempt 1 for unanswered questions
            options: options,
            raw_correct_answer: correctOptionId || correctAnswer,
            raw_student_answer: null
          };
        }

        // Student has answered this question - create entries for each attempt
        return answersByAttemptForQuestion.map(studentAnswer => {
          const options = studentAnswer.question_options || question.options;
          const correctOptionId = studentAnswer.correct_option_id || question.correct_option_id;
          const correctAnswer = studentAnswer.correct_answer || question.correct_answer;
          const studentAnswerValue = studentAnswer.answer;

          return {
            question_id: studentAnswer.question_id,
            answer_id: studentAnswer.id,
            question_text: studentAnswer.question_text || question.question_text,
            question_type: studentAnswer.question_type || question.question_type || 'unknown',
            image_url: question.image_url || null,
            correct_answer: formatAnswer(correctOptionId || correctAnswer, options),
            student_answer: formatAnswer(studentAnswerValue, options),
            is_correct: isAnswerCorrect(studentAnswerValue, correctOptionId, correctAnswer),
            answered_at: studentAnswer.submitted_at,
            attempt: studentAnswer.attempt || 1,
            options: options,
            raw_correct_answer: correctOptionId || correctAnswer,
            raw_student_answer: studentAnswerValue
          };
        });
      }).flat(); // Flatten the array since some questions may have multiple attempts

      setStudentAnswers(studentQuestionData);

      // Find the attempt with the most recent feedback (highest attempt number with feedback)
      // This ensures students see their feedback after submission, not empty final attempts
      const attemptsWithFeedback = attempts.filter(attemptNum => {
        const answersInAttempt = studentQuestionData.filter(q => q.attempt === attemptNum);
        return answersInAttempt.some(q => q.answer_id && feedbackByAnswerId[q.answer_id]);
      });

      // Default to attempt with feedback, or most recent attempt if none have feedback
      const defaultAttempt = attemptsWithFeedback.length > 0
        ? attemptsWithFeedback[0]  // Already sorted descending, so this is the most recent with feedback
        : (attempts.length > 0 ? attempts[0] : 1); // Fall back to most recent attempt or 1

      setSelectedAttempt(defaultAttempt);

    } catch (error) {
      console.error('Error fetching student details:', error);
      setError('Failed to load student data. Please try again.');
    } finally {
      setLoadingData(false);
    }
  }, [studentId]);

  // Handle SWR errors
  useEffect(() => {
    if (modulesError) {
      setError(modulesError.message || 'Failed to load modules.');
      setLoadingData(false);
    }
  }, [modulesError]);

  // Handle module not found
  useEffect(() => {
    if (modulesData && moduleName && !resolvedModule) {
      setError(`Module "${moduleName}" not found`);
      setLoadingData(false);
    }
  }, [modulesData, moduleName, resolvedModule]);

  // Fetch dynamic data once module + questions are resolved from SWR
  useEffect(() => {
    if (!resolvedModule || !questionsData) return;
    const questions = questionsData.data || questionsData;
    if (studentId && isAuthenticated) {
      fetchStudentDetails(resolvedModule, questions);
    }
  }, [resolvedModule, questionsData, studentId, isAuthenticated, fetchStudentDetails]);

  // Function to get real AI feedback from database
  const getAIFeedback = (answerId) => {
    if (!answerId || !aiFeedbackMap[answerId]) {
      return null;
    }
    return aiFeedbackMap[answerId];
  };

  // State for expanded feedback cards
  const [expandedQuestions, setExpandedQuestions] = useState(new Set());

  const toggleQuestionExpand = (questionId) => {
    setExpandedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  };

  // Get result badge for a question
  const getResultBadge = (questionData) => {
    const feedback = getAIFeedback(questionData.answer_id);
    const teacherGrade = teacherGradesMap[questionData.answer_id];
    const questionType = questionData.question_type?.toLowerCase();
    // Detect MCQ by type OR by presence of options
    let qHasOptions = false;
    if (questionData.options) {
      try {
        const opts = typeof questionData.options === 'string' ? JSON.parse(questionData.options) : questionData.options;
        qHasOptions = opts && typeof opts === 'object' && Object.keys(opts).length > 0;
      } catch (e) { /* ignore */ }
    }
    const isMCQ = questionType === 'mcq' || questionType === 'multiple_choice' || qHasOptions;

    if (questionData.student_answer === null) {
      return { label: 'Unanswered', color: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400', points: null };
    }

    if (isMCQ) {
      return questionData.is_correct
        ? { label: 'Correct', color: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300', points: '1/1' }
        : { label: 'Incorrect', color: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300', points: '0/1' };
    }

    // Essay/short answer with score
    if (feedback?.score !== null && feedback?.score !== undefined) {
      const scorePercent = Math.round(feedback.score > 1 ? feedback.score : feedback.score * 100);
      const pointsEarned = teacherGrade?.points_awarded ?? (feedback.points_earned != null ? feedback.points_earned : null);
      const pointsPossible = feedback.points_possible || null;
      const pointsDisplay = pointsEarned != null && pointsPossible != null ? `${pointsEarned}/${pointsPossible}` : `${scorePercent}%`;

      if (scorePercent >= 80) return { label: pointsDisplay, color: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300', points: pointsDisplay, percent: scorePercent };
      if (scorePercent >= 60) return { label: pointsDisplay, color: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300', points: pointsDisplay, percent: scorePercent };
      if (scorePercent >= 40) return { label: pointsDisplay, color: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300', points: pointsDisplay, percent: scorePercent };
      return { label: pointsDisplay, color: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300', points: pointsDisplay, percent: scorePercent };
    }

    return questionData.is_correct
      ? { label: 'Correct', color: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300', points: null }
      : { label: 'Incorrect', color: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300', points: null };
  };

  // Function to get formatted AI feedback text for export
  const getAIFeedbackText = (answerId) => {
    const feedback = getAIFeedback(answerId);
    if (!feedback) return 'No AI feedback available';

    let text = '';
    if (feedback.explanation) text += `Explanation: ${feedback.explanation}. `;
    if (feedback.strengths && feedback.strengths.length > 0) {
      text += `Strengths: ${feedback.strengths.join('; ')}. `;
    }
    if (feedback.weaknesses && feedback.weaknesses.length > 0) {
      text += `Weaknesses: ${feedback.weaknesses.join('; ')}. `;
    }
    if (feedback.improvement_hint) text += `Suggestion: ${feedback.improvement_hint}. `;
    if (feedback.score !== null && feedback.score !== undefined) {
      text += `Score: ${Math.round(feedback.score > 1 ? feedback.score : feedback.score * 100)}%`;
    }
    return text || 'No feedback details';
  };

  // Helper function to properly escape CSV values
  const escapeCSV = (value) => {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    // Replace line breaks with spaces and escape quotes
    const cleaned = stringValue.replace(/\r?\n/g, ' ').replace(/"/g, '""');
    // Wrap in quotes if contains comma, quote, or starts with special chars
    if (cleaned.includes(',') || cleaned.includes('"') || cleaned.includes('\n')) {
      return `"${cleaned}"`;
    }
    return cleaned;
  };

  // Function to download student report as CSV
  const downloadStudentReport = () => {
    if (!student || !studentAnswers.length) return;

    // Enhanced headers with separate feedback columns
    const csvHeaders = [
      'Question No.',
      'Attempt',
      'Question',
      'Question Type',
      'Correct Answer',
      'Student Answer',
      'Result',
      'Score',
      'Feedback - Explanation',
      'Feedback - Strengths',
      'Feedback - Weaknesses',
      'Feedback - Suggestion'
    ];

    const csvData = studentAnswers.map((questionData, index) => {
      const feedback = getAIFeedback(questionData.answer_id);
      const questionType = questionData.question_type?.toLowerCase();
      const isMCQ = questionType === 'mcq' || questionType === 'multiple_choice';

      // Determine result display
      let resultDisplay;
      if (questionData.student_answer === null) {
        resultDisplay = 'Pending';
      } else if (isMCQ) {
        resultDisplay = questionData.is_correct ? 'Correct' : 'Wrong';
      } else if (feedback?.score !== null && feedback?.score !== undefined) {
        resultDisplay = `${Math.round(feedback.score > 1 ? feedback.score : feedback.score * 100)}%`;
      } else {
        resultDisplay = questionData.is_correct ? 'Correct' : 'Wrong';
      }

      return [
        index + 1,
        questionData.attempt || 1,
        escapeCSV(questionData.question_text),
        escapeCSV(questionData.question_type || 'Unknown'),
        escapeCSV(questionData.correct_answer || 'Not specified'),
        escapeCSV(questionData.student_answer || 'Not Answered'),
        resultDisplay,
        feedback?.score ? `${Math.round(feedback.score > 1 ? feedback.score : feedback.score * 100)}%` : 'N/A',
        escapeCSV(feedback?.explanation || ''),
        escapeCSV(feedback?.strengths?.join('; ') || ''),
        escapeCSV(feedback?.weaknesses?.join('; ') || ''),
        escapeCSV(feedback?.improvement_hint || '')
      ];
    });

    // Create a well-structured CSV with clear sections
    const csvContent = [
      '=== STUDENT PERFORMANCE REPORT ===',
      '',
      '--- Summary Information ---',
      `Student ID,${student.student_id}`,
      `Module,${escapeCSV(moduleData?.name || moduleName)}`,
      `Overall Progress,${student.progress}%`,
      `Average Score,${student.avg_score}%`,
      `Correct Answers,${student.correct_answers}`,
      `Incorrect Answers,${student.incorrect_answers}`,
      `Questions Completed,${student.completed_questions}`,
      `Total Questions,${student.total_questions}`,
      `Total Attempts,${student.total_attempts || 1}`,
      `Report Generated,${new Date().toLocaleString()}`,
      '',
      '',
      '--- Detailed Question Analysis ---',
      csvHeaders.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `student-${student.student_id}-${moduleData?.name || moduleName}-report.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Function to download student report as JSON
  const downloadStudentReportJSON = () => {
    if (!student || !studentAnswers.length) return;

    const reportData = {
      student: {
        id: student.student_id,
        progress: student.progress,
        averageScore: student.avg_score,
        questionsCompleted: student.completed_questions,
        totalQuestions: student.total_questions,
        totalAttempts: student.total_attempts || 1,
        lastAccess: student.last_access
      },
      module: {
        name: moduleData?.name || moduleName,
        description: moduleData?.description
      },
      questions: studentAnswers.map((questionData, index) => {
        const feedback = getAIFeedback(questionData.answer_id);
        const questionType = questionData.question_type?.toLowerCase();
        const isMCQ = questionType === 'mcq' || questionType === 'multiple_choice';

        // Determine result display
        let resultDisplay;
        if (questionData.student_answer === null) {
          resultDisplay = 'Pending';
        } else if (isMCQ) {
          resultDisplay = questionData.is_correct ? 'Correct' : 'Wrong';
        } else if (feedback?.score !== null && feedback?.score !== undefined) {
          resultDisplay = `${Math.round(feedback.score > 1 ? feedback.score : feedback.score * 100)}%`;
        } else {
          resultDisplay = questionData.is_correct ? 'Correct' : 'Wrong';
        }

        return {
          questionNumber: index + 1,
          questionText: questionData.question_text,
          questionType: questionData.question_type,
          correctAnswer: questionData.correct_answer,
          studentAnswer: questionData.student_answer,
          isCorrect: questionData.is_correct,
          result: resultDisplay,
          attempt: questionData.attempt || 1,
          aiFeedback: feedback ? {
            explanation: feedback.explanation,
            strengths: feedback.strengths,
            weaknesses: feedback.weaknesses,
            improvementHint: feedback.improvement_hint,
            score: feedback.score
          } : null,
          answeredAt: questionData.answered_at
        };
      }),
      generatedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `student-${student.student_id}-${moduleData?.name || moduleName}-report.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  if (error) {
    return (
      <SidebarProvider>
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col items-center justify-center p-8">
            <div className="text-center">
              <h1 className="text-xl font-semibold mb-2">Error</h1>
              <p className="text-muted-foreground mb-4">{error}</p>
              <div className="flex gap-2 justify-center">
                <Button onClick={() => window.location.reload()}>Try Again</Button>
                <Button variant="outline" onClick={() => router.back()}>Go Back</Button>
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  if (loadingData) {
    return (
      <SidebarProvider>
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col items-center justify-center p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <h3 className="text-lg font-semibold mb-2">Loading student data...</h3>
            <p className="text-muted-foreground">Please wait while we fetch the information</p>
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
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <div className="px-4 lg:px-6">
                {/* Professional Header with Gradient Banner */}
                <div className="mb-8 relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 dark:from-blue-500/5 dark:via-purple-500/5 dark:to-pink-500/5 rounded-2xl"></div>
                  <div className="relative p-6 md:p-8 rounded-2xl border border-border/50 backdrop-blur-sm">
                    {/* Top Row: Back + Breadcrumb + Prev/Next Nav */}
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/dashboard/students?module=${encodeURIComponent(moduleName)}`)}
                        >
                          <ArrowLeft className="w-4 h-4 mr-1" />
                          Students
                        </Button>
                        <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
                          <Link href="/dashboard" className="hover:text-foreground">Dashboard</Link>
                          <span>/</span>
                          <Link href={`/dashboard/students?module=${moduleName}`} className="hover:text-foreground">Students</Link>
                          <span>/</span>
                          <span className="text-foreground font-medium">{student?.student_id}</span>
                        </div>
                      </div>
                      {/* Prev/Next Navigation */}
                      {studentNavList.length > 1 && currentStudentIndex >= 0 && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={currentStudentIndex <= 0}
                            onClick={() => navigateToStudent(-1)}
                          >
                            <ChevronLeft className="w-4 h-4 mr-1" />
                            Previous
                          </Button>
                          <span className="text-xs text-muted-foreground px-2">
                            {currentStudentIndex + 1} of {studentNavList.length}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={currentStudentIndex >= studentNavList.length - 1}
                            onClick={() => navigateToStudent(1)}
                          >
                            Next
                            <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Main Header Content */}
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                      {/* Score Ring */}
                      <div className="relative flex-shrink-0">
                        <div className={`w-24 h-24 rounded-2xl flex flex-col items-center justify-center font-bold shadow-lg ${
                          (student?.avg_score || 0) >= 80 ? 'bg-gradient-to-br from-green-400 to-green-600' :
                          (student?.avg_score || 0) >= 60 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' :
                          'bg-gradient-to-br from-red-400 to-red-600'
                        } text-white`}>
                          <span className="text-3xl leading-none">{student?.avg_score || 0}</span>
                          <span className="text-xs opacity-80 mt-0.5">%</span>
                        </div>
                        {(student?.avg_score || 0) >= 80 && (
                          <div className="absolute -top-2 -right-2">
                            <Award className="w-7 h-7 text-yellow-500 fill-yellow-400 drop-shadow" />
                          </div>
                        )}
                      </div>

                      {/* Student Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                          <h1 className="text-2xl md:text-3xl font-bold text-foreground">{student?.student_id}</h1>
                          <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                            {moduleData?.name || moduleName}
                          </span>
                        </div>
                        {/* Inline Key Stats */}
                        <div className="flex flex-wrap items-center gap-4 mt-3 text-sm">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <BookOpen className="w-4 h-4" />
                            <span><strong className="text-foreground">{student?.completed_questions || 0}</strong> / {student?.total_questions || 0} Questions</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span><strong className="text-foreground">{student?.completed_questions > 0 ? Math.round((student.correct_answers / student.completed_questions) * 100) : 0}%</strong> Correct Rate</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Activity className="w-4 h-4" />
                            <span><strong className="text-foreground">{student?.total_attempts || 1}</strong>{moduleData?.max_attempts ? ` / ${moduleData.max_attempts}` : ''} Attempts</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Shield className="w-4 h-4" />
                            <span>
                              {student?.teacher_graded_count > 0
                                ? <strong className="text-green-600 dark:text-green-400">{student.teacher_graded_count} Teacher Graded</strong>
                                : student?.ai_only_count > 0
                                  ? <strong className="text-blue-600 dark:text-blue-400">AI Graded</strong>
                                  : <strong className="text-gray-500">Pending</strong>
                              }
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Download Button */}
                      <div className="flex-shrink-0 relative">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                          className="shadow-sm"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Export
                        </Button>
                        {showDownloadMenu && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowDownloadMenu(false)} />
                            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-xl z-50">
                              <div className="py-1">
                                <button
                                  onClick={() => { downloadStudentReport(); setShowDownloadMenu(false); }}
                                  className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                >
                                  <FileText className="w-4 h-4 text-green-600" />
                                  Export as CSV
                                </button>
                                <button
                                  onClick={() => { downloadStudentReportJSON(); setShowDownloadMenu(false); }}
                                  className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                >
                                  <FileJson className="w-4 h-4 text-blue-600" />
                                  Export as JSON
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Performance Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  {/* Score Overview */}
                  <Card className="border-border bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30 overflow-hidden">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Score Overview</p>
                        <Target className="w-5 h-5 text-blue-500" />
                      </div>
                      <div className="flex items-center gap-3">
                        {/* Circular Progress */}
                        <div className="relative w-16 h-16 flex-shrink-0">
                          <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                            <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="6" className="text-blue-200 dark:text-blue-800" />
                            <circle cx="32" cy="32" r="28" fill="none" strokeWidth="6" strokeLinecap="round"
                              strokeDasharray={`${(student?.avg_score || 0) * 1.759} 175.9`}
                              className={`${(student?.avg_score || 0) >= 80 ? 'text-green-500' : (student?.avg_score || 0) >= 60 ? 'text-yellow-500' : 'text-red-500'}`}
                              stroke="currentColor"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-sm font-bold text-foreground">{student?.avg_score || 0}%</span>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <p className="font-semibold text-foreground">
                            {(student?.avg_score || 0) >= 80 ? 'Excellent' : (student?.avg_score || 0) >= 60 ? 'Good' : 'Needs Work'}
                          </p>
                          <p>{student?.progress || 0}% complete</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Questions Breakdown */}
                  <Card className="border-border bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/30 overflow-hidden">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium text-green-700 dark:text-green-300">Questions</p>
                        <BookOpen className="w-5 h-5 text-green-500" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span> Correct</span>
                          <span className="font-bold text-foreground">{student?.correct_answers || 0}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span> Incorrect</span>
                          <span className="font-bold text-foreground">{student?.incorrect_answers || 0}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400 inline-block"></span> Unanswered</span>
                          <span className="font-bold text-foreground">{student?.unanswered || 0}</span>
                        </div>
                        {/* Mini bar chart */}
                        <div className="flex h-2 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 mt-1">
                          {(student?.correct_answers || 0) > 0 && (
                            <div className="bg-green-500 h-full" style={{width: `${(student.correct_answers / student.total_questions) * 100}%`}}></div>
                          )}
                          {(student?.incorrect_answers || 0) > 0 && (
                            <div className="bg-red-500 h-full" style={{width: `${(student.incorrect_answers / student.total_questions) * 100}%`}}></div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Attempts Used */}
                  <Card className="border-border bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/30 overflow-hidden">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Attempts Used</p>
                        <Activity className="w-5 h-5 text-purple-500" />
                      </div>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">{student?.total_attempts || 1}</span>
                        {moduleData?.max_attempts && (
                          <span className="text-lg text-muted-foreground">/ {moduleData.max_attempts}</span>
                        )}
                      </div>
                      {moduleData?.max_attempts ? (
                        <>
                          <div className="w-full bg-purple-200 dark:bg-purple-800 rounded-full h-2 overflow-hidden">
                            <div className={`h-full rounded-full ${(student?.total_attempts || 1) >= moduleData.max_attempts ? 'bg-red-500' : 'bg-purple-500'}`}
                              style={{width: `${Math.min(100, ((student?.total_attempts || 1) / moduleData.max_attempts) * 100)}%`}}
                            ></div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1.5">
                            {(student?.total_attempts || 1) >= moduleData.max_attempts ? 'All used' : `${moduleData.max_attempts - (student?.total_attempts || 1)} remaining`}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">Unlimited attempts</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Grade Status */}
                  <Card className="border-border bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/30 overflow-hidden">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium text-orange-700 dark:text-orange-300">Grade Status</p>
                        <GraduationCap className="w-5 h-5 text-orange-500" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span> Teacher Graded</span>
                          <span className="font-bold text-foreground">{student?.teacher_graded_count || 0}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span> AI Only</span>
                          <span className="font-bold text-foreground">{student?.ai_only_count || 0}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400 inline-block"></span> Ungraded</span>
                          <span className="font-bold text-foreground">{student?.ungraded_count || 0}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Attempt Comparison Section */}
                {student?.attempt_scores && student.attempt_scores.length >= 2 && (
                  <div className="mb-8">
                    <Card className="border-border">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <TrendingUp className="w-5 h-5 text-blue-500" />
                          Attempt Comparison
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex gap-3 overflow-x-auto pb-2">
                          {student.attempt_scores.map((attempt, idx) => {
                            const prevScore = idx > 0 ? student.attempt_scores[idx - 1].score : null;
                            const trend = prevScore !== null
                              ? attempt.score > prevScore ? 'up' : attempt.score < prevScore ? 'down' : 'same'
                              : null;
                            return (
                              <button
                                key={attempt.attempt}
                                onClick={() => setSelectedAttempt(attempt.attempt)}
                                className={`flex-shrink-0 p-4 rounded-xl border-2 transition-all min-w-[140px] text-left ${
                                  selectedAttempt === attempt.attempt
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 shadow-md'
                                    : 'border-border hover:border-blue-300 hover:bg-muted/50'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-semibold text-muted-foreground uppercase">Attempt {attempt.attempt}</span>
                                  {trend && (
                                    trend === 'up' ? <TrendingUp className="w-4 h-4 text-green-500" /> :
                                    trend === 'down' ? <TrendingDown className="w-4 h-4 text-red-500" /> :
                                    <Minus className="w-4 h-4 text-gray-400" />
                                  )}
                                </div>
                                <div className={`text-2xl font-bold ${
                                  attempt.score >= 80 ? 'text-green-600 dark:text-green-400' :
                                  attempt.score >= 60 ? 'text-yellow-600 dark:text-yellow-400' :
                                  'text-red-600 dark:text-red-400'
                                }`}>
                                  {attempt.score}%
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {attempt.answered} questions &middot; {attempt.correct} correct
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Survey Response Section */}
                {surveyData && surveyData.survey_questions && surveyData.survey_questions.length > 0 && (
                  <div className="mb-8">
                    <Card className="border-2 border-purple-200 dark:border-purple-800">
                      <CardHeader
                        className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border-b border-purple-200 dark:border-purple-800 cursor-pointer hover:from-purple-100 hover:to-pink-100 dark:hover:from-purple-950/30 dark:hover:to-pink-950/30 transition-colors"
                        onClick={() => setShowSurvey(!showSurvey)}
                      >
                        <CardTitle className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                              <ClipboardList className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span>Student Feedback Survey</span>
                                {surveyResponse ? (
                                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                                ) : (
                                  <XCircle className="w-5 h-5 text-gray-400" />
                                )}
                              </div>
                              <p className="text-sm font-normal text-muted-foreground mt-1">
                                {surveyResponse
                                  ? `Submitted on ${new Date(surveyResponse.submitted_at).toLocaleString()}`
                                  : 'Not submitted yet'}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="hover:bg-purple-100 dark:hover:bg-purple-900/30"
                          >
                            {showSurvey ? (
                              <ChevronUp className="w-5 h-5" />
                            ) : (
                              <ChevronDown className="w-5 h-5" />
                            )}
                          </Button>
                        </CardTitle>
                      </CardHeader>
                      {showSurvey && (
                        <CardContent className="pt-6">
                        {surveyResponse ? (
                          <div className="space-y-6">
                            {surveyData.survey_questions.map((question, qIdx) => (
                              <div key={question.id} className="border-b border-gray-200 dark:border-gray-800 pb-6 last:border-0 last:pb-0">
                                <div className="flex items-start gap-3 mb-3">
                                  <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <span className="text-sm font-bold text-purple-600 dark:text-purple-400">Q{qIdx + 1}</span>
                                  </div>
                                  <div className="flex-1">
                                    <p className="font-semibold text-base text-foreground mb-1">
                                      {question.question}
                                      {question.required && <span className="text-red-500 ml-1">*</span>}
                                    </p>
                                    <div className="flex items-center gap-2 mt-2">
                                      <div className={`text-xs px-2 py-1 rounded ${
                                        question.type === 'short'
                                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                          : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                                      }`}>
                                        {question.type === 'short' ? 'Short Answer' : 'Long Answer'}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="ml-11">
                                  <div className="flex items-start gap-2">
                                    <MessageSquare className="w-4 h-4 text-muted-foreground mt-1 flex-shrink-0" />
                                    <div className="flex-1 p-4 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                                      {surveyResponse.responses[question.id] ? (
                                        <p className="text-foreground whitespace-pre-wrap break-words leading-relaxed">
                                          {surveyResponse.responses[question.id]}
                                        </p>
                                      ) : (
                                        <p className="text-muted-foreground italic">No response provided</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <ClipboardList className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                            <p className="text-lg font-medium text-muted-foreground mb-2">No Survey Response Yet</p>
                            <p className="text-sm text-muted-foreground">
                              This student hasn&apos;t submitted their feedback survey for this module.
                            </p>
                          </div>
                        )}
                        </CardContent>
                      )}
                    </Card>
                  </div>
                )}

                {/* Attempt Selector Tabs */}
                {Object.keys(answersByAttempt).length > 1 && (
                  <div className="mb-6 bg-slate-50 dark:bg-slate-800 rounded-lg p-2 border border-slate-200 dark:border-slate-700">
                    <div className="flex gap-2">
                      {Object.keys(answersByAttempt).sort((a, b) => Number(a) - Number(b)).map(attempt => (
                        <button
                          key={attempt}
                          onClick={() => setSelectedAttempt(Number(attempt))}
                          className={`px-6 py-3 rounded-lg font-semibold text-sm transition-all ${
                            selectedAttempt === Number(attempt)
                              ? 'bg-blue-600 text-white shadow-lg'
                              : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'
                          }`}
                        >
                          Attempt {attempt}
                          <span className="ml-2 text-xs opacity-75">
                            ({answersByAttempt[attempt].length} questions)
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Question Analysis */}
                <div>
                  {/* Section Header */}
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
                      <List className="w-6 h-6" />
                      Question Analysis
                      {Object.keys(answersByAttempt).length > 1 && (
                        <span className="text-sm font-normal text-muted-foreground ml-1">- Attempt {selectedAttempt}</span>
                      )}
                    </h2>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        {studentAnswers.filter(q => q.attempt === selectedAttempt).length} questions
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCompactMode(!compactMode)}
                        className="gap-1.5 text-xs"
                      >
                        {compactMode ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        {compactMode ? 'Detailed' : 'Compact'}
                      </Button>
                    </div>
                  </div>

                  {studentAnswers.length === 0 ? (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <HelpCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                        <p className="text-muted-foreground">No questions available for this module</p>
                      </CardContent>
                    </Card>
                  ) : compactMode ? (
                    /* ===== COMPACT MODE: Dense table ===== */
                    <Card className="overflow-hidden border-border">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/40">
                              <th className="text-left p-3 font-semibold text-muted-foreground w-10">#</th>
                              <th className="text-left p-3 font-semibold text-muted-foreground">Question</th>
                              <th className="text-left p-3 font-semibold text-muted-foreground w-48">Student Answer</th>
                              <th className="text-center p-3 font-semibold text-muted-foreground w-24">Result</th>
                            </tr>
                          </thead>
                          <tbody>
                            {studentAnswers
                              .filter(q => q.attempt === selectedAttempt)
                              .map((questionData, index) => {
                                const result = getResultBadge(questionData);
                                return (
                                  <tr key={`${questionData.question_id}-${questionData.attempt}`}
                                    className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                                    <td className="p-3 text-muted-foreground font-mono">{index + 1}</td>
                                    <td className="p-3">
                                      <p className="truncate max-w-md" title={questionData.question_text}>{questionData.question_text}</p>
                                    </td>
                                    <td className="p-3">
                                      {questionData.student_answer ? (
                                        <span className="truncate block max-w-[180px]" title={String(questionData.student_answer)}>{questionData.student_answer}</span>
                                      ) : (
                                        <span className="text-muted-foreground italic">-</span>
                                      )}
                                    </td>
                                    <td className="p-3 text-center">
                                      <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold ${result.color}`}>
                                        {result.points || result.label}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  ) : (
                    /* ===== DETAILED MODE: Card-based layout ===== */
                    <div className="space-y-5">
                      {studentAnswers
                        .filter(q => q.attempt === selectedAttempt)
                        .map((questionData, index) => {
                          const result = getResultBadge(questionData);
                          const feedback = getAIFeedback(questionData.answer_id);
                          const teacherGrade = teacherGradesMap[questionData.answer_id];
                          const hasFeedback = !!(feedback || teacherGrade);
                          const questionType = questionData.question_type?.toLowerCase();
                          // Detect MCQ by type OR by presence of options data
                          let hasOptions = false;
                          if (questionData.options) {
                            try {
                              const opts = typeof questionData.options === 'string' ? JSON.parse(questionData.options) : questionData.options;
                              hasOptions = opts && typeof opts === 'object' && Object.keys(opts).length > 0;
                            } catch (e) { /* ignore */ }
                          }
                          const isMCQ = questionType === 'mcq' || questionType === 'multiple_choice' || hasOptions;

                          const isCorrectish = questionData.is_correct === true || (result.percent && result.percent >= 60);
                          const isUnanswered = questionData.student_answer === null;

                          return (
                            <div
                              key={`${questionData.question_id}-${questionData.attempt}`}
                              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm"
                            >
                              {/* ── Question header ── */}
                              <div className="flex items-start gap-3 p-4 pb-3"
                              >
                                {/* Number badge */}
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                                  isUnanswered
                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                    : isCorrectish
                                      ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                                      : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300'
                                }`}>
                                  {index + 1}
                                </div>

                                {/* Question text */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground leading-relaxed">{questionData.question_text}</p>
                                  {questionData.image_url && (
                                    <div className="mt-2" style={{ maxHeight: '140px' }}>
                                      <Image
                                        src={questionData.image_url}
                                        alt="Question illustration"
                                        width={300}
                                        height={140}
                                        className="rounded-lg border border-border object-contain"
                                        style={{ maxHeight: '140px', width: 'auto' }}
                                      />
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2 mt-1.5">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                      isMCQ
                                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                        : questionType === 'essay'
                                          ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                                          : 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                                    }`}>
                                      {isMCQ ? 'MCQ' : questionType === 'essay' ? 'Essay' : 'Short Answer'}
                                    </span>
                                    {questionData.answered_at && (
                                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {new Date(questionData.answered_at).toLocaleString()}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Unanswered indicator */}
                                {isUnanswered && (
                                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-500">
                                    <HelpCircle className="w-3.5 h-3.5" /> Unanswered
                                  </span>
                                )}
                              </div>


                              {/* ── Answer Section with Result ── */}
                              {questionData.student_answer !== null && (
                                <div className="px-4 pb-3">
                                  {isMCQ && questionData.options ? (
                                    /* === MCQ: All options, color only on correct + student pick === */
                                    (() => {
                                      let parsedOpts = {};
                                      try {
                                        parsedOpts = typeof questionData.options === 'string' ? JSON.parse(questionData.options) : questionData.options;
                                      } catch (e) { /* ignore */ }
                                      const studentOptId = questionData.raw_student_answer?.selected_option_id
                                        || questionData.raw_student_answer?.selected_option
                                        || (typeof questionData.raw_student_answer === 'string' && questionData.raw_student_answer.length === 1 ? questionData.raw_student_answer : null);
                                      const correctOptId = questionData.raw_correct_answer?.selected_option_id
                                        || questionData.raw_correct_answer?.selected_option
                                        || (typeof questionData.raw_correct_answer === 'string' ? questionData.raw_correct_answer.trim() : null);
                                      const optionEntries = Object.entries(parsedOpts);

                                      return (
                                        <div className="space-y-1.5">
                                          {optionEntries.map(([key, text]) => {
                                            const isStudentPick = studentOptId && key.toUpperCase() === studentOptId.toUpperCase();
                                            const isCorrectOpt = correctOptId && key.toUpperCase() === correctOptId.toUpperCase();
                                            const isStudentCorrect = isStudentPick && isCorrectOpt;
                                            const isStudentWrong = isStudentPick && !isCorrectOpt;

                                            return (
                                              <div key={key} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                                                isStudentCorrect
                                                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-700'
                                                  : isStudentWrong
                                                    ? 'bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-700'
                                                    : isCorrectOpt
                                                      ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 border-dashed'
                                                      : 'border border-transparent'
                                              }`}>
                                                {/* Letter */}
                                                <span className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                                  isStudentCorrect ? 'bg-emerald-500 text-white'
                                                  : isStudentWrong ? 'bg-rose-500 text-white'
                                                  : isCorrectOpt ? 'bg-emerald-100 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-200'
                                                  : 'text-muted-foreground'
                                                }`}>
                                                  {key}
                                                </span>
                                                {/* Text */}
                                                <span className={`text-sm flex-1 ${
                                                  isStudentPick || isCorrectOpt ? 'font-medium text-foreground' : 'text-muted-foreground'
                                                }`}>{text}</span>
                                                {/* Labels */}
                                                {isStudentCorrect && (
                                                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 flex-shrink-0">
                                                    <CheckCircle className="w-3.5 h-3.5" /> Correct
                                                  </span>
                                                )}
                                                {isStudentWrong && (
                                                  <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1 flex-shrink-0">
                                                    <XCircle className="w-3.5 h-3.5" /> Selected
                                                  </span>
                                                )}
                                                {isCorrectOpt && !isStudentPick && (
                                                  <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1 flex-shrink-0">
                                                    <CheckCircle className="w-3.5 h-3.5" /> Correct Answer
                                                  </span>
                                                )}
                                              </div>
                                            );
                                          })}
                                          {/* Result row */}
                                          <div className="flex items-center justify-end gap-2 pt-1.5">
                                            {teacherGrade && (
                                              <span className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30">
                                                <GraduationCap className="w-3.5 h-3.5" />
                                                {teacherGrade.points_awarded} pts
                                              </span>
                                            )}
                                            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${result.color}`}>
                                              {isCorrectish ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                              {result.points || result.label}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })()
                                  ) : (
                                    /* === Non-MCQ / Fill-in-the-blank === */
                                    (() => {
                                      // Detect fill-in-the-blank from raw answer
                                      const raw = questionData.raw_student_answer;
                                      let blanksData = null;
                                      if (raw && typeof raw === 'object' && raw.blanks) {
                                        blanksData = raw.blanks;
                                      } else if (typeof raw === 'string') {
                                        try {
                                          const parsed = JSON.parse(raw);
                                          if (parsed?.blanks) blanksData = parsed.blanks;
                                        } catch (e) { /* not JSON */ }
                                      }

                                      // Also check raw correct answer for blanks
                                      const rawCorrect = questionData.raw_correct_answer;
                                      let correctBlanks = null;
                                      if (rawCorrect && typeof rawCorrect === 'object' && rawCorrect.blanks) {
                                        correctBlanks = rawCorrect.blanks;
                                      } else if (typeof rawCorrect === 'string') {
                                        try {
                                          const parsed = JSON.parse(rawCorrect);
                                          if (parsed?.blanks) correctBlanks = parsed.blanks;
                                        } catch (e) { /* not JSON */ }
                                      }

                                      if (blanksData) {
                                        // Fill-in-the-blank display
                                        const entries = Object.entries(blanksData).sort(([a], [b]) => Number(a) - Number(b));
                                        return (
                                          <div className="space-y-2">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Student&apos;s Answers</p>
                                            <div className="flex flex-wrap gap-2">
                                              {entries.map(([idx, val]) => (
                                                <div key={idx} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm ${
                                                  isCorrectish
                                                    ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200'
                                                    : 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                                                }`}>
                                                  <span className="text-[10px] font-bold text-muted-foreground">Blank {Number(idx) + 1}:</span>
                                                  <span className="font-medium">{val || '(empty)'}</span>
                                                </div>
                                              ))}
                                            </div>
                                            {correctBlanks && (
                                              <>
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mt-2">Expected Answers</p>
                                                <div className="flex flex-wrap gap-2">
                                                  {Object.entries(correctBlanks).sort(([a], [b]) => Number(a) - Number(b)).map(([idx, val]) => (
                                                    <div key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-sm text-emerald-800 dark:text-emerald-200">
                                                      <span className="text-[10px] font-bold text-muted-foreground">Blank {Number(idx) + 1}:</span>
                                                      <span className="font-medium">{val || '(empty)'}</span>
                                                    </div>
                                                  ))}
                                                </div>
                                              </>
                                            )}
                                            {/* Result row */}
                                            <div className="flex items-center justify-end gap-2 pt-1.5">
                                              {teacherGrade && (
                                                <span className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30">
                                                  <GraduationCap className="w-3.5 h-3.5" />
                                                  {teacherGrade.points_awarded} pts
                                                </span>
                                              )}
                                              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${result.color}`}>
                                                {isCorrectish ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                                {result.points || result.label}
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      }

                                      // Regular non-MCQ side by side
                                      return (
                                        <div className="space-y-2">
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3">
                                              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1 flex items-center gap-1">
                                                <CheckCircle className="w-3 h-3" /> Expected Answer
                                              </p>
                                              <p className="text-sm text-foreground break-words leading-relaxed">{questionData.correct_answer || 'Not specified'}</p>
                                            </div>
                                            <div className={`border rounded-lg p-3 ${
                                              isCorrectish
                                                ? 'bg-blue-50/70 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
                                                : 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800'
                                            }`}>
                                              <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1 ${
                                                isCorrectish ? 'text-blue-600 dark:text-blue-400' : 'text-rose-600 dark:text-rose-400'
                                              }`}>
                                                <User className="w-3 h-3" /> Student&apos;s Answer
                                              </p>
                                              <p className="text-sm text-foreground break-words leading-relaxed">{questionData.student_answer}</p>
                                            </div>
                                          </div>
                                          {/* Result row */}
                                          <div className="flex items-center justify-end gap-2 pt-1.5">
                                            {teacherGrade && (
                                              <span className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30">
                                                <GraduationCap className="w-3.5 h-3.5" />
                                                {teacherGrade.points_awarded} pts
                                              </span>
                                            )}
                                            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${result.color}`}>
                                              {isCorrectish ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                              {result.points || result.label}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })()
                                  )}
                                </div>
                              )}

                              {/* ── Feedback on hover ── */}
                              {hasFeedback && questionData.student_answer !== null && (
                                <div className="px-4 pb-3">
                                  <div className="relative inline-block group/feedback">
                                    {/* Eye icon trigger */}
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-blue-600 dark:text-blue-400 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors">
                                      <Eye className="w-3.5 h-3.5" />
                                      View Feedback
                                    </div>

                                    {/* Popover — opens to the right */}
                                    <div className="invisible group-hover/feedback:visible opacity-0 group-hover/feedback:opacity-100 transition-all duration-150 absolute left-full bottom-0 ml-3 z-[60] w-[500px]">
                                      {/* Arrow pointing left */}
                                      <div className="w-3 h-3 bg-white dark:bg-slate-900 border-l border-b border-slate-300 dark:border-slate-600 rotate-45 absolute -left-[7px] bottom-3 z-10"></div>
                                      <div className="rounded-xl border border-slate-300 dark:border-slate-600 shadow-2xl bg-white dark:bg-slate-900 max-h-[450px] overflow-y-auto">
                                        <div className="p-4 space-y-3">
                                          {feedback?.explanation && (
                                            <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
                                              <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">Feedback</p>
                                              <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">{feedback.explanation}</p>
                                            </div>
                                          )}

                                          {feedback?.strengths && feedback.strengths.length > 0 && (
                                            <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg">
                                              <p className="text-sm font-medium text-green-900 dark:text-green-100 mb-2">What you did well</p>
                                              <ul className="space-y-1">
                                                {feedback.strengths.map((s, idx) => (
                                                  <li key={idx} className="text-sm text-green-800 dark:text-green-200 flex items-start gap-2">
                                                    <span className="mt-1">&bull;</span><span>{s}</span>
                                                  </li>
                                                ))}
                                              </ul>
                                            </div>
                                          )}

                                          {feedback?.weaknesses && feedback.weaknesses.length > 0 && (
                                            <div className="bg-orange-50 dark:bg-orange-950/20 p-4 rounded-lg">
                                              <p className="text-sm font-medium text-orange-900 dark:text-orange-100 mb-2">Areas to improve</p>
                                              <ul className="space-y-1">
                                                {feedback.weaknesses.map((w, idx) => (
                                                  <li key={idx} className="text-sm text-orange-800 dark:text-orange-200 flex items-start gap-2">
                                                    <span className="mt-1">&bull;</span><span>{w}</span>
                                                  </li>
                                                ))}
                                              </ul>
                                            </div>
                                          )}

                                          {feedback?.improvement_hint && (
                                            <div className="bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded-lg">
                                              <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100 mb-1">Suggestion</p>
                                              <p className="text-sm text-yellow-800 dark:text-yellow-200 leading-relaxed">{feedback.improvement_hint}</p>
                                            </div>
                                          )}

                                          {feedback?.concept_explanation && (
                                            <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded-lg">
                                              <p className="text-sm font-medium text-purple-900 dark:text-purple-100 mb-1">Key concept</p>
                                              <p className="text-sm text-purple-800 dark:text-purple-200 leading-relaxed">{feedback.concept_explanation}</p>
                                            </div>
                                          )}

                                          {teacherGrade && (
                                            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 p-4 rounded-lg border-2 border-emerald-300 dark:border-emerald-700">
                                              <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0">
                                                  <GraduationCap className="w-4 h-4 text-white" />
                                                </div>
                                                <div>
                                                  <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100">
                                                    {teacherGrade.points_awarded}{feedback?.points_possible ? ` / ${feedback.points_possible}` : ''} points
                                                  </p>
                                                  {teacherGrade.feedback_text && (
                                                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{teacherGrade.feedback_text}</p>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function StudentDetailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <StudentDetailPageContent />
    </Suspense>
  );
}