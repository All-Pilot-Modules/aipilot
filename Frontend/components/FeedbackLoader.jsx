'use client';

import { Brain, Sparkles, CheckCircle, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export function FeedbackGeneratingBanner({ feedbackStatus, pollCount }) {
  const progress = feedbackStatus?.progress_percentage || 0;
  const ready = feedbackStatus?.feedback_ready || 0;
  const total = feedbackStatus?.total_questions || 0;

  return (
    <Card className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-purple-950/30 border-2 border-blue-200 dark:border-blue-800 shadow-lg">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          {/* Animated Brain Icon */}
          <div className="relative">
            <div className="absolute inset-0 bg-blue-400 rounded-full blur-xl opacity-50 animate-pulse"></div>
            <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <Brain className="w-8 h-8 text-white animate-pulse" />
            </div>
          </div>

          <div className="flex-1 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-foreground flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-yellow-500 animate-pulse" />
                  AI is Analyzing Your Answers
                </h3>
                <p className="text-sm text-gray-600 dark:text-muted-foreground mt-1">
                  Generating personalized feedback for each question...
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {ready}/{total}
                </div>
                <div className="text-xs text-gray-500 dark:text-muted-foreground">
                  questions analyzed
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <Progress value={progress} className="h-3" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-muted-foreground">
                  {progress}% complete
                </span>
                {pollCount > 20 && (
                  <span className="text-blue-600 dark:text-blue-400 animate-pulse flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Taking a bit longer for complex answers...
                  </span>
                )}
              </div>
            </div>

            {/* Status Messages */}
            {progress < 30 && (
              <p className="text-xs text-gray-500 dark:text-muted-foreground flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-ping inline-block"></span>
                Reviewing your responses and comparing with learning materials...
              </p>
            )}
            {progress >= 30 && progress < 70 && (
              <p className="text-xs text-gray-500 dark:text-muted-foreground flex items-center gap-2">
                <span className="w-2 h-2 bg-indigo-500 rounded-full animate-ping inline-block"></span>
                Analyzing answer quality and identifying strengths...
              </p>
            )}
            {progress >= 70 && (
              <p className="text-xs text-gray-500 dark:text-muted-foreground flex items-center gap-2">
                <span className="w-2 h-2 bg-purple-500 rounded-full animate-ping inline-block"></span>
                Generating improvement suggestions and final scores...
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function FeedbackSkeletonCard() {
  return (
    <Card className="animate-pulse">
      <CardContent className="p-6 space-y-4">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2 flex-1">
            <div className="h-6 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
          <div className="h-16 w-16 bg-muted rounded-lg"></div>
        </div>

        {/* Score Skeleton */}
        <div className="h-20 bg-gradient-to-r from-muted to-muted rounded-lg"></div>

        {/* Feedback Sections */}
        <div className="space-y-3">
          <div className="h-24 bg-blue-50 dark:bg-blue-950/20 rounded-lg"></div>
          <div className="h-16 bg-green-50 dark:bg-green-950/20 rounded-lg"></div>
          <div className="h-16 bg-orange-50 dark:bg-orange-950/20 rounded-lg"></div>
        </div>
      </CardContent>
    </Card>
  );
}

export function QuestionFeedbackLoader({ questionNumber, isAnswered }) {
  if (!isAnswered) {
    return (
      <div className="bg-muted/50 dark:bg-muted p-6 rounded-lg text-center">
        <div className="text-gray-400 mb-2">Question {questionNumber}</div>
        <p className="text-gray-600 dark:text-muted-foreground font-medium">
          No answer provided
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/20 dark:via-indigo-950/20 dark:to-purple-950/20 p-8 rounded-lg text-center border-2 border-blue-200 dark:border-blue-800">
      <div className="relative inline-block mb-4">
        {/* Animated rings */}
        <div className="absolute inset-0 animate-ping">
          <div className="w-20 h-20 rounded-full border-4 border-blue-400 opacity-20"></div>
        </div>
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-xl animate-pulse">
            <Brain className="w-10 h-10 text-white" />
          </div>
        </div>
      </div>

      <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100 mb-2 flex items-center justify-center gap-2">
        <Sparkles className="w-5 h-5 text-yellow-500 animate-pulse" />
        AI is Analyzing Your Answer
      </h3>
      <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
        Generating personalized feedback for question {questionNumber}
      </p>

      {/* Animated dots */}
      <div className="flex items-center justify-center gap-2">
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
      </div>

      <p className="text-xs text-gray-500 dark:text-muted-foreground mt-4">
        This may take 10-30 seconds per question
      </p>
    </div>
  );
}

export function AllQuestionsLoader({ totalQuestions }) {
  return (
    <div className="text-center py-16 space-y-6">
      {/* Main loader */}
      <div className="relative inline-block">
        <div className="absolute inset-0 animate-ping">
          <div className="w-24 h-24 rounded-full border-4 border-blue-400 opacity-20"></div>
        </div>
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl">
            <Brain className="w-12 h-12 text-white animate-pulse" />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-foreground flex items-center justify-center gap-2">
          <Sparkles className="w-6 h-6 text-yellow-500 animate-pulse" />
          Generating Your Feedback
        </h3>
        <p className="text-gray-600 dark:text-muted-foreground">
          Please wait while we analyze your {totalQuestions} answers
        </p>
        <p className="text-sm text-gray-500 dark:text-muted-foreground">
          This may take a few moments...
        </p>
      </div>

      {/* Animated progress indicators */}
      <div className="flex items-center justify-center gap-3">
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <span className="text-xs text-blue-700 dark:text-blue-300">Analyzing responses</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-full">
          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
          <span className="text-xs text-indigo-700 dark:text-indigo-300">Generating feedback</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/30 rounded-full">
          <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
          <span className="text-xs text-purple-700 dark:text-purple-300">Creating insights</span>
        </div>
      </div>
    </div>
  );
}
