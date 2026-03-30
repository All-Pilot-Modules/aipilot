'use client';

import { useState, useEffect, useCallback, memo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Target,
  Brain,
  Zap,
  Trophy,
  ArrowRight,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { apiClient } from "@/lib/auth";

// ── Streak dots visual indicator ────────────────────────────────────
function StreakDots({ current, required }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: required }).map((_, i) => (
        <div
          key={i}
          className={`w-3 h-3 rounded-full transition-all ${
            i < current
              ? "bg-purple-500 scale-110"
              : "bg-gray-300 dark:bg-gray-600"
          }`}
        />
      ))}
    </div>
  );
}

const MasteryPage = memo(function MasteryPage() {
  const params = useParams();
  const router = useRouter();
  const moduleId = params?.moduleId;

  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);

  const [moduleAccess, setModuleAccess] = useState(null);
  const [questions, setQuestions] = useState([]);          // all active questions keyed by id
  const [questionsMap, setQuestionsMap] = useState({});
  const [queueState, setQueueState] = useState([]);        // [{question_id, streak_count, is_mastered, attempts}]
  const [streakRequired, setStreakRequired] = useState(3);
  const [progress, setProgress] = useState({ total: 0, mastered: 0, all_mastered: false });

  const [currentQuestionId, setCurrentQuestionId] = useState(null);
  const [answer, setAnswer] = useState(null);              // current answer value
  // Per-question attempt counter: { [questionId]: number }
  // Increments each time the student submits an answer for that question
  const [questionAttempts, setQuestionAttempts] = useState({});

  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Feedback state — only shown on wrong answer
  const [wrongFeedback, setWrongFeedback] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const [isCompleted, setIsCompleted] = useState(false);

  // ── Load queue + questions ──────────────────────────────────────
  const loadMastery = useCallback(async (access) => {
    try {
      setLoading(true);

      // Initialize / fetch queue state
      const stateRes = await apiClient.get(
        `/api/student/modules/${moduleId}/mastery/state?student_id=${access.studentId}`
      );
      const stateData = stateRes?.data || stateRes || {};

      setQueueState(stateData.queue || []);
      setProgress(stateData.progress || { total: 0, mastered: 0, all_mastered: false });
      setStreakRequired(stateData.streak_required || 3);

      if (stateData.progress?.all_mastered) {
        setIsCompleted(true);
        return;
      }

      // Load question details
      const qRes = await apiClient.get(`/api/student/modules/${moduleId}/questions`);
      const qData = qRes?.data || qRes || [];
      setQuestions(qData);

      const map = {};
      qData.forEach(q => { map[q.id] = q; });
      setQuestionsMap(map);

      // Build per-question attempt counters from queue state
      const attemptsMap = {};
      (stateData.queue || []).forEach(e => {
        attemptsMap[e.question_id] = (e.attempts || 0) + 1;
      });
      setQuestionAttempts(attemptsMap);

      // Pick first unmastered question
      const firstUnmastered = (stateData.queue || []).find(e => !e.is_mastered);
      if (firstUnmastered) {
        setCurrentQuestionId(firstUnmastered.question_id);
      } else {
        setIsCompleted(true);
      }
    } catch (err) {
      console.error("Failed to load mastery session:", err);
      const isNetwork = err?.message?.includes("Failed to fetch") || err?.message?.includes("fetch");
      setError(
        isNetwork
          ? "Cannot reach the server. Make sure the backend is running and try again."
          : err?.response?.data?.detail || "Failed to load mastery session. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [moduleId]);

  useEffect(() => {
    const accessData = sessionStorage.getItem("student_module_access");
    if (!accessData || String(JSON.parse(accessData).moduleId) !== String(moduleId)) {
      router.push("/join");
      return;
    }
    const access = JSON.parse(accessData);
    setModuleAccess(access);
    loadMastery(access);
  }, [moduleId, router, loadMastery]);

  // ── Format answer for submission ────────────────────────────────
  const formatAnswer = (question, rawAnswer) => {
    const type = question?.type?.toLowerCase();
    if (type === "mcq") return { selected_option_id: rawAnswer };
    if (type === "mcq_multiple") return { selected_options: rawAnswer || [] };
    if (type === "fill_blank") return { blanks: rawAnswer || {} };
    if (type === "multi_part") return { sub_answers: rawAnswer || {} };
    return { text_response: typeof rawAnswer === "string" ? rawAnswer.trim() : rawAnswer };
  };

  // ── Submit answer ────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!currentQuestionId || !moduleAccess) return;
    const question = questionsMap[currentQuestionId];
    if (!question) return;

    const isEmpty = !answer ||
      (typeof answer === "string" && !answer.trim()) ||
      (Array.isArray(answer) && answer.length === 0);
    if (isEmpty) {
      setError("Please provide an answer before submitting.");
      setTimeout(() => setError(""), 3000);
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const currentAttempt = questionAttempts[currentQuestionId] || 1;
      const res = await apiClient.post("/api/student/mastery/submit-answer", {
        student_id: moduleAccess.studentId,
        question_id: currentQuestionId,
        module_id: moduleId,
        document_id: question.document_id || null,
        answer: formatAnswer(question, answer),
        attempt: currentAttempt,
      });

      const data = res?.data || res || {};

      // Update queue state and progress
      setQueueState(prev =>
        prev.map(e =>
          e.question_id === currentQuestionId
            ? { ...e, streak_count: data.streak_count, is_mastered: data.is_mastered, attempts: (e.attempts || 0) + 1 }
            : e
        )
      );
      setProgress(data.progress || progress);

      // Increment attempt counter for the current question (ready for next time it appears)
      setQuestionAttempts(prev => ({
        ...prev,
        [currentQuestionId]: (prev[currentQuestionId] || 1) + 1,
      }));

      if (data.is_correct) {
        setAnswer(null);
        setShowFeedback(false);
        setWrongFeedback(null);

        if (data.all_mastered) {
          setIsCompleted(true);
        } else if (data.next_question_id) {
          setCurrentQuestionId(data.next_question_id);
        }
      } else {
        // Show hint feedback, don't advance yet
        setWrongFeedback(data.feedback);
        setShowFeedback(true);
      }
    } catch (err) {
      console.error("Submit failed:", err);
      setError(err?.response?.data?.detail || "Failed to submit answer. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── "Got it, continue" after wrong feedback ──────────────────────
  const handleContinue = () => {
    setShowFeedback(false);
    setWrongFeedback(null);
    setAnswer(null);
    // Move to next unmastered question (skip current so it comes back later in rotation)
    const nextUnmastered =
      queueState.find(e => !e.is_mastered && e.question_id !== currentQuestionId) ||
      queueState.find(e => !e.is_mastered); // only one left — same question again
    if (nextUnmastered) {
      setCurrentQuestionId(nextUnmastered.question_id);
    }
  };

  // ── Render question answer input ─────────────────────────────────
  const renderAnswerInput = (question) => {
    const type = question?.type?.toLowerCase();
    const disabled = submitting || showFeedback;

    if (type === "mcq") {
      return (
        <fieldset className="space-y-2">
          <legend className="sr-only">Choose one answer</legend>
          {question.options && Object.entries(question.options).map(([key, option]) => {
            const isSelected = answer === key;
            return (
              <div
                key={key}
                className={`flex items-center space-x-3 p-3 rounded-md border cursor-pointer transition-all ${
                  disabled ? "opacity-60 cursor-not-allowed" :
                  isSelected
                    ? "border-purple-500 bg-purple-50 dark:bg-purple-950/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
                onClick={() => !disabled && setAnswer(key)}
              >
                <input
                  type="radio"
                  value={key}
                  checked={isSelected}
                  onChange={() => {}}
                  disabled={disabled}
                  className="h-5 w-5 text-purple-600 focus:ring-purple-500 border-gray-300 cursor-pointer"
                />
                <Label className="flex-1 cursor-pointer text-base leading-relaxed">
                  <span className="font-semibold mr-3 text-purple-600">{key}.</span>
                  <span className={`whitespace-pre-wrap ${isSelected ? "text-purple-900 dark:text-purple-100" : ""}`}>{option}</span>
                </Label>
              </div>
            );
          })}
        </fieldset>
      );
    }

    if (type === "mcq_multiple") {
      return (
        <fieldset className="space-y-2">
          <legend className="sr-only">Select all correct answers</legend>
          <p className="text-sm text-gray-500 mb-2">Select all correct answers</p>
          {question.options && Object.entries(question.options).map(([key, option]) => {
            const selections = answer || [];
            const isSelected = selections.includes(key);
            return (
              <div
                key={key}
                className={`flex items-center space-x-3 p-3 rounded-md border cursor-pointer transition-all ${
                  disabled ? "opacity-60 cursor-not-allowed" :
                  isSelected ? "border-purple-500 bg-purple-50 dark:bg-purple-950/20" : "border-gray-200 dark:border-gray-700 hover:border-gray-300 hover:bg-gray-50"
                }`}
                onClick={() => {
                  if (disabled) return;
                  const next = isSelected ? selections.filter(s => s !== key) : [...selections, key];
                  setAnswer(next);
                }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                  disabled={disabled}
                  className="h-5 w-5 text-purple-600 border-gray-300 cursor-pointer"
                />
                <Label className="flex-1 cursor-pointer text-base">
                  <span className="font-semibold mr-3 text-purple-600">{key}.</span>
                  {option}
                </Label>
              </div>
            );
          })}
        </fieldset>
      );
    }

    if (type === "fill_blank") {
      const blanks = question.extended_config?.blanks || [];
      const currentBlanks = answer || {};
      const textParts = (question.text || "").split("_____");
      return (
        <div className="space-y-4">
          <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg text-lg leading-relaxed">
            {textParts.map((part, i) => (
              <span key={i}>
                {part}
                {i < textParts.length - 1 && (
                  <span className="inline-flex items-center mx-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/40 border border-purple-300 dark:border-purple-700 rounded text-purple-900 dark:text-purple-100 font-medium">
                    {currentBlanks[blanks[i]?.position] || `___${i+1}___`}
                  </span>
                )}
              </span>
            ))}
          </div>
          <div className="space-y-2">
            {blanks.map((blank, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                  {i + 1}
                </div>
                <Input
                  value={currentBlanks[blank.position] || ""}
                  onChange={e => setAnswer({ ...currentBlanks, [blank.position]: e.target.value })}
                  placeholder={`Blank ${i + 1}`}
                  disabled={disabled}
                  className="flex-1"
                />
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (type === "multi_part") {
      const subQuestions = question.extended_config?.sub_questions || [];
      const subAnswers = answer || {};
      return (
        <div className="space-y-4">
          {subQuestions.map((subQ, i) => (
            <div key={i} className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
              <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded text-sm font-medium">{subQ.id}</span>
              <p className="mt-2 mb-3 text-base">{subQ.text}</p>
              {subQ.type === "mcq" ? (
                <div className="space-y-2">
                  {subQ.options && Object.entries(subQ.options).map(([key, opt]) => {
                    const isSel = subAnswers[subQ.id] === key;
                    return (
                      <div
                        key={key}
                        className={`flex items-center space-x-3 p-2 rounded-md border cursor-pointer ${
                          disabled ? "opacity-60 cursor-not-allowed" :
                          isSel ? "border-purple-500 bg-purple-50 dark:bg-purple-950/20" : "border-gray-200 hover:border-gray-300"
                        }`}
                        onClick={() => !disabled && setAnswer({ ...subAnswers, [subQ.id]: key })}
                      >
                        <input type="radio" checked={isSel} onChange={() => {}} disabled={disabled} className="h-4 w-4 text-purple-600" />
                        <Label className="flex-1 cursor-pointer text-sm"><span className="font-semibold mr-2">{key}.</span>{opt}</Label>
                      </div>
                    );
                  })}
                </div>
              ) : subQ.type === "short" ? (
                <Input
                  value={subAnswers[subQ.id] || ""}
                  onChange={e => setAnswer({ ...subAnswers, [subQ.id]: e.target.value })}
                  placeholder="Your answer..."
                  disabled={disabled}
                />
              ) : (
                <Textarea
                  value={subAnswers[subQ.id] || ""}
                  onChange={e => setAnswer({ ...subAnswers, [subQ.id]: e.target.value })}
                  placeholder="Write your detailed answer..."
                  rows={3}
                  disabled={disabled}
                />
              )}
            </div>
          ))}
        </div>
      );
    }

    // Short / long / default text
    if (type === "short") {
      return (
        <Input
          value={answer || ""}
          onChange={e => setAnswer(e.target.value)}
          placeholder="Type your answer here..."
          disabled={disabled}
          className="text-base"
        />
      );
    }

    return (
      <Textarea
        value={answer || ""}
        onChange={e => setAnswer(e.target.value)}
        placeholder="Write your answer here..."
        rows={6}
        disabled={disabled}
        className="text-base"
      />
    );
  };

  // ── Guards ───────────────────────────────────────────────────────
  if (!isClient) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto" />
          <p className="text-gray-600 dark:text-gray-400">Loading mastery session...</p>
        </div>
      </div>
    );
  }

  if (error && !currentQuestionId) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Something went wrong</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
            <Button onClick={() => router.push(`/student/module/${moduleId}`)}>Back to Module</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Reset handler ────────────────────────────────────────────────
  const handlePracticeAgain = async () => {
    if (!moduleAccess) return;
    try {
      setLoading(true);
      await apiClient.post(
        `/api/student/modules/${moduleId}/mastery/reset?student_id=${moduleAccess.studentId}`
      );
      // Reload fresh queue
      setIsCompleted(false);
      setQueueState([]);
      setProgress({ total: 0, mastered: 0, all_mastered: false });
      setQuestionAttempts({});
      setCurrentQuestionId(null);
      setAnswer(null);
      setShowFeedback(false);
      setWrongFeedback(null);
      await loadMastery(moduleAccess);
    } catch (err) {
      setError("Failed to reset. Please try again.");
      setLoading(false);
    }
  };

  // ── Completion screen ────────────────────────────────────────────
  if (isCompleted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-gray-900 dark:to-purple-900/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center border-2 border-purple-200 dark:border-purple-800 shadow-xl">
          <CardContent className="p-8 space-y-4">
            <Trophy className="w-16 h-16 text-yellow-500 mx-auto" />
            <h2 className="text-2xl font-bold text-purple-900 dark:text-purple-100">Mastered!</h2>
            <p className="text-gray-600 dark:text-gray-400">
              You&apos;ve achieved mastery on all {progress.total} question{progress.total !== 1 ? "s" : ""} in this module.
            </p>
            <div className="flex justify-center gap-2 flex-wrap">
              <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 text-base px-4 py-1">
                <CheckCircle className="w-4 h-4 mr-2 inline" />
                {progress.total} / {progress.total} Mastered
              </Badge>
            </div>
            <div className="flex flex-col gap-2 mt-2">
              <Button
                onClick={handlePracticeAgain}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Practice Again
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push(`/student/module/${moduleId}`)}
                className="w-full"
              >
                Back to Module
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentQ = questionsMap[currentQuestionId];
  const currentQueueEntry = queueState.find(e => e.question_id === currentQuestionId);

  if (!currentQ) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-orange-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No questions available</h3>
            <Button onClick={() => router.push(`/student/module/${moduleId}`)}>Back to Module</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const typeLabel = {
    mcq: "Multiple Choice",
    mcq_multiple: "Multiple Choice (Multiple)",
    fill_blank: "Fill in the Blanks",
    multi_part: "Multi-Part",
    short: "Short Answer",
    long: "Long Answer",
  }[currentQ.type] || "Question";

  const progressPercent = progress.total > 0 ? Math.round((progress.mastered / progress.total) * 100) : 0;

  // ── Main render ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/student/module/${moduleId}`)}
                className="flex items-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" />
                Exit
              </Button>
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-purple-600" />
                <span className="font-semibold text-sm sm:text-base">{moduleAccess?.moduleName} — Mastery</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Progress */}
              <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium text-purple-700 dark:text-purple-300">
                  {progress.mastered}/{progress.total}
                </span>
                <span>mastered</span>
              </div>
              {moduleAccess?.studentId && (
                <Badge className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-mono text-xs px-3 py-1">
                  {moduleAccess.studentId}
                </Badge>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-2">
            <Progress value={progressPercent} className="h-2 bg-purple-100 dark:bg-purple-900/30 [&>div]:bg-purple-500" />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Streak indicator */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-500" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Streak: <span className="font-semibold text-purple-600">{currentQueueEntry?.streak_count || 0}</span>/{streakRequired}
            </span>
            <StreakDots current={currentQueueEntry?.streak_count || 0} required={streakRequired} />
          </div>
          <Badge variant="outline" className="text-xs border-purple-300 text-purple-700 dark:border-purple-700 dark:text-purple-300">
            {progress.mastered}/{progress.total} mastered
          </Badge>
        </div>

        {/* Error banner */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Question card */}
        <Card className="border-2 border-slate-200 dark:border-slate-700">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-indigo-50/30 dark:from-purple-900/20 dark:to-indigo-900/10 border-b">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs border-purple-300 text-purple-700 dark:border-purple-700 dark:text-purple-300">
                    {typeLabel}
                  </Badge>
                  {currentQ.bloom_taxonomy && (
                    <Badge variant="outline" className="text-xs">
                      <Brain className="w-3 h-3 mr-1 inline" />
                      {currentQ.bloom_taxonomy}
                    </Badge>
                  )}
                  {currentQ.slide_number && (
                    <span className="text-xs text-gray-500">Slide {currentQ.slide_number}</span>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-5">
            {/* Question text (skip for fill_blank — shown inline) */}
            {currentQ.type !== "fill_blank" && (
              <div className="prose dark:prose-invert max-w-none">
                <p className="text-lg leading-relaxed whitespace-pre-wrap">{currentQ.text}</p>
              </div>
            )}

            {/* Learning outcome */}
            {currentQ.learning_outcome && (
              <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-2">
                  <Target className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-blue-900 dark:text-blue-100">Learning Outcome</p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">{currentQ.learning_outcome}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Question image */}
            {currentQ.image_url && (
              <div className="bg-gray-50 dark:bg-gray-800 border rounded-lg p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentQ.image_url}
                  alt={`Visual for question`}
                  className="max-w-full mx-auto rounded object-contain"
                  style={{ maxHeight: "320px" }}
                />
              </div>
            )}

            {/* Answer input */}
            <div className="space-y-2">
              <Label className="text-base font-medium">Your Answer:</Label>
              {renderAnswerInput(currentQ)}
            </div>

            {/* Wrong-answer feedback panel */}
            {showFeedback && wrongFeedback && (
              <div className="border-2 border-red-200 dark:border-red-800 rounded-lg overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-950/20 border-b border-red-200 dark:border-red-800">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-semibold text-red-700 dark:text-red-300">Not quite — here&apos;s a hint</span>
                </div>
                <div className="p-4 space-y-3">
                  {wrongFeedback.explanation && (
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{wrongFeedback.explanation}</p>
                  )}
                  {wrongFeedback.improvement_hint && (
                    <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                      <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-1">Hint</p>
                      <p className="text-sm text-amber-700 dark:text-amber-300">{wrongFeedback.improvement_hint}</p>
                    </div>
                  )}
                  {wrongFeedback.concept_explanation && (
                    <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                      <p className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">Concept</p>
                      <p className="text-sm text-blue-700 dark:text-blue-300">{wrongFeedback.concept_explanation}</p>
                    </div>
                  )}
                  <Button
                    onClick={handleContinue}
                    className="w-full bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white mt-2"
                  >
                    Got it, continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Submit button (hidden while feedback is showing) */}
            {!showFeedback && (
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white h-11 text-base"
              >
                {submitting ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Checking...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Submit Answer
                  </div>
                )}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Queue overview (collapsed summary) */}
        <Card className="border border-slate-200 dark:border-slate-700">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium uppercase tracking-wide">Progress Overview</p>
            <div className="flex flex-wrap gap-1.5">
              {queueState.map((entry, i) => {
                const isCurrent = entry.question_id === currentQuestionId;
                return (
                  <div
                    key={entry.question_id}
                    title={`Q${i + 1} — streak: ${entry.streak_count}/${streakRequired}`}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold border-2 transition-all ${
                      entry.is_mastered
                        ? "bg-purple-100 border-purple-400 text-purple-700 dark:bg-purple-900/40 dark:border-purple-600 dark:text-purple-300"
                        : isCurrent
                        ? "bg-blue-100 border-blue-500 text-blue-700 dark:bg-blue-900/40 dark:border-blue-500 dark:text-blue-300 ring-2 ring-blue-300"
                        : "bg-gray-100 border-gray-300 text-gray-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400"
                    }`}
                  >
                    {entry.is_mastered ? "✓" : i + 1}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

export default MasteryPage;
