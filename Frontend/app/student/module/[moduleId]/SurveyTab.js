'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, AlertCircle, Loader2, ClipboardList, Send, User, Trophy, Award, Edit3, MessageSquare } from 'lucide-react';
import { apiClient } from '@/lib/auth';

export default function SurveyTab({ moduleId, studentId, feedbackData = {}, feedbackByAttempt = {}, questions = [] }) {
  const [surveyData, setSurveyData] = useState(null);
  const [responses, setResponses] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const loadSurvey = useCallback(async () => {
    if (!moduleId || !studentId) return;
    try {
      setLoading(true);
      setError(null);

      const data = await apiClient.get(
        `/api/student/modules/${moduleId}/survey?student_id=${studentId}`
      );
      setSurveyData(data);
      setHasSubmitted(data.has_submitted);

      // Pre-fill responses if already submitted
      // Map responses by index to avoid duplicate ID issues
      if (data.my_response && data.my_response.responses) {
        const indexedResponses = {};
        data.survey_questions.forEach((q, idx) => {
          const uniqueKey = `q-${idx}`;
          if (data.my_response.responses[q.id]) {
            indexedResponses[uniqueKey] = data.my_response.responses[q.id];
          }
        });
        setResponses(indexedResponses);
      }
    } catch (err) {
      console.error('Failed to load survey:', err);
      setError('Failed to load survey. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [moduleId, studentId]);

  // Load survey and existing responses
  useEffect(() => {
    loadSurvey();
  }, [loadSurvey]);

  // Calculate progress - must be before early returns
  const progress = useMemo(() => {
    if (!surveyData?.survey_questions) return 0;
    const answered = surveyData.survey_questions.filter((q, idx) => {
      const uniqueKey = `q-${idx}`;
      return responses[uniqueKey]?.trim();
    }).length;
    return Math.round((answered / surveyData.survey_questions.length) * 100);
  }, [responses, surveyData]);

  const handleResponseChange = (uniqueKey, value) => {
    setResponses(prev => ({
      ...prev,
      [uniqueKey]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      // Validate required questions
      for (let i = 0; i < surveyData.survey_questions.length; i++) {
        const question = surveyData.survey_questions[i];
        const uniqueKey = `q-${i}`;
        if (question.required && !responses[uniqueKey]?.trim()) {
          setError(`Please answer the required question: "${question.question}"`);
          setSubmitting(false);
          return;
        }
      }

      // Convert indexed responses back to question ID based responses for backend
      const backendResponses = {};
      surveyData.survey_questions.forEach((q, idx) => {
        const uniqueKey = `q-${idx}`;
        if (responses[uniqueKey]) {
          backendResponses[q.id] = responses[uniqueKey];
        }
      });

      // Submit survey
      await apiClient.post(
        `/api/student/modules/${moduleId}/survey?student_id=${studentId}`,
        { responses: backendResponses }
      );

      setSuccess(true);
      setHasSubmitted(true);

      // Reload to get updated data
      await loadSurvey();
    } catch (err) {
      console.error('Failed to submit survey:', err);
      setError(err.message || 'Failed to submit survey. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Skeleton */}
        <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-800 p-8 animate-pulse">
          <Skeleton className="h-12 w-80 mb-4" />
          <Skeleton className="h-4 w-96 mb-2" />
          <Skeleton className="h-2.5 w-full mt-6 rounded-full" />
        </div>

        {/* Survey Questions Skeleton */}
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="relative overflow-hidden bg-white dark:bg-gray-900 rounded-2xl border-2 border-gray-200 dark:border-gray-800 shadow-sm p-7 animate-pulse">
              <div className="flex items-center gap-4 mb-5">
                <Skeleton className="w-10 h-10 rounded-xl" />
                <Skeleton className="h-6 w-3/4" />
              </div>
              <Skeleton className="h-32 w-full rounded-xl" />
              <div className="flex items-center gap-3 mt-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
            </div>
          ))}
        </div>

        {/* Submit Button Skeleton */}
        <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-800 shadow-lg p-8 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="w-12 h-12 rounded-xl" />
              <div>
                <Skeleton className="h-5 w-40 mb-2" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <Skeleton className="h-14 w-48 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!surveyData || !surveyData.survey_questions || surveyData.survey_questions.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900"></div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjAzIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-50"></div>
        <div className="relative p-16 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 mb-6 shadow-lg">
            <ClipboardList className="w-10 h-10 text-gray-500 dark:text-gray-400" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">No Survey Available</h3>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            There&apos;s no survey for this module yet. Check back later or contact your instructor for more information.
          </p>
        </div>
      </div>
    );
  }

  const isReadOnly = hasSubmitted;

  // Calculate teacher grades summary from ALL attempts
  // Use the latest (highest attempt) grade for each question if multiple exist
  const gradesByQuestion = {};
  Object.entries(feedbackByAttempt).forEach(([attempt, attemptFeedback]) => {
    Object.entries(attemptFeedback).forEach(([questionId, feedback]) => {
      if (feedback.teacher_grade) {
        // If we don't have a grade for this question yet, or this is a later attempt, use it
        if (!gradesByQuestion[questionId] || feedback.attempt > gradesByQuestion[questionId].attempt) {
          gradesByQuestion[questionId] = feedback;
        }
      }
    });
  });

  const teacherGradedQuestions = Object.values(gradesByQuestion);
  const hasTeacherGrades = teacherGradedQuestions.length > 0;

  const totalPoints = questions.reduce((sum, q) => sum + (q.points || 0), 0);
  const earnedPoints = teacherGradedQuestions.reduce((sum, f) => sum + (f.teacher_grade?.points_awarded || 0), 0);
  const percentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

  // Debug logging
  if (hasTeacherGrades) {
    console.log('📊 Survey Tab - Teacher Grades Found:', {
      totalGraded: teacherGradedQuestions.length,
      earnedPoints,
      totalPoints,
      percentage,
      grades: teacherGradedQuestions.map(f => ({
        questionId: f.question_id,
        attempt: f.attempt,
        points: f.teacher_grade?.points_awarded
      }))
    });
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Teacher Grades Summary - Show if any grades exist */}
      {hasTeacherGrades && (
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 opacity-50"></div>
          <div className="relative bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-xl border-2 border-emerald-300 dark:border-emerald-700 shadow-lg p-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0">
                <Trophy className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 mb-2">
                  Your Grades
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-white dark:bg-gray-950 rounded-lg p-3 border border-emerald-200 dark:border-emerald-800">
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mb-1">Total Score</p>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      {earnedPoints} / {totalPoints}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-gray-950 rounded-lg p-3 border border-emerald-200 dark:border-emerald-800">
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mb-1">Percentage</p>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      {percentage}%
                    </p>
                  </div>
                  <div className="bg-white dark:bg-gray-950 rounded-lg p-3 border border-emerald-200 dark:border-emerald-800">
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mb-1">Questions Graded</p>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      {teacherGradedQuestions.length} / {questions.length}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-emerald-800 dark:text-emerald-200">
                  Your teacher has graded {teacherGradedQuestions.length} {teacherGradedQuestions.length === 1 ? 'question' : 'questions'}.
                  View detailed feedback in the <strong>Feedback</strong> tab.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 opacity-90"></div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjEiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-30"></div>
        <div className="relative p-8 text-white">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center shadow-lg">
                  <MessageSquare className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold tracking-tight drop-shadow-sm">Module Feedback Survey</h2>
                  <p className="text-white/80 text-sm mt-1">
                    {surveyData?.survey_questions?.length || 0} questions
                  </p>
                </div>
              </div>
              <p className="text-white/90 leading-relaxed ml-[60px] max-w-2xl">
                {hasSubmitted
                  ? 'Thank you for completing the survey. You can review your responses below.'
                  : 'Your feedback helps us create better learning experiences. Please take a moment to share your thoughts.'}
              </p>
            </div>
            {hasSubmitted && (
              <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/30 flex items-center gap-2 shadow-lg">
                <CheckCircle className="w-5 h-5 text-white" />
                <span className="text-sm font-semibold">Completed</span>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          {!hasSubmitted && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/90 font-medium">Progress</span>
                <span className="text-white font-semibold">{progress}%</span>
              </div>
              <div className="h-2.5 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm border border-white/30">
                <div
                  className="h-full bg-gradient-to-r from-white to-white/90 rounded-full transition-all duration-500 ease-out shadow-lg"
                  style={{ width: `${progress}%` }}
                >
                  <div className="w-full h-full bg-white/30 animate-pulse"></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div className="relative overflow-hidden rounded-2xl animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 opacity-90"></div>
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjEiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-20"></div>
          <div className="relative p-6 text-white">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center shadow-lg">
                <CheckCircle className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-xl font-bold mb-1">Survey Submitted Successfully!</p>
                <p className="text-white/90 text-sm">Thank you for your valuable feedback. Your responses have been recorded.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="relative overflow-hidden rounded-2xl animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-rose-500 to-red-500 opacity-90"></div>
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjEiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-20"></div>
          <div className="relative p-6 text-white">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center shadow-lg">
                <AlertCircle className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-xl font-bold mb-1">Error Submitting Survey</p>
                <p className="text-white/90 text-sm">{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Survey Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {surveyData.survey_questions.map((question, index) => {
          const uniqueKey = `q-${index}`;
          const hasAnswer = responses[uniqueKey]?.trim();

          return (
            <div
              key={uniqueKey}
              className="group relative overflow-hidden bg-white dark:bg-gray-900 rounded-2xl border-2 border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-xl hover:border-indigo-300 dark:hover:border-indigo-700 transition-all duration-300"
            >
              {/* Top accent bar */}
              <div className={`absolute top-0 left-0 w-full h-1.5 transition-all duration-500 ${
                hasAnswer
                  ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500'
                  : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-100'
              }`}></div>

              <div className="p-7">
                <div className="mb-5">
                  <Label htmlFor={`survey-${index}`} className="text-base font-medium text-gray-900 dark:text-white flex items-start gap-4 mb-5">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 shadow-md ${
                      hasAnswer
                        ? 'bg-gradient-to-br from-emerald-500 to-teal-500 scale-110'
                        : 'bg-gradient-to-br from-indigo-500 to-purple-500 group-hover:scale-110'
                    }`}>
                      {hasAnswer ? (
                        <CheckCircle className="w-5 h-5 text-white" />
                      ) : (
                        <span className="text-base font-bold text-white">{index + 1}</span>
                      )}
                    </div>
                    <span className="flex-1 leading-relaxed pt-1.5 text-lg">
                      {question.question}
                      {question.required && (
                        <span className="inline-flex items-center ml-2">
                          <span className="px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-semibold">Required</span>
                        </span>
                      )}
                    </span>
                  </Label>
                </div>

                <div className="relative">
                  {question.type === 'short' ? (
                    <Input
                      id={`survey-${index}`}
                      value={responses[uniqueKey] || ''}
                      onChange={(e) => handleResponseChange(uniqueKey, e.target.value)}
                      placeholder={question.placeholder || 'Type your answer...'}
                      required={question.required}
                      disabled={isReadOnly}
                      className={`text-base py-6 px-4 transition-all duration-300 focus:ring-4 rounded-xl ${
                        isReadOnly
                          ? 'bg-gray-50 dark:bg-gray-800/50 cursor-not-allowed border-gray-300 dark:border-gray-700'
                          : 'bg-gray-50 dark:bg-gray-950 hover:bg-white dark:hover:bg-gray-900 focus:bg-white dark:focus:bg-gray-900 hover:border-indigo-300 dark:hover:border-indigo-700 focus:border-indigo-500 focus:ring-indigo-500/20'
                      }`}
                      maxLength={500}
                    />
                  ) : (
                    <Textarea
                      id={`survey-${index}`}
                      value={responses[uniqueKey] || ''}
                      onChange={(e) => handleResponseChange(uniqueKey, e.target.value)}
                      placeholder={question.placeholder || 'Type your answer...'}
                      required={question.required}
                      disabled={isReadOnly}
                      className={`min-h-[140px] text-base py-4 px-4 transition-all duration-300 focus:ring-4 resize-none rounded-xl ${
                        isReadOnly
                          ? 'bg-gray-50 dark:bg-gray-800/50 cursor-not-allowed border-gray-300 dark:border-gray-700'
                          : 'bg-gray-50 dark:bg-gray-950 hover:bg-white dark:hover:bg-gray-900 focus:bg-white dark:focus:bg-gray-900 hover:border-indigo-300 dark:hover:border-indigo-700 focus:border-indigo-500 focus:ring-indigo-500/20'
                      }`}
                      maxLength={2000}
                    />
                  )}
                  {!isReadOnly && (
                    <div className="absolute top-3 right-3 pointer-events-none">
                      <Edit3 className={`w-4 h-4 transition-all duration-300 ${
                        responses[uniqueKey]?.length > 0 ? 'text-indigo-400 opacity-100' : 'text-gray-300 opacity-0 group-hover:opacity-50'
                      }`} />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                      {responses[uniqueKey]?.length || 0} / {question.type === 'short' ? '500' : '2000'}
                    </p>
                    {responses[uniqueKey]?.length > 0 && !isReadOnly && (
                      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800">
                        <CheckCircle className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">Answered</span>
                      </div>
                    )}
                  </div>

                  {question.type === 'long' && !isReadOnly && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5" />
                      Long answer
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {!isReadOnly && (
          <div className="relative overflow-hidden rounded-2xl mt-8">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 opacity-10"></div>
            <div className="relative bg-white dark:bg-gray-900 backdrop-blur-sm rounded-2xl border-2 border-gray-200 dark:border-gray-800 shadow-lg p-8">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg">
                      <Send className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">Ready to Submit?</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {progress === 100 ? 'All questions answered!' : `${surveyData.survey_questions.length - Math.round((progress / 100) * surveyData.survey_questions.length)} questions remaining`}
                      </p>
                    </div>
                  </div>
                  {progress < 100 && (
                    <div className="flex items-center gap-2 ml-[60px] px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 w-fit">
                      <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                        Some required fields are incomplete
                      </span>
                    </div>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={submitting}
                  size="lg"
                  className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 text-white shadow-xl hover:shadow-2xl transition-all duration-300 px-10 py-6 text-lg font-semibold rounded-xl group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5 mr-3 group-hover:translate-x-1 transition-transform duration-300" />
                      Submit Survey
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {isReadOnly && surveyData?.my_response?.submitted_at && (
          <div className="relative overflow-hidden rounded-2xl mt-8">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 via-teal-500 to-emerald-500 opacity-90"></div>
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjEiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-20"></div>
            <div className="relative p-8 text-white">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-center sm:text-left">
                <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center shadow-lg">
                  <CheckCircle className="w-8 h-8 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold mb-1">
                    Survey Completed
                  </p>
                  <p className="text-white/90">
                    Submitted on {new Date(surveyData.my_response.submitted_at).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
