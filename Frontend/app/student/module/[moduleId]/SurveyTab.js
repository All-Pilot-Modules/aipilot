'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, Loader2, ClipboardList } from 'lucide-react';
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
    if (!surveyData?.survey_questions?.length) return 0;
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

  if (loading) return (
    <div className="mx-auto max-w-3xl space-y-8 py-6" role="status" aria-label="Loading survey">
      <Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-3/4" />
      {[0, 1, 2].map(i => <div key={i} className="space-y-4"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-28 w-full rounded-xl" /></div>)}
    </div>
  );

  if (!surveyData?.survey_questions?.length) return (
    <div className="mx-auto max-w-xl rounded-2xl border border-border/70 bg-background px-6 py-16 text-center">
      <ClipboardList className="mx-auto mb-4 h-7 w-7 text-muted-foreground" aria-hidden="true" />
      <h2 className="text-xl font-semibold tracking-tight">{error ? 'Survey unavailable' : 'No survey yet'}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground" role={error ? 'alert' : undefined}>{error || 'Your instructor has not added a survey to this module.'}</p>
      {error && <Button variant="outline" className="mt-5" onClick={loadSurvey}>Try again</Button>}
    </div>
  );

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

  const remainingRequired = surveyData.survey_questions.filter((question, index) => question.required && !responses[`q-${index}`]?.trim()).length;
  const answeredCount = surveyData.survey_questions.filter((question, index) => responses[`q-${index}`]?.trim()).length;

  return (
    <div className="mx-auto max-w-3xl pb-8 text-foreground">
      <header className="mb-8 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold tracking-tight">Learning experience survey</h2>
          {hasSubmitted && <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />Submitted</span>}
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Share what worked well and what could be better. Your feedback helps improve this module.</p>
        {!hasSubmitted && <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground"><span>{answeredCount} of {surveyData.survey_questions.length} answered</span><span>{progress}%</span></div>
          <div role="progressbar" aria-label="Survey completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-teal-600 transition-[width] motion-reduce:transition-none" style={{ width: `${progress}%` }} /></div>
        </div>}
      </header>

      {hasTeacherGrades && <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm">
        <div><p className="font-medium">Teacher assessment</p><p className="mt-1 text-xs text-muted-foreground">{teacherGradedQuestions.length} of {questions.length} questions graded. See the Feedback tab for details.</p></div>
        <span className="font-medium tabular-nums">{earnedPoints} / {totalPoints} points · {percentage}%</span>
      </div>}
      {success && <p role="status" className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">Thank you. Your responses have been saved.</p>}
      {error && <p role="alert" className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}

      <form onSubmit={handleSubmit} className="rounded-2xl border border-border/70 bg-background">
        <div className="divide-y divide-border/60 px-5 sm:px-8">
          {surveyData.survey_questions.map((question, index) => {
            const uniqueKey = `q-${index}`;
            const limit = question.type === 'short' ? 500 : 2000;
            return <div key={uniqueKey} className="py-7">
              <div className="mb-4 flex items-start gap-3">
                <span className="mt-0.5 text-sm tabular-nums text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
                <div className="min-w-0 flex-1">
                  <Label htmlFor={`survey-${index}`} className="text-base font-medium leading-6">{question.question}</Label>
                  <p className="mt-1 text-xs text-muted-foreground">{question.required ? 'Required' : 'Optional'}</p>
                </div>
              </div>
              {question.type === 'short' ? <Input id={`survey-${index}`} value={responses[uniqueKey] || ''} onChange={event => handleResponseChange(uniqueKey, event.target.value)} placeholder={question.placeholder || 'Your response'} required={question.required} readOnly={isReadOnly} disabled={submitting} maxLength={limit} aria-describedby={`survey-count-${index}`} className="h-12 rounded-xl border-border bg-muted/20 px-4 text-base shadow-none" /> :
                <Textarea id={`survey-${index}`} value={responses[uniqueKey] || ''} onChange={event => handleResponseChange(uniqueKey, event.target.value)} placeholder={question.placeholder || 'Share your thoughts…'} required={question.required} readOnly={isReadOnly} disabled={submitting} maxLength={limit} aria-describedby={`survey-count-${index}`} className="min-h-28 resize-y rounded-xl border-border bg-muted/20 px-4 py-3 text-base leading-6 shadow-none" />}
              <p id={`survey-count-${index}`} className="mt-2 text-right text-xs tabular-nums text-muted-foreground">{responses[uniqueKey]?.length || 0} / {limit}</p>
            </div>;
          })}
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-border/60 px-5 py-5 sm:px-8">
          {isReadOnly ? <div className="text-sm text-muted-foreground"><p className="font-medium text-foreground">Your response is recorded</p>{surveyData.my_response?.submitted_at && <p className="mt-1 text-xs">Submitted {new Date(surveyData.my_response.submitted_at).toLocaleString()}</p>}</div> : <>
            <p className="text-xs text-muted-foreground">{remainingRequired ? `${remainingRequired} required ${remainingRequired === 1 ? 'question' : 'questions'} remaining` : 'All required questions answered'}</p>
            <Button type="submit" disabled={submitting} className="rounded-xl bg-teal-700 px-5 text-white hover:bg-teal-800">{submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />}{submitting ? 'Submitting…' : 'Submit survey'}</Button>
          </>}
        </footer>
      </form>
    </div>
  );
}
