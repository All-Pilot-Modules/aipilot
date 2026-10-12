'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  RotateCcw,
  X
} from "lucide-react";

export default function PrefillControlPanel({
  previousAttempts,
  selectedPrefillAttempt,
  setSelectedPrefillAttempt,
  selectedQuestionsForPrefill,
  toggleQuestionSelection,
  prefillAllAnswers,
  prefillSelectedQuestions,
  onClose,
  questions
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!previousAttempts || previousAttempts.length === 0) {
    return null;
  }

  const currentAttemptData = previousAttempts.find(
    a => a.attemptNumber === selectedPrefillAttempt
  );

  const getQuestionText = (questionId) => {
    const question = questions.find(q => q.id === questionId);
    if (!question) return "Question";
    return question.text.length > 60
      ? question.text.substring(0, 60) + "..."
      : question.text;
  };

  const getQuestionType = (questionId) => {
    const question = questions.find(q => q.id === questionId);
    return question?.type || 'unknown';
  };

  const getAnswerPreview = (questionId, answerValue) => {
    const questionType = getQuestionType(questionId);
    const question = questions.find(q => q.id === questionId);

    if (questionType === 'mcq' && question?.options) {
      // Show the option text for MCQ
      const optionText = question.options[answerValue];
      return optionText ? `${answerValue}. ${optionText.substring(0, 50)}${optionText.length > 50 ? '...' : ''}` : answerValue;
    }

    // For text answers, show preview
    return answerValue.length > 80
      ? answerValue.substring(0, 80) + "..."
      : answerValue;
  };

  return (
    <Card className="border-2 border-blue-200 dark:border-blue-800 shadow-lg mb-6">
      <CardHeader className="pb-4 bg-blue-50 dark:bg-blue-950/20">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-blue-600 dark:text-blue-300" />
              Prefill from Previous Attempt
            </CardTitle>
            <CardDescription className="mt-1">
              Load your answers from a previous attempt to save time
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-4 mt-4">
          {/* Attempt Selector */}
          {previousAttempts.length > 1 && (
            <div className="flex items-center gap-2">
              <Label htmlFor="attempt-select" className="text-sm font-medium">
                Select Attempt:
              </Label>
              <select
                id="attempt-select"
                value={selectedPrefillAttempt}
                onChange={(e) => setSelectedPrefillAttempt(Number(e.target.value))}
                className="px-3 py-1.5 border border-border rounded-md bg-card dark:bg-muted text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {previousAttempts.map(attempt => (
                  <option key={attempt.attemptNumber} value={attempt.attemptNumber}>
                    Attempt {attempt.attemptNumber} ({Object.keys(attempt.answers).length} answers)
                  </option>
                ))}
              </select>
            </div>
          )}

          {previousAttempts.length === 1 && (
            <Badge variant="outline" className="text-sm">
              From Attempt {previousAttempts[0].attemptNumber}
            </Badge>
          )}

          {/* Prefill All Button */}
          <Button
            onClick={() => prefillAllAnswers(selectedPrefillAttempt)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            size="sm"
            disabled={currentAttemptData && Object.keys(currentAttemptData.answers).length === 0}
          >
            <FileText className="w-4 h-4 mr-2" />
            Prefill All Answers
            {currentAttemptData && Object.keys(currentAttemptData.answers).length === 0 && (
              <span className="ml-2 text-xs">(No answers)</span>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        <div className="space-y-3">
          {/* Toggle for individual selection */}
          <div className="flex items-center justify-between pb-2 border-b">
            <Label className="text-sm font-medium">
              Or select individual questions:
            </Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 px-2"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-1" />
                  Hide
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-1" />
                  Show ({currentAttemptData ? Object.keys(currentAttemptData.answers).length : 0} available)
                </>
              )}
            </Button>
          </div>

          {/* Question List */}
          {isExpanded && currentAttemptData && (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
              {questions.map((question, index) => {
                const hasAnswer = currentAttemptData.answers[question.id];
                if (!hasAnswer) return null;

                const answerData = currentAttemptData.answers[question.id];
                const feedbackData = currentAttemptData.feedback[question.id];
                const isSelected = selectedQuestionsForPrefill.has(question.id);
                const isCorrect = feedbackData?.is_correct;

                return (
                  <div
                    key={question.id}
                    className={`
                      flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer
                      ${isSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                        : 'border-border hover:border-border hover:bg-muted/50 dark:hover:bg-muted'
                      }
                    `}
                    onClick={() => toggleQuestionSelection(question.id)}
                  >
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="mt-1 h-4 w-4 text-blue-600 dark:text-blue-300 focus:ring-blue-500 border-border rounded cursor-pointer"
                    />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-gray-900 dark:text-foreground">
                              Q{index + 1}
                            </span>
                            {feedbackData && (
                              <Badge
                                variant={isCorrect ? "default" : "destructive"}
                                className={`text-xs ${
                                  isCorrect
                                    ? 'bg-green-700 hover:bg-green-700 text-white'
                                    : 'bg-red-600 hover:bg-red-700 text-white'
                                }`}
                              >
                                {isCorrect ? (
                                  <>
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Correct
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="w-3 h-3 mr-1" />
                                    Incorrect
                                  </>
                                )}
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs">
                              {question.type === 'mcq' ? 'MCQ' : question.type === 'short' ? 'Short' : 'Essay'}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-muted-foreground mb-2">
                            {getQuestionText(question.id)}
                          </p>
                          <div className="bg-muted p-2 rounded text-xs">
                            <span className="font-medium text-gray-700 dark:text-foreground">
                              Previous answer:{" "}
                            </span>
                            <span className="text-gray-600 dark:text-muted-foreground">
                              {getAnswerPreview(question.id, answerData.value)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {Object.keys(currentAttemptData.answers).length === 0 && (
                <div className="text-center py-6 text-gray-500 dark:text-muted-foreground">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No answers found in this attempt</p>
                </div>
              )}
            </div>
          )}

          {/* Apply Selected Button */}
          {isExpanded && selectedQuestionsForPrefill.size > 0 && (
            <div className="pt-3 border-t flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-muted-foreground">
                {selectedQuestionsForPrefill.size} question{selectedQuestionsForPrefill.size !== 1 ? 's' : ''} selected
              </span>
              <Button
                onClick={prefillSelectedQuestions}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                size="sm"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Apply Selected ({selectedQuestionsForPrefill.size})
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
