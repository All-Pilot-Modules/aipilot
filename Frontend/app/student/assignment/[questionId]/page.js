'use client';

import { useState, useEffect, useCallback, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
// RadioGroup not available - using custom implementation
import { Label } from "@/components/ui/label";
import { MathText } from "@/components/MathText";
import { StudentAnswerField as EquationField } from "@/components/StudentAnswerField";
import { Spinner } from "@/components/ui/spinner";
import { LoadingCard } from "@/components/ui/loading-overlay";
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Send,
  Save,
  Eye,
  Target,
  Brain
} from "lucide-react";
import { apiClient } from "@/lib/auth";

function StudentAssignmentContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const questionId = params?.questionId;
  const moduleId = searchParams.get('module');
  
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
  const [selectedOption, setSelectedOption] = useState('');
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [timeSpent, setTimeSpent] = useState(0);
  const [startTime] = useState(Date.now());

  const loadQuestion = useCallback(async () => {
    try {
      setLoading(true);
      const accessData = JSON.parse(sessionStorage.getItem('student_module_access'));
      
      // Load question details using existing endpoint
      const questionResponse = await apiClient.get(`/api/questions/${questionId}`);
      setQuestion(questionResponse.data || questionResponse);

      // Load existing answer if available
      if (accessData.studentId) {
        try {
          const answerResponse = await apiClient.get(`/api/student/questions/${questionId}/my-answer?student_id=${accessData.studentId}&attempt=1`);
          if (answerResponse.data || answerResponse) {
            const existingAnswer = answerResponse.data || answerResponse;
            if (existingAnswer && existingAnswer.answer) {
              if (questionResponse.data?.type === 'mcq' || questionResponse.type === 'mcq') {
                setSelectedOption(existingAnswer.answer);
              } else {
                setAnswer(existingAnswer.answer);
              }
            }
          }
        } catch (err) {
          // No existing answer, that's fine
          console.log('No existing answer found');
        }
      }

    } catch (error) {
      console.error('Failed to load question:', error);
      setError('Failed to load assignment. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [questionId]);

  useEffect(() => {
    // Check access
    const accessData = sessionStorage.getItem('student_module_access');
    if (!accessData || JSON.parse(accessData).moduleId !== moduleId) {
      router.push('/join');
      return;
    }

    loadQuestion();

    // Track time spent
    const interval = setInterval(() => {
      setTimeSpent(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [questionId, moduleId, router, startTime, loadQuestion]);

  const handleSaveDraft = async () => {
    const currentAnswer = question?.type === 'mcq' ? selectedOption : answer;
    if (!currentAnswer.trim()) return;

    try {
      const accessData = JSON.parse(sessionStorage.getItem('student_module_access'));
      
      // Use existing submit endpoint - it handles both create and update
      await apiClient.post(`/api/student/submit-answer`, {
        student_id: accessData.studentId,
        question_id: questionId,
        document_id: question.document_id,
        answer: currentAnswer,
        attempt: 1
      });
      
      setSuccess("Draft saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      console.error('Save draft error:', error);
      setError("Failed to save draft. Please try again.");
    }
  };

  const handleSubmit = async () => {
    const currentAnswer = question?.type === 'mcq' ? selectedOption : answer;
    if (!currentAnswer.trim()) {
      setError("Please provide an answer before submitting.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const accessData = JSON.parse(sessionStorage.getItem('student_module_access'));
      
      // Use existing submit endpoint
      const response = await apiClient.post(`/api/student/submit-answer`, {
        student_id: accessData.studentId,
        question_id: questionId,
        document_id: question.document_id,
        answer: currentAnswer,
        attempt: 1
      });

      setProgress({ status: 'completed', answer: currentAnswer });
      setSuccess("Assignment submitted successfully!");
      
      // Redirect back to module after 2 seconds
      setTimeout(() => {
        router.push(`/student/module/${moduleId}`);
      }, 2000);

    } catch (error) {
      console.error('Submit error:', error);
      setError("Failed to submit assignment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-100 dark:from-slate-950 dark:via-blue-950/10 dark:to-slate-900 py-12">
        <div className="max-w-5xl mx-auto px-6">
          {/* Header Skeleton */}
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-6">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-6 w-48" />
            </div>
            <Skeleton className="h-10 w-96 mb-4" />
            <div className="flex items-center gap-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-32" />
            </div>
          </div>

          {/* Question Card Skeleton */}
          <Card className="border-2 border-slate-200 dark:border-slate-700 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/30 border-b-2">
              <Skeleton className="h-8 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="space-y-4">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-5/6" />
              </div>

              {/* Answer options skeleton */}
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="p-4 border-2 border-slate-200 dark:border-slate-700 rounded-lg">
                    <Skeleton className="h-5 w-full" />
                  </div>
                ))}
              </div>

              {/* Submit button skeleton */}
              <div className="pt-6 border-t-2 border-slate-200 dark:border-slate-700">
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error && !question) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Loading Error</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
            <Button onClick={() => router.back()}>
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isCompleted = progress?.status === 'completed';
  const canEdit = !isCompleted;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => router.push(`/student/module/${moduleId}`)}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Module
            </Button>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Clock className="w-4 h-4" />
                Time: {formatTime(timeSpent)}
              </div>
              
              {isCompleted && (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Submitted
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Question Card */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-xl mb-2">
                    Assignment Question
                  </CardTitle>
                  <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                    <Badge variant="outline">
                      {question?.type === 'mcq' ? 'Multiple Choice' : 
                       question?.type === 'short' ? 'Short Answer' : 'Essay Question'}
                    </Badge>
                    {question?.slide_number && (
                      <span>Slide {question.slide_number}</span>
                    )}
                    {question?.bloom_taxonomy && (
                      <div className="flex items-center gap-1">
                        <Brain className="w-3 h-3" />
                        {question.bloom_taxonomy}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="prose dark:prose-invert max-w-none">
                  <MathText className="text-lg leading-relaxed whitespace-pre-wrap">{question?.text}</MathText>
                </div>

                {question?.learning_outcome && (
                  <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-2">
                      <Target className="w-4 h-4 text-blue-600 mt-1" />
                      <div>
                        <h4 className="font-medium text-blue-900 dark:text-blue-100">Learning Outcome</h4>
                        <p className="text-sm text-blue-700 dark:text-blue-300"><MathText inline>{question.learning_outcome}</MathText></p>
                      </div>
                    </div>
                  </div>
                )}

                {question?.image_url && (
                  <div className="border rounded-lg overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={question.image_url}
                      alt={`Visual content for: ${question.question_text?.substring(0, 150)}${question.question_text?.length > 150 ? '...' : ''}`}
                      className="w-full max-w-md mx-auto"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Answer Card */}
          <Card>
            <CardHeader>
              <CardTitle>Your Answer</CardTitle>
              {isCompleted && progress?.score !== undefined && (
                <div className="flex items-center gap-2">
                  <span className="text-sm">Progress:</span>
                  <Badge variant={progress.score >= 70 ? 'default' : 'destructive'}>
                    {progress.score}%
                  </Badge>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {question?.type === 'mcq' ? (
                  <div className="space-y-3">
                    {question.options && Object.entries(question.options).map(([key, option]) => (
                      <div key={key} className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800">
                        <input
                          type="radio"
                          id={`option-${key}`}
                          name="question-option"
                          value={key}
                          checked={selectedOption === key}
                          onChange={(e) => canEdit && setSelectedOption(e.target.value)}
                          disabled={!canEdit}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <Label 
                          htmlFor={`option-${key}`} 
                          className="flex-1 cursor-pointer"
                        >
                          <span className="font-medium mr-2">{key}.</span>
                          <MathText inline>{option}</MathText>
                        </Label>
                        {isCompleted && key === question.correct_answer && (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        )}
                        {isCompleted && key === selectedOption && key !== question.correct_answer && (
                          <XCircle className="w-5 h-5 text-red-500" />
                        )}
                      </div>
                    ))}
                  </div>
                ) : question?.type === 'short' ? (
                  <EquationField
                    value={answer}
                    onChange={(v) => canEdit && setAnswer(v)}
                    placeholder="Enter your short answer... use $x^2$ for math"
                    disabled={!canEdit}
                    rows={1}
                  />
                ) : (
                  <EquationField
                    value={answer}
                    onChange={(v) => canEdit && setAnswer(v)}
                    placeholder="Write your detailed response here... use $x^2$ for inline math or $$x^2$$ for a block equation"
                    disabled={!canEdit}
                    rows={8}
                  />
                )}

                {isCompleted && question?.correct_answer && question.type !== 'mcq' && (
                  <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 mt-1" />
                      <div>
                        <h4 className="font-medium text-green-900 dark:text-green-100">Correct Answer</h4>
                        <MathText className="text-sm text-green-700 dark:text-green-300">{question.correct_answer}</MathText>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Alerts */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">{success}</span>
              </div>
            </div>
          )}

          {/* Actions */}
          {canEdit && (
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={handleSaveDraft}
                disabled={submitting}
              >
                <Save className="w-4 h-4 mr-2" />
                Save Draft
              </Button>

              <Button
                onClick={handleSubmit}
                disabled={submitting || (!selectedOption && !answer.trim())}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {submitting ? (
                  <>
                    <Spinner size="sm" className="h-4 w-4 mr-2" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Submit Answer
                  </>
                )}
              </Button>
            </div>
          )}

          {isCompleted && (
            <div className="text-center">
              <Button
                onClick={() => router.push(`/student/module/${moduleId}`)}
                variant="outline"
              >
                <Eye className="w-4 h-4 mr-2" />
                Return to Module
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function StudentAssignmentPage() {
  return (
    <Suspense fallback={<LoadingCard />}>
      <StudentAssignmentContent />
    </Suspense>
  );
}
