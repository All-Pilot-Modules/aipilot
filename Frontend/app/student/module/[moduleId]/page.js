'use client';

import { useState, useEffect, useCallback, useRef, Suspense, memo, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BookOpen,
  FileText,
  HelpCircle,
  User,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  Play,
  Brain,
  Target,
  MessageSquare,
  Eye,
  ArrowLeft,
  ArrowRight,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  RefreshCw
} from "lucide-react";
import { apiClient } from "@/lib/auth";
import { FullPageLoader } from '@/components/LoadingSpinner';
import { ErrorAlert } from '@/components/ErrorAlert';
import { PageLoadingSkeleton, CardSkeleton } from '@/components/SkeletonLoader';
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from '@/lib/errorMessages';
import { FeedbackCritique } from '@/components/FeedbackCritique';
import { FeedbackStatusIndicator } from '@/components/FeedbackStatusIndicator';
import {
  FeedbackGeneratingBanner,
  FeedbackSkeletonCard,
  QuestionFeedbackLoader,
  AllQuestionsLoader
} from '@/components/FeedbackLoader';

// Dynamically import heavy components for better code splitting
const ChatTab = dynamic(() => import('./ChatTab'), {
  loading: () => <div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>,
  ssr: false
});

const SurveyTab = dynamic(() => import('./SurveyTab'), {
  loading: () => <div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>,
  ssr: false
});

const ModuleConsentModal = dynamic(() => import('@/components/ModuleConsentModal'), {
  loading: () => null,
  ssr: false
});

