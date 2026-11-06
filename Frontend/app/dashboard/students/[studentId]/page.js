'use client';

import { useAuth } from "@/context/AuthContext";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import dynamic from 'next/dynamic';
import StudentLearningMemory from '@/components/StudentLearningMemory';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MathText } from "@/components/MathText";
import { StatusDot, STATUS_STYLES } from "@/components/student/QuestionStatus";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ArrowLeft, User, BookOpen, TrendingUp, TrendingDown, Minus, CheckCircle, XCircle, HelpCircle, Download, FileText, FileJson, ClipboardList, MessageSquare, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Target, GraduationCap, Activity, Shield, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useCallback, Suspense, useMemo, memo } from "react";
import { apiClient } from "@/lib/auth";
import { useAPI } from "@/lib/useSWR";

// Same visual language as the student review (components/student/*): neutral
// panels, and colour only for the outcome or the reference answer.
const ANSWER_TONES = {
  reference: { box: 'bg-green-50 dark:bg-green-950/50 border-green-300 dark:border-green-700', title: 'text-green-700 dark:text-green-400' },
  correct: { box: 'bg-green-50 dark:bg-green-950/50 border-green-300 dark:border-green-700', title: 'text-green-700 dark:text-green-400' },
  partial: { box: 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700', title: 'text-amber-700 dark:text-amber-400' },
  incorrect: { box: 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800', title: 'text-rose-700 dark:text-rose-400' },
  neutral: { box: 'bg-muted/50 dark:bg-muted border-border', title: 'text-foreground' },
};
// Left edge of each question card, so outcomes can be scanned down the page.
const CARD_EDGE = {
  correct: 'border-l-green-600', partial: 'border-l-amber-500', incorrect: 'border-l-rose-500',
  unanswered: 'border-l-border', reviewed: 'border-l-border', pending: 'border-l-border', unavailable: 'border-l-border',
};

function AnswerBox({ title, tone = 'neutral', children }) {
  const t = ANSWER_TONES[tone] || ANSWER_TONES.neutral;
  return <div className={`min-w-0 rounded-lg border p-4 ${t.box}`}>
    <h4 className={`mb-2 text-sm font-semibold ${t.title}`}>{title}</h4>
    {children}
  </div>;
}

function FeedbackSection({ title, children }) {
  return <section className="space-y-2">
    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
    {children}
  </section>;
}

function FeedbackPoints({ items }) {
  return <ul className="space-y-1.5 pl-5">
    {items.map((item, idx) => <li key={idx} className="list-disc text-sm leading-relaxed marker:text-muted-foreground"><MathText inline>{item}</MathText></li>)}
  </ul>;
}

function StudentDetailPageContent() {
  const { user, loading, isAuthenticated } = useAuth();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const studentId = useMemo(() => {
    try { return decodeURIComponent(params.studentId || ''); }
    catch { return params.studentId || ''; }
  }, [params.studentId]);
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
                `/api/modules/${module.id}/survey/students/${encodeURIComponent(studentId)}`,
                { skipAuthLogout: true }
              );
              response = studentSurveyResponse.my_response || null;
            } catch { /* No survey response yet */ }
            return { config: surveyConfig, response };
          } catch { return { config: null, response: null }; }
        })(),
        // Student answers
        apiClient.get(`/api/student-answers?module_id=${module.id}`),
        // AI feedback
        apiClient.get(`/api/ai-feedback/teacher/module/${module.id}/released?student_id=${encodeURIComponent(studentId)}`, { skipAuthLogout: true })
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
            // Handle {text_response: "..."} format (short/long answer)
            if (answer.text_response !== undefined) {
              return String(answer.text_response ?? '').trim() || null;
            }

            // Handle {selected_option_ids: ["A", "C"]} format (multi-select MCQ)
            if (Array.isArray(answer.selected_option_ids)) {
              return answer.selected_option_ids.map(id => formatAnswer(id, options)).join(', ') || null;
            }

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
            // Unknown shape: show its plain values rather than raw JSON.
            const values = Object.values(answer).filter(v => v !== null && typeof v !== 'object' && String(v).trim());
            return values.length ? values.join(', ') : null;
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
      return { label: 'Unanswered', status: 'unanswered', points: null };
    }

    if (isMCQ) {
      return questionData.is_correct
        ? { label: 'Correct', status: 'correct', points: '1/1' }
        : { label: 'Incorrect', status: 'incorrect', points: '0/1' };
    }

    // Essay/short answer with score
    if (feedback?.score !== null && feedback?.score !== undefined) {
      const scorePercent = Math.round(feedback.score > 1 ? feedback.score : feedback.score * 100);
      const pointsEarned = teacherGrade?.points_awarded ?? (feedback.points_earned != null ? feedback.points_earned : null);
      const pointsPossible = feedback.points_possible || null;
      const pointsDisplay = pointsEarned != null && pointsPossible != null ? `${pointsEarned}/${pointsPossible}` : `${scorePercent}%`;

      const status = scorePercent >= 80 ? 'correct' : scorePercent >= 40 ? 'partial' : 'incorrect';
      return { label: pointsDisplay, status, points: pointsDisplay, percent: scorePercent };
    }

    return questionData.is_correct
      ? { label: 'Correct', status: 'correct', points: null }
      : { label: 'Incorrect', status: 'incorrect', points: null };
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
                {/* Student overview */}
                <div className="mb-6 relative">

                  <div className="relative p-5 sm:p-6 rounded-xl border bg-muted/20">
                    {/* Top Row: Back + Breadcrumb + Prev/Next Nav */}
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
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
                          <Link href={`/dashboard?module=${encodeURIComponent(moduleName)}`} className="hover:text-foreground">Dashboard</Link>
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
                      <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border bg-background text-muted-foreground">
                        <User className="size-6" aria-hidden="true" />
                      </div>

                      {/* Student Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                          <h1 className="break-all text-2xl font-semibold tracking-tight text-foreground">{student?.student_id}</h1>
                          <span className="px-2.5 py-1 bg-background border text-muted-foreground rounded-md text-xs font-medium">
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
                            <CheckCircle className="w-4 h-4" />
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
                                ? <strong className="text-foreground">{student.teacher_graded_count} Teacher Graded</strong>
                                : student?.ai_only_count > 0
                                  ? <strong className="text-gray-700 dark:text-muted-foreground">AI Graded</strong>
                                  : <strong className="text-muted-foreground">Pending</strong>
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
                            <div className="absolute right-0 mt-2 w-48 bg-card dark:bg-muted border border-border rounded-lg shadow-xl z-50">
                              <div className="py-1">
                                <button
                                  onClick={() => { downloadStudentReport(); setShowDownloadMenu(false); }}
                                  className="w-full text-left px-4 py-2 text-sm hover:bg-muted flex items-center gap-2"
                                >
                                  <FileText className="w-4 h-4 text-green-600 dark:text-green-300" />
                                  Export as CSV
                                </button>
                                <button
                                  onClick={() => { downloadStudentReportJSON(); setShowDownloadMenu(false); }}
                                  className="w-full text-left px-4 py-2 text-sm hover:bg-muted flex items-center gap-2"
                                >
                                  <FileJson className="w-4 h-4 text-foreground" />
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
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
                  {/* Score Overview */}
                  <Card className="border-border bg-background text-foreground overflow-hidden py-0 gap-0 shadow-none">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium text-card-foreground">Score Overview</p>
                        <Target className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="flex items-center gap-3">
                        {/* Circular Progress */}
                        <div className="relative w-16 h-16 flex-shrink-0">
                          <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                            <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted" />
                            <circle cx="32" cy="32" r="28" fill="none" strokeWidth="6" strokeLinecap="round"
                              strokeDasharray={`${(student?.avg_score || 0) * 1.759} 175.9`}
                              className="text-foreground"
                              stroke="currentColor"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-sm font-bold text-foreground">{student?.avg_score || 0}%</span>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <p className="font-semibold text-foreground">
                            {student?.completed_questions ? 'Average score' : 'No answers yet'}
                          </p>
                          <p>{student?.progress || 0}% complete</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Questions Breakdown */}
                  <Card className="border-border bg-background text-foreground overflow-hidden py-0 gap-0 shadow-none">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium text-muted-foreground">Questions</p>
                        <BookOpen className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1"><StatusDot status="correct" /> Correct</span>
                          <span className="font-bold text-foreground">{student?.correct_answers || 0}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1"><StatusDot status="incorrect" /> Incorrect</span>
                          <span className="font-bold text-foreground">{student?.incorrect_answers || 0}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1"><StatusDot status="unanswered" /> Unanswered</span>
                          <span className="font-bold text-foreground">{student?.unanswered || 0}</span>
                        </div>
                        {/* Mini bar chart */}
                        <div className="flex h-2 rounded-full overflow-hidden bg-muted mt-1">
                          {(student?.correct_answers || 0) > 0 && (
                            <div className="bg-emerald-500 h-full" style={{width: `${(student.correct_answers / student.total_questions) * 100}%`}}></div>
                          )}
                          {(student?.incorrect_answers || 0) > 0 && (
                            <div className="bg-rose-500 h-full" style={{width: `${(student.incorrect_answers / student.total_questions) * 100}%`}}></div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Attempts Used */}
                  <Card className="border-border bg-background text-foreground overflow-hidden py-0 gap-0 shadow-none">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium text-card-foreground">Attempts Used</p>
                        <Activity className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-3xl font-bold text-card-foreground">{student?.total_attempts || 1}</span>
                        {moduleData?.max_attempts && (
                          <span className="text-lg text-muted-foreground">/ {moduleData.max_attempts}</span>
                        )}
                      </div>
                      {moduleData?.max_attempts ? (
                        <>
                          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                            <div className="h-full rounded-full bg-foreground"
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
                  <Card className="border-border bg-background text-foreground overflow-hidden py-0 gap-0 shadow-none">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium text-muted-foreground">Grade Status</p>
                        <GraduationCap className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-foreground inline-block"></span> Teacher graded</span>
                          <span className="font-bold text-foreground">{student?.teacher_graded_count || 0}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-muted-foreground/60 inline-block"></span> AI only</span>
                          <span className="font-bold text-foreground">{student?.ai_only_count || 0}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full border border-muted-foreground/50 inline-block"></span> Ungraded</span>
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
                          <TrendingUp className="w-5 h-5 text-muted-foreground" />
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
                                aria-pressed={selectedAttempt === attempt.attempt}
                                className={`flex-shrink-0 p-4 rounded-xl border transition-colors min-w-[140px] text-left ${
                                  selectedAttempt === attempt.attempt
                                    ? 'border-foreground'
                                    : 'border-border hover:border-foreground/40'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-semibold text-muted-foreground uppercase">Attempt {attempt.attempt}</span>
                                  {trend && (
                                    trend === 'up' ? <TrendingUp aria-label="Improved" className="w-4 h-4 text-muted-foreground" /> :
                                    trend === 'down' ? <TrendingDown aria-label="Declined" className="w-4 h-4 text-rose-500" /> :
                                    <Minus aria-label="No change" className="w-4 h-4 text-muted-foreground" />
                                  )}
                                </div>
                                <div className="text-2xl font-semibold tabular-nums text-foreground">
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
                    <Card className="overflow-hidden border-border bg-background py-0 gap-0 shadow-none">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-4 p-5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2"
                        aria-expanded={showSurvey}
                        aria-controls="student-survey-details"
                        onClick={() => setShowSurvey(value => !value)}
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground"><ClipboardList className="size-5" /></span>
                          <span><span className="block text-base font-semibold text-foreground">Student feedback survey</span>
                            <span className="mt-1 block text-sm text-muted-foreground">{surveyResponse ? `Submitted on ${new Date(surveyResponse.submitted_at).toLocaleString()}` : 'Not submitted yet'}</span>
                          </span>
                        </span>
                        {showSurvey ? <ChevronUp className="size-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="size-4 shrink-0 text-muted-foreground" />}
                      </button>
                      {showSurvey && (
                        <CardContent id="student-survey-details" className="border-t p-5">
                        {surveyResponse ? (
                          <div className="space-y-6">
                            {surveyData.survey_questions.map((question, qIdx) => (
                              <div key={question.id} className="border-b border-border pb-6 last:border-0 last:pb-0">
                                <div className="flex items-start gap-3 mb-3">
                                  <div className="w-8 h-8 bg-muted dark:bg-card dark:bg-card/30 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <span className="text-sm font-bold text-gray-700 dark:text-muted-foreground">Q{qIdx + 1}</span>
                                  </div>
                                  <div className="flex-1">
                                    <p className="font-semibold text-base text-foreground mb-1">
                                      {question.question}
                                      {question.required && <span className="text-red-500 ml-1">*</span>}
                                    </p>
                                    <div className="flex items-center gap-2 mt-2">
                                      <div className={`text-xs px-2 py-1 rounded ${
                                        question.type === 'short'
                                          ? 'bg-muted dark:bg-card/30 text-gray-800 dark:text-muted-foreground'
                                          : 'bg-muted dark:bg-card dark:bg-card/30 text-gray-800 dark:text-muted-foreground'
                                      }`}>
                                        {question.type === 'short' ? 'Short Answer' : 'Long Answer'}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="ml-11">
                                  <div className="flex items-start gap-2">
                                    <MessageSquare className="w-4 h-4 text-muted-foreground mt-1 flex-shrink-0" />
                                    <div className="flex-1 p-4 rounded-lg bg-muted/50 dark:bg-card border border-border ">
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
                  <div className="mb-6 inline-flex rounded-lg border border-border p-1" role="group" aria-label="Choose attempt">
                    <div className="flex flex-wrap gap-1">
                      {Object.keys(answersByAttempt).sort((a, b) => Number(a) - Number(b)).map(attempt => (
                        <button
                          key={attempt}
                          onClick={() => setSelectedAttempt(Number(attempt))}
                          aria-pressed={selectedAttempt === Number(attempt)}
                          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                            selectedAttempt === Number(attempt)
                              ? 'bg-foreground text-background'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
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

                <StudentLearningMemory moduleId={resolvedModuleId} studentId={studentId} onAttempt={setSelectedAttempt} />

                {/* Question Analysis */}
                <div>
                  {/* Section Header */}
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold tracking-tight text-foreground">
                      Answers
                      {Object.keys(answersByAttempt).length > 1 && (
                        <span className="text-sm font-normal text-muted-foreground ml-2">Attempt {selectedAttempt}</span>
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
                            <tr className="border-b border-border text-xs">
                              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-10">#</th>
                              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Question</th>
                              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-48">Student&apos;s answer</th>
                              <th className="text-center px-3 py-2.5 font-medium text-muted-foreground w-28">Result</th>
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
                                      <p className="truncate max-w-md" title={questionData.question_text}><MathText inline>{questionData.question_text}</MathText></p>
                                    </td>
                                    <td className="p-3">
                                      {questionData.student_answer ? (
                                        <span className="truncate block max-w-[180px]" title={String(questionData.student_answer)}>{questionData.student_answer}</span>
                                      ) : (
                                        <span className="text-muted-foreground italic">-</span>
                                      )}
                                    </td>
                                    <td className="p-3 text-center">
                                      <span className="inline-flex items-center gap-2 text-xs">
                                        <StatusDot status={result.status} />
                                        <span className="tabular-nums">{result.points || STATUS_STYLES[result.status].label}</span>
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
                    <div className="space-y-6">
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

                          const isUnanswered = questionData.student_answer === null;
                          let parsedOpts = {};
                          if (isMCQ && questionData.options) {
                            try { parsedOpts = typeof questionData.options === 'string' ? JSON.parse(questionData.options) : questionData.options; } catch (e) { /* ignore */ }
                          }
                          const readBlanks = (value) => {
                            if (value && typeof value === 'object') return value.blanks || null;
                            if (typeof value === 'string') { try { return JSON.parse(value)?.blanks || null; } catch (e) { return null; } }
                            return null;
                          };
                          const blanksData = isMCQ ? null : readBlanks(questionData.raw_student_answer);
                          const correctBlanks = blanksData ? readBlanks(questionData.raw_correct_answer) : null;
                          const typeLabel = isMCQ ? 'Multiple choice' : blanksData ? 'Fill in the blank' : questionType === 'essay' ? 'Essay' : 'Short answer';
                          const studentOptId = questionData.raw_student_answer?.selected_option_id
                            || questionData.raw_student_answer?.selected_option
                            || (typeof questionData.raw_student_answer === 'string' && questionData.raw_student_answer.length === 1 ? questionData.raw_student_answer : null);
                          const correctOptId = questionData.raw_correct_answer?.selected_option_id
                            || questionData.raw_correct_answer?.selected_option
                            || (typeof questionData.raw_correct_answer === 'string' ? questionData.raw_correct_answer.trim() : null);
                          const sameKey = (a, b) => a && b && String(a).toUpperCase() === String(b).toUpperCase();

                          return (
                            <article
                              key={`${questionData.question_id}-${questionData.attempt}`}
                              aria-label={`Question ${index + 1}`}
                              className={`overflow-hidden rounded-xl border border-l-4 border-border bg-card shadow-sm ${CARD_EDGE[result.status] || 'border-l-border'}`}
                            >
                              {/* Question + outcome */}
                              <header className="flex flex-col gap-3 border-b border-border bg-muted/40 px-5 py-4 sm:flex-row sm:items-start">
                                <div className="flex min-w-0 flex-1 items-start gap-3">
                                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-bold tabular-nums text-background">
                                    {index + 1}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <MathText embedLinks className="text-base font-semibold leading-relaxed text-foreground">{questionData.question_text}</MathText>
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
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {typeLabel}
                                      {questionData.answered_at && ` · ${new Date(questionData.answered_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex shrink-0 flex-col gap-1 pl-11 text-sm sm:items-end sm:pl-0">
                                  <span className="inline-flex items-center gap-2">
                                    <StatusDot status={result.status} />
                                    <span className="font-medium">{STATUS_STYLES[result.status].label}</span>
                                    {result.points && <span className="tabular-nums text-muted-foreground">{result.points}</span>}
                                  </span>
                                  {teacherGrade && (
                                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
                                      Teacher grade · {teacherGrade.points_awarded} pts
                                    </span>
                                  )}
                                </div>
                              </header>

                              {/* Answers */}
                              {!isUnanswered && (
                                <div className="p-5">
                                  {isMCQ && Object.keys(parsedOpts).length > 0 ? (
                                    <ul className="space-y-2" aria-label="Answer options">
                                      {Object.entries(parsedOpts).map(([key, text]) => {
                                        const chosen = sameKey(key, studentOptId);
                                        const right = sameKey(key, correctOptId);
                                        return (
                                          <li key={key} className={`flex items-center gap-3 rounded-lg border p-3 ${
                                            right ? 'bg-green-50 dark:bg-green-950/50 border-green-300 dark:border-green-700'
                                              : chosen ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800'
                                              : 'bg-muted/50 dark:bg-muted border-border'
                                          }`}>
                                            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                              right ? 'bg-green-700 text-white' : chosen ? 'bg-rose-600 text-white' : 'bg-gray-300 text-gray-700 dark:bg-gray-600 dark:text-foreground'
                                            }`}>{key}</span>
                                            <MathText className={`min-w-0 flex-1 text-sm leading-relaxed break-words ${right || chosen ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                                              {typeof text === 'string' ? text : text?.text || String(text)}
                                            </MathText>
                                            {(chosen || right) && (
                                              <span className="flex shrink-0 flex-col items-end gap-0.5 text-xs font-bold sm:flex-row sm:items-center sm:gap-3">
                                                {chosen && !right && <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-400"><XCircle className="h-4 w-4" aria-hidden="true" />Student&apos;s choice</span>}
                                                {chosen && right && <span className="text-green-700 dark:text-green-400">Student&apos;s choice</span>}
                                                {right && <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400"><CheckCircle className="h-4 w-4" aria-hidden="true" />Correct answer</span>}
                                              </span>
                                            )}
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  ) : blanksData ? (
                                    <div className="space-y-4">
                                      {Object.entries(blanksData).sort(([a], [b]) => Number(a) - Number(b)).map(([idx, val]) => (
                                        <div key={idx}>
                                          <h4 className="mb-2 text-sm font-semibold">Blank {Number(idx) + 1}</h4>
                                          <div className="grid gap-3 md:grid-cols-2">
                                            <AnswerBox title="Student&apos;s answer" tone={ANSWER_TONES[result.status] ? result.status : 'neutral'}>
                                              <MathText className="text-sm leading-relaxed break-words">{val || 'Left empty'}</MathText>
                                            </AnswerBox>
                                            {correctBlanks?.[idx] !== undefined && (
                                              <AnswerBox title="Accepted answer" tone="reference">
                                                <MathText className="text-sm leading-relaxed break-words">{correctBlanks[idx]}</MathText>
                                              </AnswerBox>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="grid gap-3 md:grid-cols-2">
                                      <AnswerBox title="Student&apos;s answer" tone={ANSWER_TONES[result.status] ? result.status : 'neutral'}>
                                        {questionData.student_answer
                                          ? <MathText className="text-sm leading-relaxed whitespace-pre-wrap break-words">{questionData.student_answer}</MathText>
                                          : <p className="text-sm italic text-muted-foreground">No answer given</p>}
                                      </AnswerBox>
                                      <AnswerBox title="Reference answer" tone="reference">
                                        {questionData.correct_answer
                                          ? <MathText className="text-sm leading-relaxed whitespace-pre-wrap break-words">{questionData.correct_answer}</MathText>
                                          : <p className="text-sm text-muted-foreground">No reference answer for this question.</p>}
                                      </AnswerBox>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Feedback, inline and keyboard/touch friendly */}
                              {hasFeedback && !isUnanswered && (
                                <details className="group border-t border-border">
                                  <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                                    <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
                                    View feedback
                                  </summary>
                                  <div className="space-y-5 px-5 pb-5">
                                    {teacherGrade && (
                                      <FeedbackSection title="Teacher's grade">
                                        <p className="text-base font-semibold tabular-nums">
                                          {teacherGrade.points_awarded}{feedback?.points_possible ? ` / ${feedback.points_possible}` : ''} points
                                        </p>
                                        {teacherGrade.feedback_text && <MathText className="text-sm leading-relaxed whitespace-pre-wrap">{teacherGrade.feedback_text}</MathText>}
                                      </FeedbackSection>
                                    )}
                                    {feedback?.explanation?.trim() && (
                                      <FeedbackSection title="Feedback">
                                        <MathText className="text-sm leading-relaxed">{feedback.explanation}</MathText>
                                      </FeedbackSection>
                                    )}
                                    {feedback?.strengths?.length > 0 && (
                                      <FeedbackSection title="What went well"><FeedbackPoints items={feedback.strengths} /></FeedbackSection>
                                    )}
                                    {feedback?.weaknesses?.length > 0 && (
                                      <FeedbackSection title="Areas to improve"><FeedbackPoints items={feedback.weaknesses} /></FeedbackSection>
                                    )}
                                    {feedback?.improvement_hint && (
                                      <FeedbackSection title="Suggestion">
                                        <MathText className="text-sm leading-relaxed">{feedback.improvement_hint}</MathText>
                                      </FeedbackSection>
                                    )}
                                    {feedback?.concept_explanation && (
                                      <FeedbackSection title="Key concept">
                                        <MathText className="text-sm leading-relaxed">{feedback.concept_explanation}</MathText>
                                      </FeedbackSection>
                                    )}
                                  </div>
                                </details>
                              )}
                            </article>
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