const StudentModuleContent = memo(function StudentModuleContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const moduleId = params?.moduleId;

  // Prevent SSR - ensure we only render on client
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Get tab from URL parameter, default to "assignments"
  const initialTab = searchParams.get('tab') || 'assignments';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Sync activeTab with URL parameter changes (important for redirects)
  // Only sync when URL changes, not when activeTab changes (to prevent race condition)
  useEffect(() => {
    const tabParam = searchParams.get('tab') || 'assignments';
    console.log(`🔄 Tab from URL: ${tabParam}`);
    setActiveTab(tabParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]); // Only depend on searchParams to fix tab switching bug

  // State declarations - MUST come before useEffect hooks
  const [moduleAccess, setModuleAccess] = useState(null);
  const [moduleData, setModuleData] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [userProgress, setUserProgress] = useState({});
  const [feedbackData, setFeedbackData] = useState({});
  const [feedbackByAttempt, setFeedbackByAttempt] = useState({}); // Group feedback by attempt number
  const [selectedAttempt, setSelectedAttempt] = useState(1); // Currently selected attempt to view
  const [submissionStatus, setSubmissionStatus] = useState(null); // Track submission status
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState(null); // Track real-time feedback generation status
  const [isPolling, setIsPolling] = useState(false); // Track if we're actively polling
  const [pollCount, setPollCount] = useState(0); // Track number of polling attempts
  const [useSSE, setUseSSE] = useState(true); // Try SSE first, fall back to polling
  const eventSourceRef = useRef(null); // Ref for SSE EventSource connection
  const [answeredQuestions, setAnsweredQuestions] = useState({}); // Track which questions were answered
  const [expandedRubrics, setExpandedRubrics] = useState({}); // Track which rubric breakdowns are expanded
  const [hasTeacherGrades, setHasTeacherGrades] = useState(false); // Track if teacher has graded any work
  const [cleaningUp, setCleaningUp] = useState(false); // Track cleanup in progress
  const [regeneratingAll, setRegeneratingAll] = useState(false); // Track regenerate all in progress
  // Consent modal state
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);

  // Survey status state
  const [surveySubmitted, setSurveySubmitted] = useState(false);
  const [surveyRequired, setSurveyRequired] = useState(false);

  // Check if chatbot is enabled based on module settings
  const isChatbotEnabled = moduleData?.assignment_config?.features?.chatbot_feedback?.enabled ?? true;

  // Memoize expensive computations to avoid recalculating on every render
  const questionTypeCounts = useMemo(() => {
    if (!questions || questions.length === 0) return [];
    const counts = {};
    for (const q of questions) {
      const t = q?.type || 'unknown';
      counts[t] = (counts[t] || 0) + 1;
    }
    const typeConfig = {
      mcq: { label: 'Multiple Choice', color: 'bg-green-500' },
      mcq_multiple: { label: 'MCQ (Multiple)', color: 'bg-emerald-500' },
      short: { label: 'Short Answer', color: 'bg-yellow-500' },
      long: { label: 'Long Answer', color: 'bg-purple-500' },
      fill_blank: { label: 'Fill in Blanks', color: 'bg-blue-500' },
      multi_part: { label: 'Multi-Part', color: 'bg-pink-500' },
    };
    return Object.entries(counts)
      .filter(([type]) => typeConfig[type])
      .map(([type, count]) => ({ type, count, ...typeConfig[type] }));
  }, [questions]);

  // Memoize feedback score calculations (runs on every render otherwise)
  const feedbackStats = useMemo(() => {
    const entries = Object.values(feedbackData);
    const total = entries.length;
    if (total === 0) return { correctCount: 0, total: 0, percentage: 0 };

    const correctCount = entries.filter(f => {
      if (f.teacher_grade) return f.teacher_grade.points_awarded >= f.points_possible;
      return f.is_correct;
    }).length;

    let totalPointsEarned = 0;
    let totalPointsPossible = 0;
    for (const f of entries) {
      if (f.teacher_grade) {
        totalPointsEarned += f.teacher_grade.points_awarded || 0;
        totalPointsPossible += f.points_possible || 0;
      } else {
        const scoreValue = f.correctness_score ?? f.score ?? 0;
        const pointsPossible = f.points_possible || 1;
        const score = scoreValue > 1 ? scoreValue / 100 : scoreValue;
        totalPointsEarned += score * pointsPossible;
        totalPointsPossible += pointsPossible;
      }
    }

    const percentage = totalPointsPossible > 0
      ? Math.round((totalPointsEarned / totalPointsPossible) * 100)
      : 0;

    return { correctCount, total, percentage };
  }, [feedbackData]);

  // Memoize visible attempts for the attempt selector
  const visibleAttempts = useMemo(() => {
    const maxAttempts = submissionStatus?.max_attempts || 2;
    return Object.keys(feedbackByAttempt)
      .filter(attemptNum => {
        const isFinalAttempt = Number(attemptNum) >= maxAttempts;
        if (isFinalAttempt) {
          return Object.values(feedbackByAttempt[attemptNum]).some(f => f.teacher_grade);
        }
        return true;
      })
      .sort((a, b) => Number(a) - Number(b));
  }, [feedbackByAttempt, submissionStatus]);

  // Check if student has submitted consent for this module
  const checkConsentStatus = useCallback(async (access) => {
    try {
      // First, check localStorage for consent status (persists across sessions)
      const consentKey = `consent_${moduleId}_${access.studentId}`;
      const storedConsent = localStorage.getItem(consentKey);

      if (storedConsent) {
        console.log('✅ Consent already submitted (found in localStorage), skipping check');
        setConsentChecked(true);
        return;
      }

      // If not in localStorage, check via API
      const response = await apiClient.get(
        `/api/modules/${moduleId}/consent/${access.studentId}`
      );

      const { has_consented, is_enrolled, consent_status } = response;

      console.log('🔍 Consent API response:', {
        has_consented,
        is_enrolled,
        consent_status,
        waiver_status: consent_status // consent_status = waiver_status from backend
      });

      // If student has already consented (waiver_status is not NULL), store it in localStorage
      if (has_consented) {
        localStorage.setItem(consentKey, 'true');
        console.log('✅ Consent found in database (waiver_status not NULL), saved to localStorage');
        setConsentChecked(true);
        return; // Don't show modal
      }

      // If module requires consent and student hasn't consented (waiver_status is NULL)
      if (is_enrolled && !has_consented) {
        console.log('⚠️ Showing consent modal - waiver_status is NULL');
        setShowConsentModal(true);
      } else {
        console.log('✅ Not showing consent modal - student not enrolled or already consented');
      }

      setConsentChecked(true);
    } catch (error) {
      console.error('Failed to check consent status:', error);
      setConsentChecked(true); // Allow access if check fails
    }
  }, [moduleId]);

  const handleConsentSubmitted = (consentStatus) => {
    console.log('Consent submitted:', consentStatus);

    // Store consent in localStorage (persists across sessions)
    if (moduleAccess) {
      const consentKey = `consent_${moduleId}_${moduleAccess.studentId}`;
      localStorage.setItem(consentKey, 'true');
      console.log('✅ Consent saved to localStorage');

      // Also update sessionStorage to mark consent as submitted
      const accessData = { ...moduleAccess, consentSubmitted: true, consentStatus };
      sessionStorage.setItem('student_module_access', JSON.stringify(accessData));
      setModuleAccess(accessData);
    }

    setShowConsentModal(false);
    setConsentChecked(true);
  };

  // Mask student ID to show only last 2 digits
  const maskStudentId = (studentId) => {
    if (!studentId) return '';
    const idStr = String(studentId);
    if (idStr.length <= 2) return idStr;
    const lastTwo = idStr.slice(-2);
    const masked = '*'.repeat(idStr.length - 2);
    return masked + lastTwo;
  };

  // Effect to update feedbackData and answeredQuestions when selectedAttempt or feedbackByAttempt changes
  useEffect(() => {
    const currentFeedback = feedbackByAttempt[selectedAttempt] || {};
    const feedbackCount = Object.keys(currentFeedback).length;
    console.log(`[useEffect] Updating feedbackData for attempt ${selectedAttempt}: ${feedbackCount} items`);

    setFeedbackData({ ...currentFeedback });

    // Log the actual feedback IDs for debugging
    if (feedbackCount > 0) {
      console.log(`   Question IDs with feedback: ${Object.keys(currentFeedback).join(', ')}`);
    }

    // Update answered questions for the selected attempt
    const updateAnsweredQuestionsForAttempt = async () => {
      if (!moduleAccess?.studentId) return;

      try {
        // Fetch answers for the selected attempt only
        const answersResponse = await apiClient.get(
          `/api/student/modules/${moduleId}/my-answers?student_id=${moduleAccess.studentId}&attempt=${selectedAttempt}`
        );
        const submittedAnswers = answersResponse?.data || answersResponse || [];

        // Build answered map for this specific attempt with content validation
        const answeredMap = {};
        submittedAnswers.forEach(answer => {
          if (!answer || !answer.question_id) return;

          // Extract answer content
          let answerContent = null;
          if (typeof answer.answer === 'object' && answer.answer) {
            // Debug log
            console.log(`📋 Answer for question ${answer.question_id}:`, answer.answer);

            // Check for different answer formats
            if (answer.answer.text_response) {
              answerContent = answer.answer.text_response;
            } else if (answer.answer.selected_option_id) {
              answerContent = answer.answer.selected_option_id;
            } else if (answer.answer.selected_option) {
              answerContent = answer.answer.selected_option;
            } else if (answer.answer.selected_options) {
              // MCQ Multiple
              answerContent = Array.isArray(answer.answer.selected_options) && answer.answer.selected_options.length > 0 ? 'answered' : '';
              console.log(`  ✓ MCQ Multiple detected:`, answer.answer.selected_options);
            } else if (answer.answer.blanks) {
              // Fill-in-the-Blank
              const blanks = answer.answer.blanks;
              answerContent = (typeof blanks === 'object' && Object.keys(blanks).length > 0) ? 'answered' : '';
              console.log(`  ✓ Fill-blank detected:`, blanks, '=> Keys:', Object.keys(blanks).length);
            } else if (answer.answer.sub_answers) {
              // Multi-Part
              const subAnswers = answer.answer.sub_answers;
              answerContent = (typeof subAnswers === 'object' && Object.keys(subAnswers).length > 0) ? 'answered' : '';
              console.log(`  ✓ Multi-part detected:`, subAnswers);
            } else {
              answerContent = "";
              console.log(`  ⚠️ No recognized format for question ${answer.question_id}`);
            }
          } else if (typeof answer.answer === 'string') {
            answerContent = answer.answer;
          }

          // Only mark as answered if content is non-empty and not just whitespace
          if (answerContent && (answerContent === 'answered' || String(answerContent).trim())) {
            answeredMap[answer.question_id] = true;
          }
        });

        // Also include questions that have feedback (in case answers were deleted but feedback exists)
        Object.keys(currentFeedback).forEach(questionId => {
          answeredMap[questionId] = true;
        });

        setAnsweredQuestions(answeredMap);
        console.log(`📝 Attempt ${selectedAttempt}: ${Object.keys(answeredMap).length} questions answered`);
      } catch (err) {
        console.log(`No answers found for attempt ${selectedAttempt}`);
        // If no answers found, just use feedback as the source of truth
        const answeredMap = {};
        Object.keys(currentFeedback).forEach(questionId => {
          answeredMap[questionId] = true;
        });
        setAnsweredQuestions(answeredMap);
      }
    };

    updateAnsweredQuestionsForAttempt();
  }, [selectedAttempt, feedbackByAttempt, moduleAccess, moduleId]);

  const loadFeedbackForAnswers = useCallback(async (access) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`📥 [${timestamp}] Loading feedback for module ${moduleId}, student ${access.studentId}`);

    try {
      // Use the new API endpoint to fetch all feedback from database
      const apiUrl = `/api/student/modules/${moduleId}/feedback?student_id=${access.studentId}`;
      console.log(`📥 [${timestamp}] API URL: ${apiUrl}`);

      const response = await apiClient.get(apiUrl);
      console.log(`📥 [${timestamp}] Response received:`, Array.isArray(response) ? `${response.length} items` : typeof response);

      // Group feedback by attempt
      const byAttempt = {};

      if (response && Array.isArray(response)) {
        response.forEach(feedbackItem => {
          const attempt = feedbackItem.attempt || 1;

          // Initialize attempt group if needed
          if (!byAttempt[attempt]) {
            byAttempt[attempt] = {};
          }

          // Add feedback to the attempt group - create new object reference
          byAttempt[attempt][feedbackItem.question_id] = { ...feedbackItem };

          // Log the status for debugging
          if (attempt === (submissionStatus?.current_attempt - 1 || 1)) {
            console.log(`   📋 Q${feedbackItem.question_id}: status=${feedbackItem.generation_status}, hasExplanation=${!!feedbackItem.explanation}`);
          }
        });
      }

      // Create completely new object reference to trigger React update
      // Important: counter increment will trigger useEffect to update feedbackData
      setFeedbackByAttempt(prev => {
        // Return new object only if data actually changed
        const prevKeys = JSON.stringify(Object.keys(prev).sort());
        const newKeys = JSON.stringify(Object.keys(byAttempt).sort());
        if (prevKeys === newKeys) {
          // Same attempts exist, check if any feedback changed or status updated
          let hasChanges = false;
          for (const attempt in byAttempt) {
            const prevFeedback = prev[attempt] || {};
            const newFeedback = byAttempt[attempt];
            const prevCount = Object.keys(prevFeedback).length;
            const newCount = Object.keys(newFeedback).length;

            if (prevCount !== newCount) {
              hasChanges = true;
              break;
            }

            // Check if any feedback status changed
            for (const qId in newFeedback) {
              const prevStatus = prevFeedback[qId]?.generation_status;
              const newStatus = newFeedback[qId]?.generation_status;
              if (prevStatus !== newStatus) {
                console.log(`   🔄 Status changed for Q${qId}: ${prevStatus} → ${newStatus}`);
                hasChanges = true;
                break;
              }
            }

            if (hasChanges) break;
          }
          if (!hasChanges) {
            console.log('   ℹ️ No changes detected, keeping previous state');
            return prev; // No changes, return same reference
          }
        }
        console.log('   ✅ State updated with new feedback data');
        return { ...byAttempt }; // Return new reference
      });

      // feedbackByAttempt state update above already triggers dependent useEffects

      // Note: feedbackData will be set by the useEffect when selectedAttempt is determined
      // Don't set it here as selectedAttempt might still be the default value (1)

      const totalFeedback = Object.values(byAttempt).reduce((sum, attempt) => sum + Object.keys(attempt).length, 0);

      // Log feedback breakdown by attempt (helpful for debugging polling)
      const feedbackDetails = Object.keys(byAttempt).map(attemptNum => {
        const feedbackCount = Object.keys(byAttempt[attemptNum]).length;
        return `Attempt ${attemptNum}: ${feedbackCount} items`;
      }).filter(detail => !detail.includes(': 0 items')).join(', ');

      if (feedbackDetails) {
        console.log(`📊 Feedback loaded: ${feedbackDetails} (Total: ${totalFeedback})`);
      }

      // Check if any feedback has teacher grades
      const hasGrades = Object.values(byAttempt).some(attempt =>
        Object.values(attempt).some(feedback => feedback.teacher_grade)
      );
      setHasTeacherGrades(hasGrades);

      // Log when feedback count changes
      const previousCount = window._lastFeedbackCount || 0;
      if (previousCount !== totalFeedback) {
        const diff = totalFeedback - previousCount;
        console.log(`✅ 🎯 FEEDBACK UPDATED: ${previousCount} → ${totalFeedback} items (+${diff} new)`);
        console.log(`   📍 UI will re-render now with updated feedback!`);
        window._lastFeedbackCount = totalFeedback;
      } else if (totalFeedback > 0) {
        console.log(`   ℹ️ Feedback count unchanged: ${totalFeedback} items`);
      }

      return byAttempt;
    } catch (error) {
      console.error('Failed to load feedback:', error);
      // Don't fail the whole page if feedback loading fails
      return {};
    }
  }, [moduleId]);

  // Effect to start polling when tab changes to feedback
  useEffect(() => {
    const startPollingIfNeeded = async () => {
      if (activeTab === 'feedback' && moduleAccess && submissionStatus) {
        const currentAttempt = submissionStatus.current_attempt || 1;

        // Only poll if we have a submission (current_attempt > 1 means attempt 1 is done)
        if (currentAttempt > 1) {
          console.log('🔍 Checking if feedback is complete...');

          // FIRST: Run cleanup to catch any stale feedback from previous sessions
          console.log('🧹 Running cleanup for stale feedback...');
          try {
            await apiClient.post(
              `/api/student/modules/${moduleId}/cleanup-feedback?student_id=${moduleAccess.studentId}`
            );
            console.log('✅ Cleanup completed');
          } catch (error) {
            console.error('Cleanup failed:', error);
          }

          // Reload feedback to get latest status
          await loadFeedbackForAnswers(moduleAccess);

          // THEN: Check current feedback status
          try {
            const response = await apiClient.get(
              `/api/student/modules/${moduleId}/feedback-status?student_id=${moduleAccess.studentId}&attempt=${currentAttempt - 1}`
            );
            const status = response?.data || response || {};

            setFeedbackStatus(status);

            if (!status.all_complete) {
              console.log('🚀 Feedback incomplete - starting polling NOW');
              setIsPolling(true);
            } else {
              console.log('✅ All feedback already complete');
            }
          } catch (error) {
            console.error('Failed to check feedback status:', error);
            // If status check fails, start polling anyway to be safe
            console.log('⚠️ Status check failed, starting polling to be safe');
            setIsPolling(true);
          }
        }
      }
    };

    startPollingIfNeeded();
  }, [activeTab, moduleAccess, submissionStatus, moduleId, loadFeedbackForAnswers]);

  // Poll for feedback generation status
  const checkFeedbackStatus = useCallback(async (access, attempt) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`📡 [${timestamp}] Fetching feedback status for attempt ${attempt}...`);

    try {
      const response = await apiClient.get(
        `/api/student/modules/${moduleId}/feedback-status?student_id=${access.studentId}&attempt=${attempt}`
      );
      const status = response?.data || response || {};

      console.log(`📊 [${timestamp}] Status received:`, {
        ready: status.feedback_ready,
        total: status.total_questions,
        percentage: status.progress_percentage,
        complete: status.all_complete
      });

      setFeedbackStatus(status);

      // Load feedback data on every poll to show them as they're generated
      console.log(`📥 [${timestamp}] Loading feedback data...`);
      await loadFeedbackForAnswers(access).catch(err => {
        console.log(`❌ [${timestamp}] Feedback load failed:`, err.message || err);
      });
      console.log(`✅ [${timestamp}] Feedback data loaded successfully`);

      // If all feedback is complete, stop polling
      if (status.all_complete) {
        console.log(`🎉 [${timestamp}] All feedback generated!`);
        setIsPolling(false);
        return true; // All complete
      }

      return false; // Still generating
    } catch (error) {
      console.log(`⚠️ [${timestamp}] Feedback status check failed:`, error.message || error);
      return false; // Keep polling even if status check fails
    }
  }, [moduleId, loadFeedbackForAnswers]);

  const loadModuleContent = useCallback(async (access, retryCount = 0) => {
    const MAX_RETRIES = 2; // Page-level retries (apiClient already retries internally)

    try {
      setLoading(true);

      // Load core data first - handle errors gracefully for non-critical data
      let moduleResponse, documentsResponse, questionsResponse;

      try {
        [moduleResponse, documentsResponse, questionsResponse] = await Promise.all([
          apiClient.get(`/api/modules/${moduleId}`),
          apiClient.get(`/api/student/modules/${moduleId}/documents`).catch(err => {
            console.log('Documents loading failed (non-critical):', err.message || err);
            return { data: [] };
          }),
          apiClient.get(`/api/student/modules/${moduleId}/questions`)
        ]);
      } catch (error) {
        // If core data fails due to connection issue, retry at page level
        // (apiClient already retried 2-3 times internally, so this is a last resort)
        const isConnectionError = error.message?.includes('fetch') ||
                                 error.message?.includes('timeout') ||
                                 error.message?.includes('AbortError') ||
                                 error.message?.includes('Failed to fetch');

        if (isConnectionError) {
          if (retryCount < MAX_RETRIES) {
            const delay = 3000 * (retryCount + 1); // 3s, 6s
            console.log(`Connection issue (page retry ${retryCount + 1}/${MAX_RETRIES}), retrying in ${delay / 1000}s...`, error.message);
            setTimeout(() => {
              loadModuleContent(access, retryCount + 1);
            }, delay);
            return;
          } else {
            console.error(`Max retries (${MAX_RETRIES}) reached, giving up`);
            throw {
              message: 'Unable to connect to the server after multiple attempts. Please check your connection and try again.',
              canRetry: true,
              originalError: error
            };
          }
        }

        // For non-connection errors, throw to show error page
        throw error;
      }

      // Set data
      const moduleInfo = moduleResponse.data || moduleResponse;

      setDocuments(documentsResponse.data || documentsResponse);

      const questionsData = questionsResponse.data || questionsResponse;
      setQuestions(questionsData);

      // Run secondary calls in parallel — all non-critical, failures don't block
      const [teacherResult, surveyResult, submissionResult] = await Promise.allSettled([
        // Teacher info
        moduleInfo.teacher_id
          ? apiClient.get(`/api/users/${moduleInfo.teacher_id}`).then(r => r.data || r)
          : Promise.resolve(null),
        // Survey status
        access.studentId
          ? apiClient.get(`/api/student/modules/${moduleId}/survey/status?student_id=${access.studentId}`)
          : Promise.resolve(null),
        // Submission status
        access.studentId && questionsData.length > 0
          ? apiClient.get(`/api/student/modules/${moduleId}/submission-status?student_id=${access.studentId}`)
          : Promise.resolve(null)
      ]);

      // Process teacher info
      if (teacherResult.status === 'fulfilled' && teacherResult.value) {
        const teacherData = teacherResult.value;
        moduleInfo.teacher_name = teacherData.name || teacherData.email || 'Instructor';
      } else {
        moduleInfo.teacher_name = 'Instructor';
      }
      setModuleData(moduleInfo);

      // Process survey status
      if (surveyResult.status === 'fulfilled' && surveyResult.value) {
        setSurveySubmitted(surveyResult.value.has_submitted || false);
        setSurveyRequired(moduleInfo.survey_required || false);
      } else {
        setSurveySubmitted(false);
        setSurveyRequired(moduleInfo.survey_required || false);
      }

      // Process submission status
      let status = null;
      if (submissionResult.status === 'fulfilled' && submissionResult.value) {
        status = submissionResult.value?.data || submissionResult.value || {};
        setSubmissionStatus(status);
      } else if (access.studentId && questionsData.length > 0) {
        status = { current_attempt: 1, submissions: [], can_submit_again: true, all_attempts_done: false };
        setSubmissionStatus(status);
      }

      if (access.studentId && questionsData.length > 0) {
        // Load feedback from database - always succeeds, returns empty object on error
        const feedbackMap = await loadFeedbackForAnswers(access).catch(() => ({}));

        // Determine which attempt to show by default
        // Priority: Use the most recently completed submission (even if feedback is still generating)
        let attemptToShow = 1;

        if (status && status.current_attempt && status.current_attempt > 1) {
          // If current_attempt is 2, that means attempt 1 is complete
          // If current_attempt is 3, that means attempt 2 is complete, etc.
          attemptToShow = status.current_attempt - 1;
          console.log(`📍 Using submission status: showing attempt ${attemptToShow} (most recently completed)`);
        } else if (feedbackMap && Object.keys(feedbackMap).length > 0) {
          // Fallback: use the highest attempt number that has feedback
          const attemptNumbers = Object.keys(feedbackMap).map(Number).sort((a, b) => b - a);
          attemptToShow = attemptNumbers[0];
          console.log(`📍 Using feedback availability: showing attempt ${attemptToShow}`);
        }

        setSelectedAttempt(attemptToShow);

        // Set the feedback data for the selected attempt (may be empty if still generating)
        const selectedFeedback = feedbackMap[attemptToShow] || {};
        setFeedbackData(selectedFeedback);

        console.log(`✅ Showing attempt ${attemptToShow} with ${Object.keys(selectedFeedback).length} feedback items`);
        if (Object.keys(selectedFeedback).length === 0) {
          console.log('⏳ Feedback for this attempt is still being generated');
        }

        // Check if we should start polling (when on feedback tab after submission)
        if (initialTab === 'feedback') {
          const currentAttempt = status?.current_attempt || 1;
          console.log(`🔍 Checking if polling needed: currentAttempt=${currentAttempt}, tab=${initialTab}`);

          if (currentAttempt > 1) {
            // Check feedback status to see if we need to poll
            try {
              console.log(`📊 Checking feedback completion status...`);
              const feedbackStatusCheck = await checkFeedbackStatus(access, currentAttempt - 1);
              if (!feedbackStatusCheck) {
                // Start polling if not all complete
                console.log('🚀 ✅ STARTING POLLING - Feedback is incomplete');
                setIsPolling(true);
              } else {
                console.log('✅ All feedback already complete - no polling needed');
              }
            } catch (err) {
              // If feedback status check fails, just start polling to be safe
              console.log('⚠️ Feedback status check failed, starting polling anyway:', err);
              setIsPolling(true);
            }
          } else {
            console.log('ℹ️ No submission yet (attempt 1) - no polling needed');
          }
        }
      }

      // Clear any previous connection errors if we successfully loaded
      setError(null);
      // Set loading to false only on successful load
      setLoading(false);

    } catch (error) {
      console.error('Failed to load module content:', error);
      setError(error);
      setLoading(false); // Only set loading false when actually erroring
    }
    // NOTE: No finally block - we control loading state explicitly
  }, [moduleId, initialTab, loadFeedbackForAnswers, checkFeedbackStatus]);

  // Scroll to specific question
  const scrollToQuestion = (questionId) => {
    const element = document.getElementById(`feedback-question-${questionId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Main effect to load module on mount
  useEffect(() => {
    // Check if student has valid access
    const accessData = sessionStorage.getItem('student_module_access');
    if (!accessData) {
      router.push('/join');
      return;
    }

    const access = JSON.parse(accessData);
    if (String(access.moduleId) !== String(moduleId)) {
      router.push('/join');
      return;
    }

    setModuleAccess(access);
    loadModuleContent(access);
  }, [moduleId, router, loadModuleContent]);

  // Check consent after module data is loaded
  useEffect(() => {
    if (moduleAccess && moduleData && !consentChecked) {
      // If module doesn't require consent, skip the check entirely
      if (moduleData.consent_required === false) {
        console.log('✅ Module does not require consent, skipping modal');
        setConsentChecked(true);
        return;
      }

      // If consent was already submitted in this session, skip the check
      if (moduleAccess.consentSubmitted) {
        console.log('✅ Consent already submitted in this session, skipping modal');
        setConsentChecked(true);
        return;
      }

      // Check localStorage first (fastest check)
      const consentKey = `consent_${moduleId}_${moduleAccess.studentId}`;
      const storedConsent = localStorage.getItem(consentKey);
      if (storedConsent === 'true') {
        console.log('✅ Consent found in localStorage, skipping modal');
        setConsentChecked(true);
        return;
      }

      // If not found locally, check with API to verify database state
      console.log('🔍 Checking consent status from API...');
      checkConsentStatus(moduleAccess);
    }
  }, [moduleAccess, moduleData, consentChecked, checkConsentStatus, moduleId]);

  // Store latest callback refs to avoid stale closures
  const checkFeedbackStatusRef = useRef(checkFeedbackStatus);
  const loadFeedbackForAnswersRef = useRef(loadFeedbackForAnswers);

  // Update refs when callbacks change
  useEffect(() => {
    checkFeedbackStatusRef.current = checkFeedbackStatus;
    loadFeedbackForAnswersRef.current = loadFeedbackForAnswers;
  }, [checkFeedbackStatus, loadFeedbackForAnswers]);

  // Effect to handle feedback updates — SSE first, polling fallback
  useEffect(() => {
    if (!isPolling || !moduleAccess || !submissionStatus) {
      console.log('⏸️ Feedback monitoring paused:', { isPolling, hasAccess: !!moduleAccess, hasStatus: !!submissionStatus });
      return;
    }

    const MAX_POLL_TIME = 6 * 60 * 1000; // Stop after 6 minutes total
    const currentAttempt = submissionStatus.current_attempt || 1;
    const attemptToWatch = currentAttempt - 1;
    let stopped = false;

    // ── SSE path ──
    if (useSSE) {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const sseUrl = `${API_BASE_URL}/api/ai-feedback/stream/${moduleId}?student_id=${encodeURIComponent(moduleAccess.studentId)}&attempt=${attemptToWatch}`;

      console.log(`📡 SSE connecting: ${sseUrl}`);
      const es = new EventSource(sseUrl);
      eventSourceRef.current = es;

      es.addEventListener('progress', async (e) => {
        if (stopped) return;
        try {
          const data = JSON.parse(e.data);
          console.log(`📡 SSE progress: ${data.ready}/${data.total} (${data.percentage}%)`);
          if (stopped) return;
          setFeedbackStatus(prev => ({ ...prev, ...data, feedback_ready: data.ready, total_questions: data.total, progress_percentage: data.percentage }));
          setPollCount(prev => prev + 1);
          // Reload feedback to show newly completed items
          await loadFeedbackForAnswersRef.current(moduleAccess);
        } catch (err) {
          if (!stopped) console.warn('SSE progress parse error:', err);
        }
      });

      es.addEventListener('complete', async (e) => {
        if (stopped) return;
        try {
          const data = JSON.parse(e.data);
          console.log(`🎉 SSE complete: ${data.ready}/${data.total}`);
          if (stopped) return;
          setFeedbackStatus(prev => ({ ...prev, all_complete: true, feedback_ready: data.ready, total_questions: data.total }));
          await loadFeedbackForAnswersRef.current(moduleAccess);
          if (stopped) return;
          setIsPolling(false);
          setPollCount(0);
        } catch (err) {
          if (!stopped) console.warn('SSE complete parse error:', err);
        }
        es.close();
        eventSourceRef.current = null;
      });

      es.addEventListener('timeout', (e) => {
        console.log('⏱️ SSE timeout — server closed stream');
        es.close();
        eventSourceRef.current = null;
        setIsPolling(false);
      });

      es.onerror = (err) => {
        if (stopped) return;
        console.warn('⚠️ SSE error — falling back to polling', err);
        es.close();
        eventSourceRef.current = null;
        // Fall back to polling
        setUseSSE(false);
        // isPolling stays true, so the effect re-runs with useSSE=false
      };

      return () => {
        console.log('🛑 Closing SSE connection');
        stopped = true;
        es.close();
        eventSourceRef.current = null;
        setPollCount(0);
      };
    }

    // ── Polling fallback ──
    console.log(`🚀 POLLING STARTED (fallback) — attempt ${attemptToWatch}, module ${moduleId}`);

    let pollCount = 0;
    let pollStart = Date.now();
    let timeoutId = null;

    const getDelay = () => {
      const elapsed = Date.now() - pollStart;
      if (elapsed < 30000) return 2000;
      if (elapsed < 150000) return 5000;
      return 10000;
    };

    const doPoll = async () => {
      if (stopped) return;
      pollCount++;
      const elapsed = Date.now() - pollStart;

      setPollCount(pollCount);

      if (elapsed >= MAX_POLL_TIME) {
        console.log('⏱️ Polling timeout — stopping after 6 minutes');
        setIsPolling(false);
        try {
          await apiClient.post(
            `/api/student/modules/${moduleId}/cleanup-feedback?student_id=${moduleAccess.studentId}`
          );
          await loadFeedbackForAnswersRef.current(moduleAccess);
        } catch (error) {
          console.error('Failed to cleanup stale feedback:', error);
        }
        return;
      }

      try {
        const allComplete = await checkFeedbackStatusRef.current(moduleAccess, attemptToWatch);

        if (allComplete) {
          console.log('🎉 ALL FEEDBACK COMPLETE!');
          setIsPolling(false);
          setPollCount(0);
          return;
        }
      } catch (error) {
        console.log(`⚠️ Poll #${pollCount} failed (will retry):`, error.message);
      }

      const delay = getDelay();
      console.log(`⏳ Poll #${pollCount} done — next in ${delay / 1000}s`);
      timeoutId = setTimeout(doPoll, delay);
    };

    doPoll();

    return () => {
      console.log('🛑 STOPPING POLLING');
      stopped = true;
      if (timeoutId) clearTimeout(timeoutId);
      setPollCount(0);
    };
  }, [isPolling, moduleAccess, submissionStatus, moduleId, useSSE]); // useSSE added to re-run on fallback

  const handleStartTest = () => {
    router.push(`/student/test/${moduleId}`);
  };

  const handleManualCleanup = async () => {
    if (!moduleAccess) return;

    setCleaningUp(true);
    try {
      console.log('🧹 Manual cleanup triggered...');
      const response = await apiClient.post(
        `/api/student/modules/${moduleId}/cleanup-feedback?student_id=${moduleAccess.studentId}`
      );

      const result = response?.data || response || {};
      console.log('✅ Cleanup completed:', result);
      console.log(`   - Marked ${result.marked_failed || 0} as failed`);
      console.log(`   - Created ${result.created_placeholders || 0} placeholder rows`);
      console.log(`   - Total fixed: ${result.total_fixed || 0}`);

      // Reload feedback to show retry buttons
      await loadFeedbackForAnswers(moduleAccess);

      // Stop polling/SSE if active
      setIsPolling(false);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      // Show alert with results
      if (result.total_fixed > 0) {
        alert(`Found ${result.total_fixed} feedback generation failures. Use "Regenerate All" button to retry them all at once.`);
      } else {
        alert('No failed feedback found. All feedback is either completed or still generating.');
      }
    } catch (error) {
      console.error('Failed to cleanup feedback:', error);
      alert('Failed to cleanup feedback. Please check the browser console for details.');
    } finally {
      setCleaningUp(false);
    }
  };

  const handleRegenerateAll = async () => {
    if (!moduleAccess || !submissionStatus) return;

    setRegeneratingAll(true);
    try {
      const currentAttempt = selectedAttempt || 1;
      console.log(`🔄 Regenerating all failed feedback for attempt ${currentAttempt}...`);

      const response = await apiClient.post(
        `/api/ai-feedback/retry/module/${moduleId}?student_id=${moduleAccess.studentId}&attempt=${currentAttempt}`
      );

      const result = response?.data || response || {};
      console.log('✅ Regenerate all initiated:', result);
      console.log(`   - Total answers: ${result.total_answers || 0}`);
      console.log(`   - Failed/missing feedback: ${result.answers_retried || 0}`);
      console.log(`   - Message: ${result.message || 'N/A'}`);

      if (result.success && result.answers_retried > 0) {
        alert(`${result.message || `Started regenerating ${result.answers_retried} failed/missing feedback. This may take a few minutes. The page will update automatically.`}`);

        // Reset SSE and start monitoring again
        setUseSSE(true); // Try SSE first for the new batch
        setIsPolling(true);
        setPollCount(0);
      } else if (result.success && result.answers_retried === 0) {
        alert(result.message || 'No failed feedback found to retry. All feedback is either completed or still generating.');
      } else {
        alert('No feedback needed to be retried.');
      }
    } catch (error) {
      console.error('Failed to regenerate all feedback:', error);
      const errorMsg = error.response?.data?.detail || error.message || 'Unknown error';
      alert(`Failed to regenerate feedback: ${errorMsg}. Please try again or contact support.`);
    } finally {
      setRegeneratingAll(false);
    }
  };

  const handleViewDocument = (doc) => {
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const url = `${API_BASE_URL}/api/documents/${doc.id}/download`;

    // Simply open in new tab - works for PDFs and most file types
    window.open(url, '_blank');
  };

  const handleDownloadDocument = (doc) => {
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const url = `${API_BASE_URL}/api/documents/${doc.id}/download`;

    // Create invisible link and trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.file_name;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Don't render anything on server to prevent fetch errors during SSR
  if (!isClient) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header Skeleton */}
        <div className="bg-white dark:bg-gray-800 border-b shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-white animate-pulse" />
                </div>
                <div className="space-y-2 min-w-0">
                  <Skeleton className="h-7 w-64" />
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-28" />
                <Skeleton className="h-10 w-28" />
              </div>
            </div>
          </div>
        </div>

        {/* Content Skeleton */}
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Tabs Skeleton */}
          <div className="mb-6">
            <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-24 rounded-lg" />
              ))}
            </div>
          </div>

          {/* Question Cards Skeleton */}
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4 flex-1">
                    <Skeleton className="w-12 h-12 rounded-lg" />
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-6 w-24 rounded-full" />
                        <Skeleton className="h-6 w-20 rounded-full" />
                      </div>
                      <Skeleton className="h-5 w-full" />
                      <Skeleton className="h-5 w-4/5" />
                    </div>
                  </div>
                  <Skeleton className="h-10 w-32 rounded-lg" />
                </div>

                {/* Options Skeleton */}
                <div className="space-y-2 mt-4">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <Skeleton key={j} className="h-12 w-full rounded-lg" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <ErrorAlert
              error={error}
              onRetry={() => {
                setError(null);
                setLoading(true);
                window.location.reload();
              }}
              className="mb-4"
            />
            <div className="text-center mt-4">
              <Button
                onClick={() => router.push('/join')}
                variant="outline"
                className="w-full"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Enter Access Code Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
      {/* Professional Header with Gradient */}
      <div className="relative bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950 border-b-2 border-blue-600/20 shadow-xl">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjAzIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-40"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 relative">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg ring-2 ring-white/20">
                <BookOpen className="w-7 h-7 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white truncate mb-1.5 tracking-tight">
                  {moduleAccess?.moduleName || 'Module'}
                </h1>
                <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 gap-1.5 text-sm text-blue-100">
                  <span className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center">
                      <User className="w-3 h-3 flex-shrink-0" />
                    </div>
                    <span className="truncate font-medium">{moduleData?.teacher_name || moduleAccess?.teacherName || 'Instructor'}</span>
                  </span>
                  <span className="hidden sm:block text-blue-300">•</span>
                  <span className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center">
                      <Calendar className="w-3 h-3 flex-shrink-0" />
                    </div>
                    <span className="whitespace-nowrap font-medium">Accessed {new Date(moduleAccess?.accessTime || '').toLocaleDateString()}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
              {moduleAccess?.studentId && (
                <Badge className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-bold font-mono text-sm px-4 py-2 shadow-lg border-0 whitespace-nowrap ring-2 ring-white/20">
                  ID: {maskStudentId(moduleAccess.studentId)}
                </Badge>
              )}
              <Badge className="bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold whitespace-nowrap px-3 py-2 shadow-lg border-0 ring-2 ring-white/20">
                <div className="w-1.5 h-1.5 rounded-full bg-white mr-2 animate-pulse"></div>
                Active
              </Badge>
              <Button
                variant="outline"
                onClick={() => {
                  sessionStorage.removeItem('student_module_access');
                  router.push('/join');
                }}
                className="whitespace-nowrap bg-white/10 hover:bg-white/20 text-white border-white/30 hover:border-white/50 backdrop-blur-sm font-medium shadow-lg"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Exit Module
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main id="main-content" className="max-w-7xl mx-auto px-4 py-8">
        {/* Teacher Graded Notification Banner */}
        {hasTeacherGrades && activeTab !== 'feedback' && (
          <Card className="mb-6 relative overflow-hidden border-2 border-emerald-300 dark:border-emerald-700 shadow-xl">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950/30 dark:via-teal-950/30 dark:to-cyan-950/30"></div>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500"></div>
            <CardContent className="p-5 sm:p-7 relative">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center flex-shrink-0 shadow-lg ring-2 ring-emerald-600/20">
                    <User className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg sm:text-xl font-bold text-emerald-900 dark:text-emerald-100 mb-2 flex items-center gap-2">
                      Your Teacher Graded Your Work!
                      <span className="text-2xl">🎓</span>
                    </h2>
                    <p className="text-sm sm:text-base text-emerald-800 dark:text-emerald-200 leading-relaxed">
                      Your teacher has reviewed and graded your submission. Click below to see your final grade and personalized feedback.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => setActiveTab('feedback')}
                  size="lg"
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold shadow-lg flex-shrink-0 w-full sm:w-auto ring-2 ring-emerald-600/20"
                >
                  <Eye className="w-5 h-5 mr-2" />
                  View Grade
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* Professional Tabs with Glassmorphism */}
          <div className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg mb-6 p-1.5">
            <TabsList className="w-full flex md:grid md:grid-cols-6 overflow-x-auto scrollbar-hide bg-transparent gap-1">
              <TabsTrigger
                value="assignments"
                className="flex items-center gap-2 whitespace-nowrap flex-shrink-0 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all px-4 py-2.5 rounded-lg font-medium"
              >
                <HelpCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Test</span>
              </TabsTrigger>
              <TabsTrigger
                value="feedback"
                className="flex items-center gap-2 whitespace-nowrap flex-shrink-0 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-pink-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all px-4 py-2.5 rounded-lg font-medium"
              >
                <Brain className="w-4 h-4" />
                <span className="hidden sm:inline">Feedback</span>
                {Object.keys(feedbackData).length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs bg-white/20 text-inherit border-0">
                    {Object.keys(feedbackData).length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="chat"
                className="flex items-center gap-2 whitespace-nowrap flex-shrink-0 data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-teal-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all px-4 py-2.5 rounded-lg font-medium"
              >
                <MessageSquare className="w-4 h-4" />
                <span className="hidden sm:inline">Chat</span>
              </TabsTrigger>
              <TabsTrigger
                value="materials"
                className="flex items-center gap-2 whitespace-nowrap flex-shrink-0 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-600 data-[state=active]:to-orange-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all px-4 py-2.5 rounded-lg font-medium"
              >
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">Materials</span>
              </TabsTrigger>
              <TabsTrigger
                value="progress"
                className="flex items-center gap-2 whitespace-nowrap flex-shrink-0 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-600 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all px-4 py-2.5 rounded-lg font-medium"
              >
                <CheckCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Progress</span>
              </TabsTrigger>
              <TabsTrigger
                value="survey"
                className="flex items-center gap-2 whitespace-nowrap flex-shrink-0 data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all px-4 py-2.5 rounded-lg font-medium"
              >
                <ClipboardList className="w-4 h-4" />
                <span className="hidden sm:inline">Survey</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Test Tab */}
          <TabsContent value="assignments" className="space-y-6">
            {questions.length > 0 ? (
              <>
                {/* Survey Completion Prompt - Show if student hasn't submitted survey */}
                {!surveySubmitted && (submissionStatus?.submission_count > 0) && (
                  <Card className="relative overflow-hidden border-2 border-blue-300 dark:border-blue-700 shadow-lg">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-purple-950/30"></div>
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
                    <CardContent className="p-5 sm:p-6 relative">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="w-13 h-13 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg ring-2 ring-blue-600/20">
                          <ClipboardList className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex flex-wrap items-center gap-2 mb-1.5">
                            Share Your Feedback
                            {surveyRequired && (
                              <Badge variant="destructive" className="text-xs font-semibold">Required</Badge>
                            )}
                          </h2>
                          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                            Help us improve! Take a moment to complete the feedback survey about your learning experience.
                          </p>
                        </div>
                        <Button
                          onClick={() => setActiveTab('survey')}
                          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold flex-shrink-0 w-full sm:w-auto shadow-lg ring-2 ring-blue-600/20"
                        >
                          <ClipboardList className="w-4 h-4 mr-2" />
                          Complete Survey
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* If test is completed, show appropriate banner */}
                {(() => {
                  const hasFeedback = Object.keys(feedbackData).length > 0;
                  const allAttemptsDone = submissionStatus?.all_attempts_done || false;

                  if (!hasFeedback) return null;

                  // If all attempts are done (attempt 2 completed)
                  if (allAttemptsDone) {
                    return (
                      <Card className="relative overflow-hidden border-2 border-purple-300 dark:border-purple-700 shadow-lg">
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-50 via-fuchsia-50 to-pink-50 dark:from-purple-950/30 dark:via-fuchsia-950/30 dark:to-pink-950/30"></div>
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500"></div>
                        <CardContent className="p-6 relative">
                          <div className="flex items-start gap-4">
                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-600 to-fuchsia-600 flex items-center justify-center shadow-lg ring-2 ring-purple-600/20 flex-shrink-0">
                              <CheckCircle className="w-7 h-7 text-white" />
                            </div>
                            <div className="flex-1">
                              <h2 className="text-xl font-bold text-purple-900 dark:text-purple-100 mb-2">All Attempts Complete!</h2>
                              <p className="text-sm text-purple-800 dark:text-purple-200 leading-relaxed">
                                You have successfully completed all your attempts. You can review and learn from the feedback in the Feedback tab.
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  }

                  // Otherwise show first attempt completion banner
                  return (
                    <Card className="relative overflow-hidden border-2 border-green-300 dark:border-green-700 shadow-lg">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-50 via-emerald-50 to-teal-50 dark:from-green-950/30 dark:via-emerald-950/30 dark:to-teal-950/30"></div>
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500"></div>
                      <CardContent className="p-6 relative">
                        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                          <div className="flex items-start gap-4 flex-1">
                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-600 to-emerald-600 flex items-center justify-center shadow-lg ring-2 ring-green-600/20 flex-shrink-0">
                              <CheckCircle className="w-7 h-7 text-white" />
                            </div>
                            <div className="flex-1">
                              <h2 className="text-xl font-bold text-green-900 dark:text-green-100 mb-2">Test Submitted!</h2>
                              <p className="text-sm text-green-800 dark:text-green-200 leading-relaxed">
                                Your AI feedback is ready. Review it and see if you want to improve your score.
                              </p>
                            </div>
                          </div>
                          <Button
                            onClick={() => setActiveTab('feedback')}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-lg ring-2 ring-blue-600/20 flex-shrink-0 w-full sm:w-auto"
                            size="lg"
                          >
                            <Brain className="w-5 h-5 mr-2" />
                            View Feedback
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}

                <Card className="hover:shadow-xl transition-all duration-300 border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600"></div>
                  <CardHeader className="relative">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg ring-2 ring-blue-600/20 flex-shrink-0">
                          <HelpCircle className="w-7 h-7 text-white" />
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-xl lg:text-2xl mb-2 font-bold text-slate-900 dark:text-white">
                            {moduleAccess?.moduleName} Test
                          </CardTitle>
                          <CardDescription className="text-base">
                            {questions.length} question{questions.length > 1 ? 's' : ''} • Mixed question types
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex flex-col items-start lg:items-end gap-2.5">
                        <Badge variant="outline" className="font-semibold text-sm border-2 border-slate-300 dark:border-slate-600 px-3 py-1.5">
                          {submissionStatus?.submission_count || 0} / {submissionStatus?.max_attempts || 2} attempts used
                        </Badge>
                        <div className="w-full lg:w-32">
                          <div className="bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-blue-600 to-indigo-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                              style={{
                                width: `${submissionStatus ? ((submissionStatus.submission_count || 0) / (submissionStatus.max_attempts || 2)) * 100 : 0}%`
                              }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                        {questionTypeCounts.map(item => (
                          <div key={item.type} className="flex items-center gap-2">
                            <div className={`w-2 h-2 ${item.color} rounded-full`}></div>
                            <span>{item.count} {item.label}</span>
                          </div>
                        ))}
                      </div>

                      {moduleData?.instructions && (
                        <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                          <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Instructions</h4>
                          <p className="text-sm text-blue-700 dark:text-blue-300">{moduleData.instructions}</p>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-4">
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {(() => {
                            const hasFeedback = Object.keys(feedbackData).length > 0;
                            const allAttemptsDone = submissionStatus?.all_attempts_done || false;
                            const currentAttempt = submissionStatus?.current_attempt || 1;

                            if (allAttemptsDone) {
                              return "All attempts completed. Review your feedback to learn and improve.";
                            } else if (currentAttempt > 1) {
                              // If current attempt is 2+, Attempt 1 is complete
                              return `Attempt ${currentAttempt - 1} complete! Review feedback and start Attempt ${currentAttempt}.`;
                            } else {
                              return "Ready to start the test.";
                            }
                          })()}
                        </div>
                        {(() => {
                          const allAttemptsDone = submissionStatus?.all_attempts_done || false;

                          // Don't show button if all attempts are done
                          if (allAttemptsDone) {
                            return null;
                          }

                          // Don't show button if feedback is being generated
                          if (isPolling) {
                            return (
                              <div className="flex items-center gap-2 text-sm text-blue-600">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                <span>Feedback is being generated...</span>
                              </div>
                            );
                          }

                          return (
                            <Button
                              onClick={() => handleStartTest()}
                              className={(() => {
                                const currentAttempt = submissionStatus?.current_attempt || 1;

                                return currentAttempt > 1
                                  ? "bg-orange-600 hover:bg-orange-700"
                                  : "bg-blue-600 hover:bg-blue-700";
                              })()}
                              size="lg"
                            >
                              {(() => {
                                const currentAttempt = submissionStatus?.current_attempt || 1;

                                if (currentAttempt > 1) {
                                  // If current attempt is 2+, button should start that attempt
                                  return (
                                    <>
                                      <Target className="w-4 h-4 mr-2" />
                                      Start Attempt {currentAttempt}
                                    </>
                                  );
                                } else {
                                  return (
                                    <>
                                      <Play className="w-4 h-4 mr-2" />
                                      Start Test
                                    </>
                                  );
                                }
                              })()}
                            </Button>
                          );
                        })()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="text-center py-12">
                <CardContent>
                  <HelpCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No Test Available
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Your instructor has not posted the test yet. Check back later!
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Feedback Tab */}
          <TabsContent value="feedback" className="space-y-6">
            {/* Show beautiful loading banner when actively generating feedback */}
            {isPolling && feedbackStatus && (
              <FeedbackGeneratingBanner
                feedbackStatus={feedbackStatus}
                pollCount={pollCount}
              />
            )}

            {isPolling && Object.keys(feedbackData).length === 0 ? (
              <Card>
                <CardContent>
                  <AllQuestionsLoader totalQuestions={feedbackStatus?.total_questions || 10} />
                </CardContent>
              </Card>
            ) : Object.keys(feedbackData).length > 0 ? (
              <>
                {/* Attempt Selector - Only show attempts that have AI feedback OR teacher grades */}
                {visibleAttempts.length > 1 && (
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">View Attempt:</span>
                      <div className="flex gap-2">
                        {visibleAttempts.map(attemptNum => (
                          <Button
                            key={attemptNum}
                            onClick={() => setSelectedAttempt(Number(attemptNum))}
                            variant={selectedAttempt === Number(attemptNum) ? "default" : "outline"}
                            size="sm"
                            className={selectedAttempt === Number(attemptNum) ? "bg-blue-600 hover:bg-blue-700" : ""}
                          >
                            Attempt {attemptNum}
                          </Button>
                        ))}
                      </div>
                    </div>
                )}

                {/* Teacher Grades Available Banner */}
                {(() => {
                  // Check if there are teacher grades in ANY attempt
                  const allFeedback = Object.values(feedbackByAttempt).flatMap(attempt => Object.values(attempt));
                  const hasTeacherGrades = allFeedback.some(f => f.teacher_grade);

                  // Find which attempt has teacher grades
                  let attemptWithGrades = null;
                  for (const [attemptNum, attemptFeedback] of Object.entries(feedbackByAttempt)) {
                    if (Object.values(attemptFeedback).some(f => f.teacher_grade)) {
                      attemptWithGrades = Number(attemptNum);
                      break;
                    }
                  }

                  // Show banner if teacher grades exist but student is viewing a different attempt
                  if (hasTeacherGrades && attemptWithGrades && selectedAttempt !== attemptWithGrades) {
                    return (
                      <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border-2 border-emerald-300 dark:border-emerald-700 mb-4">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <User className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                            <div className="flex-1">
                              <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                                Your teacher has graded Attempt {attemptWithGrades}!
                              </p>
                              <p className="text-sm text-emerald-700 dark:text-emerald-300">
                                Switch to Attempt {attemptWithGrades} to see your final grade and teacher&apos;s feedback.
                              </p>
                            </div>
                            <Button
                              onClick={() => setSelectedAttempt(attemptWithGrades)}
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              View Attempt {attemptWithGrades}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  }
                  return null;
                })()}

                {/* Check if this is final attempt and has no teacher grade - show waiting message */}
                {(() => {
                  const maxAttempts = submissionStatus?.max_attempts || 2;
                  const isFinalAttempt = selectedAttempt >= maxAttempts;
                  const hasTeacherGradeInThisAttempt = Object.values(feedbackData).some(f => f.teacher_grade);

                  if (isFinalAttempt && !hasTeacherGradeInThisAttempt) {
                    return (
                      <Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border-2 border-purple-300 dark:border-purple-700">
                        <CardContent className="p-8 text-center">
                          <div className="flex flex-col items-center gap-4">
                            <div className="w-20 h-20 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                              <User className="w-10 h-10 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                              <h3 className="text-2xl font-bold text-purple-900 dark:text-purple-100 mb-2">
                                Final Attempt - Teacher Grading Only
                              </h3>
                              <p className="text-purple-700 dark:text-purple-300 mb-1">
                                This is your final attempt and is reserved for manual grading by your teacher. AI feedback is only available for attempts 1-{maxAttempts - 1}.
                              </p>
                              <p className="text-sm text-purple-600 dark:text-purple-400 mt-4">
                                Your teacher will manually grade this attempt. Check back later for feedback.
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  }
                  return null;
                })()}

                {/* Summary Card - Only show if NOT final attempt OR has teacher grade */}
                {(() => {
                  const maxAttempts = submissionStatus?.max_attempts || 2;
                  const isFinalAttempt = selectedAttempt >= maxAttempts;
                  const hasTeacherGradeInThisAttempt = Object.values(feedbackData).some(f => f.teacher_grade);

                  // Don't show feedback if it's final attempt with no teacher grade
                  if (isFinalAttempt && !hasTeacherGradeInThisAttempt) {
                    return null;
                  }

                  return (
                    <Card className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center">
                              <Brain className="w-8 h-8 text-white" />
                            </div>
                            <div>
                              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                                Feedback for Attempt {selectedAttempt}
                              </h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {`${feedbackStats.correctCount} out of ${feedbackStats.total} correct`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-4xl font-bold text-blue-600">
                          {feedbackStats.percentage}%
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Progress on Attempt {selectedAttempt}</p>
                      </div>
                    </div>

                    {/* Show message for final attempt (teacher grading only, no AI feedback) */}
                    {selectedAttempt >= (submissionStatus?.max_attempts || 2) && (
                      <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                        <div className="flex items-start gap-3">
                          <User className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
                              Final Attempt - Teacher Grading Only
                            </p>
                            <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                              This is your final attempt and is reserved for manual grading by your teacher. AI feedback is only available for attempts 1-{(submissionStatus?.max_attempts || 2) - 1}.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Show regenerate all button if there are failed feedback */}
                    {(() => {
                      // Only count TRULY failed feedback (must have explicit failed/timeout status)
                      const failedCount = Object.values(feedbackData).filter(f => {
                        return f && f.generation_status && (f.generation_status === 'failed' || f.generation_status === 'timeout');
                      }).length;

                      // Get max attempts to check if this attempt should have AI feedback
                      const maxAttempts = submissionStatus?.max_attempts || 2;

                      // IMPORTANT: Only show regenerate button when:
                      // 1. There are actually failed feedbacks (not pending/generating)
                      // 2. This is not the final attempt (final attempt is for teacher grading)
                      // 3. NOT currently polling (if polling, feedback is still being generated)
                      if (failedCount === 0 || selectedAttempt >= maxAttempts || isPolling) return null;

                      return (
                        <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-red-900 dark:text-red-100">
                                {failedCount} feedback generation{failedCount > 1 ? 's' : ''} failed
                              </p>
                              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                                Some feedback failed to generate. Use this button to retry all failed items at once
                              </p>
                            </div>
                            <Button
                              onClick={handleRegenerateAll}
                              disabled={regeneratingAll}
                              size="sm"
                              variant="destructive"
                            >
                              {regeneratingAll ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b border-white mr-2"></div>
                                  Regenerating...
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="mr-2 h-4 w-4" />
                                  Regenerate All ({failedCount})
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Show retry button if there are incorrect answers and not all attempts done */}
                    {(() => {
                      // Check for incorrect answers, prioritizing teacher grades
                      const hasIncorrect = Object.values(feedbackData).some(f => {
                        // If teacher graded, it's incorrect if didn't get full points
                        if (f.teacher_grade) {
                          return f.teacher_grade.points_awarded < f.points_possible;
                        }
                        // Otherwise use AI's is_correct
                        return !f.is_correct;
                      });
                      const allAttemptsDone = submissionStatus?.all_attempts_done || false;
                      const currentAttempt = submissionStatus?.current_attempt || 1;
                      const maxAttempts = submissionStatus?.max_attempts || 2;
                      const attemptKeys = Object.keys(feedbackByAttempt).map(Number);
                      const latestAttemptWithFeedback = attemptKeys.length > 0 ? Math.max(...attemptKeys) : 0;

                      // Only show button if:
                      // 1. There are incorrect answers
                      // 2. Not all attempts are done
                      // 3. User is viewing the most recent attempt's feedback
                      if (!hasIncorrect || allAttemptsDone || selectedAttempt !== latestAttemptWithFeedback) {
                        return null;
                      }

                      const nextAttemptNumber = currentAttempt;

                      return (
                        <div className="mt-6 pt-6 border-t border-blue-300 dark:border-blue-700">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white text-lg">
                                Ready for attempt {nextAttemptNumber}?
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {isPolling
                                  ? "Please wait for feedback generation to complete before starting the next attempt"
                                  : "Review the feedback below, then start fresh with empty answers to improve your score"
                                }
                              </p>
                            </div>
                            <Button
                              onClick={() => router.push(`/student/test/${moduleId}`)}
                              disabled={isPolling}
                              className="bg-orange-600 hover:bg-orange-700 text-white px-6 disabled:opacity-50 disabled:cursor-not-allowed"
                              size="lg"
                            >
                              {isPolling ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                  Generating feedback...
                                </>
                              ) : (
                                <>
                                  <Target className="w-4 h-4 mr-2" />
                                  Start Attempt {nextAttemptNumber}
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Perfect score celebration */}
                    {(() => {
                      // Check if all answers got full points
                      const allCorrect = Object.values(feedbackData).every(f => {
                        // If teacher graded, check if got full points
                        if (f.teacher_grade) {
                          return f.teacher_grade.points_awarded >= f.points_possible;
                        }
                        // Otherwise use AI's is_correct
                        return f.is_correct;
                      });

                      if (!allCorrect) return null;

                      return (
                        <div className="mt-6 pt-6 border-t border-blue-300 dark:border-blue-700">
                          <div className="text-center">
                            <div className="text-6xl mb-2">🎉</div>
                            <p className="text-xl font-bold text-gray-900 dark:text-white">Perfect!</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Great job! You got all questions correct on attempt {selectedAttempt}.
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              );
            })()}

                {/* Individual Question Feedback with Navigation - Only show if NOT final attempt OR has teacher grade */}
                {(() => {
                  const maxAttempts = submissionStatus?.max_attempts || 2;
                  const isFinalAttempt = selectedAttempt >= maxAttempts;
                  const hasTeacherGradeInThisAttempt = Object.values(feedbackData).some(f => f.teacher_grade);

                  // Don't show question feedback if it's final attempt with no teacher grade
                  if (isFinalAttempt && !hasTeacherGradeInThisAttempt) {
                    return null;
                  }

                  return (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                  {/* Question Navigation Sidebar */}
                  <div className="lg:col-span-1">
                    <Card className="sticky top-6">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Questions</CardTitle>
                      </CardHeader>
                      <CardContent className="p-3">
                        <div className="grid grid-cols-5 lg:grid-cols-3 gap-2">
                          {questions.map((q, index) => {
                            const feedback = feedbackData[q.id];
                            const isAnswered = answeredQuestions[q.id];
                            const hasTeacherGradesInAttempt = Object.values(feedbackData).some(f => f.teacher_grade);

                            return (
                              <button
                                key={q.id}
                                onClick={() => scrollToQuestion(q.id)}
                                className={`
                                  w-12 h-12 rounded-lg text-sm font-bold border-2 transition-colors relative flex items-center justify-center
                                  ${!isAnswered
                                    ? 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                                    : feedback
                                    ? feedback.teacher_grade
                                      ? feedback.teacher_grade.points_awarded >= feedback.points_possible
                                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30'
                                        : 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/30'
                                      : feedback.is_correct
                                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/30'
                                      : 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/30'
                                    : hasTeacherGradesInAttempt
                                    ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                    : isPolling
                                    ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                    : 'border-yellow-400 dark:border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400'
                                  }
                                `}
                              >
                                {!isAnswered ? (
                                  <span className="text-base font-bold">{index + 1}</span>
                                ) : feedback ? (
                                  <div className="relative w-full h-full flex items-center justify-center">
                                    <span className="absolute text-xs font-bold">{index + 1}</span>
                                    {feedback.teacher_grade ? (
                                      feedback.teacher_grade.points_awarded >= feedback.points_possible ? (
                                        <CheckCircle className="w-4 h-4 opacity-60" />
                                      ) : (
                                        <XCircle className="w-4 h-4 opacity-60" />
                                      )
                                    ) : feedback.is_correct ? (
                                      <CheckCircle className="w-4 h-4 opacity-60" />
                                    ) : (
                                      <XCircle className="w-4 h-4 opacity-60" />
                                    )}
                                  </div>
                                ) : hasTeacherGradesInAttempt ? (
                                  <div className="relative w-full h-full flex items-center justify-center">
                                    <span className="text-base font-bold">{index + 1}</span>
                                    <User className="w-3 h-3 absolute bottom-0.5 right-0.5 opacity-60" />
                                  </div>
                                ) : isPolling ? (
                                  <div className="flex items-center justify-center">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 dark:border-blue-400"></div>
                                  </div>
                                ) : (
                                  <span className="text-base font-bold">{index + 1}</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* All Questions Feedback (Scrollable) */}
                  <div className="lg:col-span-4 space-y-6">
                    {questions.map((question, index) => {
                      const feedback = feedbackData[question.id];
                      const isAnswered = answeredQuestions[question.id];

                      return (
                        <Card
                          key={question.id}
                          id={`feedback-question-${question.id}`}
                          className="hover:shadow-lg transition-shadow scroll-mt-6"
                        >
                          <CardHeader className="pb-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  {(() => {
                                    // Check if any question in this attempt has teacher grades
                                    const hasTeacherGradesInAttempt = Object.values(feedbackData).some(f => f.teacher_grade);

                                    if (!isAnswered) {
                                      return (
                                        <Badge variant="secondary" className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                          Not Answered
                                        </Badge>
                                      );
                                    }

                                    if (!feedback) {
                                      // IMPORTANT: For final attempt (teacher grading only), always show waiting badge
                                      const maxAttempts = submissionStatus?.max_attempts || 2;
                                      if (selectedAttempt >= maxAttempts) {
                                        return (
                                          <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                            <User className="w-3 h-3 mr-1" />
                                            Awaiting Teacher Grading
                                          </Badge>
                                        );
                                      }

                                      // If there are teacher grades in this attempt, show waiting badge
                                      if (hasTeacherGradesInAttempt) {
                                        return (
                                          <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                            <User className="w-3 h-3 mr-1" />
                                            Awaiting Teacher Grading
                                          </Badge>
                                        );
                                      }

                                      // Otherwise show AI generation status (only for non-final attempts)
                                      if (isPolling) {
                                        return (
                                          <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                            <div className="flex items-center gap-2">
                                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 dark:border-blue-400"></div>
                                              Generating feedback...
                                            </div>
                                          </Badge>
                                        );
                                      }

                                      return (
                                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                                          Loading feedback...
                                        </Badge>
                                      );
                                    }

                                    // Has feedback
                                    return null;
                                  })()}
                                  {feedback ? (
                                    <>
                                      {feedback.teacher_grade ? (
                                        // Show teacher graded badge
                                        <>
                                          <User className="w-5 h-5 text-emerald-600" />
                                          <Badge variant="default" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300">
                                            Teacher Graded
                                          </Badge>
                                        </>
                                      ) : feedback.is_correct !== null ? (
                                        // Show AI feedback badge
                                        <>
                                          {feedback.is_correct ? (
                                            <CheckCircle className="w-5 h-5 text-green-600" />
                                          ) : (
                                            <XCircle className="w-5 h-5 text-orange-600" />
                                          )}
                                          <Badge variant={feedback.is_correct ? "default" : "secondary"} className={
                                            feedback.is_correct
                                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                                              : "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300"
                                          }>
                                            Progress: {Math.round((feedback.correctness_score || feedback.score || 0) > 1 ? (feedback.correctness_score || feedback.score) : (feedback.correctness_score || feedback.score) * 100)}%
                                          </Badge>
                                        </>
                                      ) : null}
                                    </>
                                  ) : isAnswered ? (
                                    <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                      <div className="flex items-center gap-2">
                                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 dark:border-blue-400"></div>
                                        Loading feedback...
                                      </div>
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary" className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                      Not Answered
                                    </Badge>
                                  )}
                                  <Badge variant="outline">
                                    Question {index + 1} of {questions.length}
                                  </Badge>
                                </div>
                                <p className="text-base text-gray-900 dark:text-gray-100 leading-relaxed whitespace-pre-wrap">
                                  {question.text}
                                </p>
                                {question.image_url && (
                                  <div className="mt-3">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={question.image_url}
                                      alt={`Visual content for Question ${index + 1}: ${question.question_text?.substring(0, 100)}${question.question_text?.length > 100 ? '...' : ''}`}
                                      className="max-w-full h-auto rounded-lg border border-gray-200 dark:border-gray-700"
                                      loading="lazy"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {/* Show generation status indicator ONLY for truly failed states */}
                            {/* IMPORTANT: Only show if feedback EXISTS AND is explicitly failed/timeout */}
                            {/* Don't show if feedback doesn't exist - that's just pending, not failed */}
                            {feedback &&
                             feedback.generation_status &&
                             (feedback.generation_status === 'failed' || feedback.generation_status === 'timeout') &&
                             feedback.can_retry &&
                             selectedAttempt < (submissionStatus?.max_attempts || 2) && (
                              <FeedbackStatusIndicator
                                answerId={feedback.answer_id}
                                hasFeedback={false}
                                initialStatus={feedback.generation_status}
                                onFeedbackComplete={async () => {
                                  // Reload feedback when generation completes
                                  if (moduleAccess) {
                                    await loadFeedbackForAnswers(moduleAccess);
                                  }
                                }}
                              />
                            )}

                            {/* IMPORTANT: Show feedback as soon as it's ready, even if still polling for other questions */}
                            {/* Only show loader if feedback is genuinely not ready yet (pending/generating/missing) */}
                            {!isAnswered ? (
                              <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg text-center">
                                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                <p className="text-gray-600 dark:text-gray-400 font-medium">
                                  No answer provided for this question
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                                  You did not submit an answer for this question in your attempt.
                                </p>
                              </div>
                            ) : selectedAttempt >= (submissionStatus?.max_attempts || 2) && !feedback?.teacher_grade ? (
                              // Final attempt with no teacher grade yet - show waiting message
                              <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-6 text-center">
                                <User className="w-12 h-12 text-purple-600 dark:text-purple-400 mx-auto mb-3" />
                                <p className="text-purple-900 dark:text-purple-100 font-medium">
                                  Awaiting Teacher Grading
                                </p>
                                <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                                  Your teacher will manually grade this attempt. Check back later for feedback.
                                </p>
                              </div>
                            ) : feedback && (
                              feedback.generation_status === 'completed' ||
                              feedback.explanation ||
                              feedback.is_correct !== undefined ||
                              feedback.correctness_score !== undefined
                            ) ? (
                              <>
                                {/* Your Answer - MCQ */}
                                {question.type === 'mcq' && feedback.selected_option && (
                                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Your answer:</p>
                                    <p className="text-base font-medium text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                                      {feedback.selected_option}. {feedback.available_options?.[feedback.selected_option]}
                                    </p>
                                  </div>
                                )}

                                {/* Your Answer - MCQ Multiple */}
                                {question.type === 'mcq_multiple' && feedback.selected_options && (
                                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Your answers:</p>
                                    <div className="space-y-1">
                                      {feedback.selected_options.map((opt, idx) => (
                                        <p key={idx} className="text-base font-medium text-gray-900 dark:text-gray-100">
                                          {opt}. {feedback.available_options?.[opt]}
                                        </p>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Your Answer - Fill-in-the-Blank */}
                                {question.type === 'fill_blank' && feedback.grading_details?.blank_results && (
                                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Your answers:</p>
                                    <div className="space-y-2">
                                      {feedback.grading_details.blank_results.map((blank, idx) => (
                                        <div key={idx} className="flex items-start gap-2">
                                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Blank {blank.position + 1}:</span>
                                          <span className="text-base font-medium text-gray-900 dark:text-gray-100">{blank.student_answer || '(empty)'}</span>
                                          {blank.is_correct ? (
                                            <CheckCircle className="w-5 h-5 text-green-500" />
                                          ) : (
                                            <XCircle className="w-5 h-5 text-red-500" />
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Your Answer - Multi-Part */}
                                {question.type === 'multi_part' && feedback.sub_results && (
                                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Your answers:</p>
                                    <div className="space-y-2">
                                      {feedback.sub_results.map((sub, idx) => (
                                        <div key={idx} className="flex items-start gap-2">
                                          <span className="text-sm font-medium text-purple-600 dark:text-purple-400">{sub.sub_id}:</span>
                                          <span className="text-base font-medium text-gray-900 dark:text-gray-100 flex-1">
                                            {typeof sub.student_answer === 'string' ? sub.student_answer : JSON.stringify(sub.student_answer)}
                                          </span>
                                          {sub.is_correct !== null && (
                                            sub.is_correct ? (
                                              <CheckCircle className="w-5 h-5 text-green-500" />
                                            ) : (
                                              <XCircle className="w-5 h-5 text-red-500" />
                                            )
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Feedback */}
                                <div className="space-y-3">
                                  {/* No AI Feedback Message - Only show when teacher graded but no AI feedback */}
                                  {!feedback.correctness_score && feedback.teacher_grade && (
                                    <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                                      <p className="text-sm text-blue-800 dark:text-blue-200">
                                        <strong>Note:</strong> AI feedback was not generated for this question. Your teacher has manually graded your response below.
                                      </p>
                                    </div>
                                  )}

                                  {/* Score Section */}
                                  {feedback.correctness_score !== null && feedback.correctness_score !== undefined && (
                                    <div
                                      onClick={() => {
                                        if (feedback.criterion_scores && Object.keys(feedback.criterion_scores).length > 0) {
                                          setExpandedRubrics(prev => ({
                                            ...prev,
                                            [question.id]: !prev[question.id]
                                          }));
                                        }
                                      }}
                                      className={`p-4 rounded-lg border-2 transition-all ${
                                        feedback.criterion_scores && Object.keys(feedback.criterion_scores).length > 0
                                          ? 'cursor-pointer hover:shadow-md'
                                          : ''
                                      } ${
                                        feedback.correctness_score === 100
                                          ? 'bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-700'
                                          : feedback.correctness_score >= 70
                                          ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-700'
                                          : feedback.correctness_score >= 50
                                          ? 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-300 dark:border-yellow-700'
                                          : 'bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-700'
                                      }`}
                                    >
                                      <div className="flex items-start justify-between">
                                        <div>
                                          <p className={`text-sm font-medium mb-1 ${
                                            feedback.correctness_score === 100
                                              ? 'text-green-900 dark:text-green-100'
                                              : feedback.correctness_score >= 70
                                              ? 'text-blue-900 dark:text-blue-100'
                                              : feedback.correctness_score >= 50
                                              ? 'text-yellow-900 dark:text-yellow-100'
                                              : 'text-red-900 dark:text-red-100'
                                          }`}>
                                            Score
                                          </p>
                                          <div className="flex items-baseline gap-3">
                                            <p className={`text-3xl font-bold ${
                                              feedback.correctness_score === 100
                                                ? 'text-green-700 dark:text-green-300'
                                                : feedback.correctness_score >= 70
                                                ? 'text-blue-700 dark:text-blue-300'
                                                : feedback.correctness_score >= 50
                                                ? 'text-yellow-700 dark:text-yellow-300'
                                                : 'text-red-700 dark:text-red-300'
                                            }`}>
                                              {feedback.correctness_score}%
                                            </p>
                                            {feedback.points_earned !== null && feedback.points_earned !== undefined && feedback.points_possible && (
                                              <p className={`text-sm font-medium ${
                                                feedback.correctness_score === 100
                                                  ? 'text-green-600 dark:text-green-400'
                                                  : feedback.correctness_score >= 70
                                                  ? 'text-blue-600 dark:text-blue-400'
                                                  : feedback.correctness_score >= 50
                                                  ? 'text-yellow-600 dark:text-yellow-400'
                                                  : 'text-red-600 dark:text-red-400'
                                              }`}>
                                                ({feedback.points_earned} / {feedback.points_possible} points)
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                        {feedback.criterion_scores && Object.keys(feedback.criterion_scores).length > 0 && (
                                          <div className={`mt-1 ${
                                            feedback.correctness_score === 100
                                              ? 'text-green-700 dark:text-green-300'
                                              : feedback.correctness_score >= 70
                                              ? 'text-blue-700 dark:text-blue-300'
                                              : feedback.correctness_score >= 50
                                              ? 'text-yellow-700 dark:text-yellow-300'
                                              : 'text-red-700 dark:text-red-300'
                                          }`}>
                                            {expandedRubrics[question.id] ? (
                                              <ChevronUp className="w-5 h-5" />
                                            ) : (
                                              <ChevronDown className="w-5 h-5" />
                                            )}
                                          </div>
                                        )}
                                      </div>

                                      {/* Criterion Scores Breakdown - Collapsible */}
                                      {feedback.criterion_scores && Object.keys(feedback.criterion_scores).length > 0 && expandedRubrics[question.id] && (
                                        <div className="mt-4 pt-4 border-t border-current/20 space-y-3">
                                          {Object.entries(feedback.criterion_scores).map(([criterion, details]) => {
                                            const percentage = (details.score / details.out_of) * 100;
                                            return (
                                              <div key={criterion} className={`p-3 rounded-lg ${
                                                feedback.correctness_score === 100
                                                  ? 'bg-green-100/50 dark:bg-green-900/20'
                                                  : feedback.correctness_score >= 70
                                                  ? 'bg-blue-100/50 dark:bg-blue-900/20'
                                                  : feedback.correctness_score >= 50
                                                  ? 'bg-yellow-100/50 dark:bg-yellow-900/20'
                                                  : 'bg-red-100/50 dark:bg-red-900/20'
                                              }`}>
                                                <div className="flex items-start justify-between mb-2">
                                                  <span className={`text-sm font-semibold capitalize ${
                                                    feedback.correctness_score === 100
                                                      ? 'text-green-900 dark:text-green-100'
                                                      : feedback.correctness_score >= 70
                                                      ? 'text-blue-900 dark:text-blue-100'
                                                      : feedback.correctness_score >= 50
                                                      ? 'text-yellow-900 dark:text-yellow-100'
                                                      : 'text-red-900 dark:text-red-100'
                                                  }`}>
                                                    {criterion}
                                                  </span>
                                                  <span className={`text-sm font-bold ${
                                                    feedback.correctness_score === 100
                                                      ? 'text-green-700 dark:text-green-300'
                                                      : feedback.correctness_score >= 70
                                                      ? 'text-blue-700 dark:text-blue-300'
                                                      : feedback.correctness_score >= 50
                                                      ? 'text-yellow-700 dark:text-yellow-300'
                                                      : 'text-red-700 dark:text-red-300'
                                                  }`}>
                                                    {details.score}/{details.out_of} ({percentage.toFixed(0)}%)
                                                  </span>
                                                </div>
                                                {details.reasoning && (
                                                  <p className={`text-xs leading-relaxed ${
                                                    feedback.correctness_score === 100
                                                      ? 'text-green-800 dark:text-green-200'
                                                      : feedback.correctness_score >= 70
                                                      ? 'text-blue-800 dark:text-blue-200'
                                                      : feedback.correctness_score >= 50
                                                      ? 'text-yellow-800 dark:text-yellow-200'
                                                      : 'text-red-800 dark:text-red-200'
                                                  }`}>
                                                    {details.reasoning}
                                                  </p>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Explanation */}
                                  {feedback.explanation && (
                                    <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
                                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                                        Feedback
                                      </p>
                                      <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                                        {feedback.explanation}
                                      </p>
                                    </div>
                                  )}

                                  {/* Strengths (for text answers) */}
                                  {feedback.strengths && feedback.strengths.length > 0 && (
                                    <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg">
                                      <p className="text-sm font-medium text-green-900 dark:text-green-100 mb-2">
                                        What you did well
                                      </p>
                                      <ul className="space-y-1">
                                        {feedback.strengths.map((strength, idx) => (
                                          <li key={idx} className="text-sm text-green-800 dark:text-green-200 flex items-start gap-2">
                                            <span className="mt-1">•</span>
                                            <span>{strength}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {/* Weaknesses (for text answers) */}
                                  {feedback.weaknesses && feedback.weaknesses.length > 0 && (
                                    <div className="bg-orange-50 dark:bg-orange-950/20 p-4 rounded-lg">
                                      <p className="text-sm font-medium text-orange-900 dark:text-orange-100 mb-2">
                                        Areas to improve
                                      </p>
                                      <ul className="space-y-1">
                                        {feedback.weaknesses.map((weakness, idx) => (
                                          <li key={idx} className="text-sm text-orange-800 dark:text-orange-200 flex items-start gap-2">
                                            <span className="mt-1">•</span>
                                            <span>{weakness}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {/* Improvement Hint */}
                                  {feedback.improvement_hint && (
                                    <div className="bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded-lg">
                                      <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100 mb-1">
                                        Suggestion
                                      </p>
                                      <p className="text-sm text-yellow-800 dark:text-yellow-200 leading-relaxed">
                                        {feedback.improvement_hint}
                                      </p>
                                    </div>
                                  )}

                                  {/* Concept Explanation */}
                                  {feedback.concept_explanation && (
                                    <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded-lg">
                                      <p className="text-sm font-medium text-purple-900 dark:text-purple-100 mb-1">
                                        Key concept
                                      </p>
                                      <p className="text-sm text-purple-800 dark:text-purple-200 leading-relaxed">
                                        {feedback.concept_explanation}
                                      </p>
                                    </div>
                                  )}

                                  {/* Teacher Grade - Final Grade from Teacher */}
                                  {feedback.teacher_grade && (
                                    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 p-4 rounded-lg border-2 border-emerald-300 dark:border-emerald-700">
                                      <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0">
                                          <User className="w-5 h-5 text-white" />
                                        </div>
                                        <div className="flex-1">
                                          <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-2">
                                            Teacher&apos;s Final Grade
                                          </p>
                                          <div className="bg-white dark:bg-gray-900 p-3 rounded-md mb-2">
                                            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                                              {feedback.teacher_grade.points_awarded} / {feedback.points_possible} points
                                            </p>
                                          </div>
                                          {feedback.teacher_grade.feedback_text && (
                                            <div className="bg-white dark:bg-gray-900 p-3 rounded-md">
                                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                                                Teacher&apos;s Comments:
                                              </p>
                                              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                                                {feedback.teacher_grade.feedback_text}
                                              </p>
                                            </div>
                                          )}
                                          {feedback.teacher_grade.graded_at && (
                                            <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-2">
                                              Graded on {new Date(feedback.teacher_grade.graded_at).toLocaleDateString()}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Feedback Critique Component - Allow students to rate AI feedback */}
                                {feedback && feedback.id && !feedback.teacher_grade && moduleAccess?.studentId && question.allow_critique === true && (
                                  <FeedbackCritique
                                    feedbackId={feedback.id}
                                    studentId={moduleAccess.studentId}
                                    onSubmitSuccess={(critique) => {
                                      console.log('Feedback critique submitted:', critique);
                                    }}
                                  />
                                )}
                              </>
                            ) : (
                              // Check if feedback is truly not ready yet vs failed
                              (() => {
                                // If no feedback exists at all, show loader
                                if (!feedback) {
                                  return (
                                    <QuestionFeedbackLoader
                                      questionNumber={index + 1}
                                      isAnswered={isAnswered}
                                    />
                                  );
                                }

                                // If feedback exists but is pending/generating, show loader
                                if (feedback.generation_status === 'pending' || feedback.generation_status === 'generating') {
                                  return (
                                    <QuestionFeedbackLoader
                                      questionNumber={index + 1}
                                      isAnswered={isAnswered}
                                    />
                                  );
                                }

                                // If failed/timeout, FeedbackStatusIndicator shows above (return nothing)
                                if (feedback.generation_status === 'failed' || feedback.generation_status === 'timeout') {
                                  return null;
                                }

                                // Unknown state - show debug info
                                return (
                                  <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 text-center">
                                    <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
                                    <p className="text-yellow-900 dark:text-yellow-100 font-medium">
                                      Feedback exists but in unexpected state
                                    </p>
                                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                                      Status: {feedback.generation_status || 'not set'}<br />
                                      Has explanation: {feedback.explanation ? 'yes' : 'no'}<br />
                                      Please refresh the page.
                                    </p>
                                  </div>
                                );
                              })()
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
              </>
            ) : (
              <Card className="text-center py-12">
                <CardContent>
                  <Brain className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No Feedback Yet
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Complete the test to receive AI feedback on your answers.
                  </p>
                  <Button onClick={() => handleStartTest()} className="bg-blue-600 hover:bg-blue-700">
                    Start Test
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Chat Tab */}
          <TabsContent value="chat" className="space-y-6">
            {isChatbotEnabled ? (
              <ChatTab moduleId={moduleId} moduleAccess={moduleAccess} />
            ) : (
              <Card className="border-2 border-amber-200 bg-amber-50 dark:bg-amber-950/20">
                <CardContent className="pt-6">
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                      <MessageSquare className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-amber-900 dark:text-amber-100 mb-2">
                      AI Chatbot Not Available
                    </h3>
                    <p className="text-amber-700 dark:text-amber-300 mb-4">
                      Your instructor has not enabled the AI chatbot for this module.
                    </p>
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                      Please use the other tabs to access your assignments, feedback, and materials.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Materials Tab */}
          <TabsContent value="materials" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {documents
                .filter((doc) => !doc.file_name.toLowerCase().includes('testbank'))
                .map((doc) => (
                <Card key={doc.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-green-600" />
                      {doc.title}
                    </CardTitle>
                    <CardDescription>
                      <div className="flex items-center gap-4 text-xs">
                        <span>{doc.file_type.toUpperCase()}</span>
                        <span>{new Date(doc.uploaded_at).toLocaleDateString()}</span>
                        {doc.slide_count && <span>{doc.slide_count} slides</span>}
                      </div>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleViewDocument(doc)}
                        className="flex-1"
                        variant="outline"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Button>
                      <Button
                        onClick={() => handleDownloadDocument(doc)}
                        className="flex-1"
                        variant="outline"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {documents.filter((doc) => !doc.file_name.toLowerCase().includes('testbank')).length === 0 && (
              <Card className="text-center py-12">
                <CardContent>
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No Materials Available
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Your instructor has not uploaded any course materials yet.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Progress Tab */}
          <TabsContent value="progress" className="space-y-6">
            {/* Teacher Grades Card - Show if any teacher grades exist */}
            {(() => {
              const teacherGradedQuestions = Object.values(feedbackData).filter(f => f.teacher_grade);
              const hasTeacherGrades = teacherGradedQuestions.length > 0;

              if (!hasTeacherGrades) return null;

              const totalPoints = questions.reduce((sum, q) => sum + (q.points || 0), 0);
              const earnedPoints = teacherGradedQuestions.reduce((sum, f) => sum + (f.teacher_grade?.points_awarded || 0), 0);
              const percentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

              return (
                <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border-2 border-emerald-300 dark:border-emerald-700">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center">
                        <User className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-emerald-900 dark:text-emerald-100">Teacher&apos;s Final Grade</CardTitle>
                        <CardDescription className="text-emerald-700 dark:text-emerald-300">
                          Your teacher has reviewed your work
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-white dark:bg-gray-950 rounded-lg p-3 border border-emerald-200 dark:border-emerald-800">
                        <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mb-1">Total Score</p>
                        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                          {earnedPoints}/{totalPoints}
                        </p>
                      </div>
                      <div className="bg-white dark:bg-gray-950 rounded-lg p-3 border border-emerald-200 dark:border-emerald-800">
                        <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mb-1">Percentage</p>
                        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                          {percentage}%
                        </p>
                      </div>
                      <div className="bg-white dark:bg-gray-950 rounded-lg p-3 border border-emerald-200 dark:border-emerald-800">
                        <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mb-1">Graded</p>
                        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                          {teacherGradedQuestions.length}/{questions.length}
                        </p>
                      </div>
                      <div className="bg-white dark:bg-gray-950 rounded-lg p-3 border border-emerald-200 dark:border-emerald-800">
                        <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mb-1">Grade</p>
                        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                          {percentage >= 90 ? 'A' : percentage >= 80 ? 'B' : percentage >= 70 ? 'C' : percentage >= 60 ? 'D' : 'F'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-emerald-200 dark:border-emerald-800">
                      <p className="text-sm text-emerald-800 dark:text-emerald-200">
                        View detailed feedback and comments in the <strong>Feedback</strong> tab.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Test Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Attempts Completed</span>
                        <span>
                          {submissionStatus?.submission_count || 0} / {submissionStatus?.max_attempts || 2}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{
                            width: `${submissionStatus ? ((submissionStatus.submission_count || 0) / (submissionStatus.max_attempts || 2)) * 100 : 0}%`
                          }}
                        ></div>
                      </div>
                    </div>

                    {submissionStatus?.submissions && submissionStatus.submissions.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <h4 className="text-sm font-medium mb-2">Submission History</h4>
                        <div className="space-y-2">
                          {submissionStatus.submissions.map((submission, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm">
                              <span className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                Attempt {submission.attempt}
                              </span>
                              <span className="text-gray-600 dark:text-gray-400">
                                {submission.questions_submitted} questions
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Feedback Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.keys(feedbackData).length > 0 ? (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Questions with feedback:</span>
                          <Badge>{Object.keys(feedbackData).length}</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Correct answers:</span>
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            {(() => {
                              // Count correct answers (full points only)
                              return Object.values(feedbackData).filter(f => {
                                if (f.teacher_grade) {
                                  return f.teacher_grade.points_awarded >= f.points_possible;
                                }
                                return f.is_correct;
                              }).length;
                            })()}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">To review:</span>
                          <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                            {(() => {
                              // Count incorrect answers (less than full points)
                              return Object.values(feedbackData).filter(f => {
                                if (f.teacher_grade) {
                                  return f.teacher_grade.points_awarded < f.points_possible;
                                }
                                return !f.is_correct;
                              }).length;
                            })()}
                          </Badge>
                        </div>
                        <div className="mt-4 pt-4 border-t">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Overall Progress:</span>
                            <span className="text-2xl font-bold text-blue-600">
                              {(() => {
                                // Calculate percentage based on points
                                let totalPointsEarned = 0;
                                let totalPointsPossible = 0;

                                Object.values(feedbackData).forEach(f => {
                                  if (f.teacher_grade) {
                                    totalPointsEarned += f.teacher_grade.points_awarded || 0;
                                    totalPointsPossible += f.points_possible || 0;
                                  } else if (f.correctness_score !== null && f.correctness_score !== undefined) {
                                    // Use AI's score - convert percentage to points
                                    const pointsPossible = f.points_possible || 1;
                                    const score = f.correctness_score > 1 ? f.correctness_score / 100 : f.correctness_score;
                                    totalPointsEarned += score * pointsPossible;
                                    totalPointsPossible += pointsPossible;
                                  } else if (f.score !== null && f.score !== undefined) {
                                    // Fallback to score field
                                    const pointsPossible = f.points_possible || 1;
                                    const score = f.score > 1 ? f.score / 100 : f.score;
                                    totalPointsEarned += score * pointsPossible;
                                    totalPointsPossible += pointsPossible;
                                  }
                                });

                                if (totalPointsPossible === 0) return 0;
                                return Math.round((totalPointsEarned / totalPointsPossible) * 100);
                              })()}%
                            </span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        No feedback available yet. Complete the test to receive feedback.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Survey Tab */}
          <TabsContent value="survey">
            <SurveyTab
              moduleId={moduleId}
              studentId={moduleAccess?.studentId}
              feedbackData={feedbackData}
              feedbackByAttempt={feedbackByAttempt}
              questions={questions}
            />
          </TabsContent>
        </Tabs>
      </main>

      {/* Consent Modal */}
      {showConsentModal && moduleData && moduleAccess && (
        <ModuleConsentModal
          isOpen={showConsentModal}
          moduleId={moduleId}
          moduleName={moduleData.name || moduleAccess?.moduleName}
          consentFormText={moduleData.consent_form_text}
          studentId={moduleAccess.studentId}
          onConsentSubmitted={handleConsentSubmitted}
        />
      )}
    </div>
  );
});

export default function StudentModulePage() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <StudentModuleContent />
    </Suspense>
  );
}