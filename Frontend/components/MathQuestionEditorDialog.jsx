'use client';

import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EquationField } from "@/components/EquationField";
import { MathText } from "@/components/MathText";
import {
  Sigma,
  CircleCheck,
  Eye,
  FileQuestion,
  ListChecks,
  MessageSquareText,
  Trophy,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

const OPTION_LABELS = ["A", "B", "C", "D", "E", "F"];

function Section({ icon: Icon, title, required, children }) {
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {required && <span className="text-xs font-medium text-red-500">Required</span>}
      </div>
      {children}
    </section>
  );
}

// Assembled, read-only rendering of the question exactly as MathText (the
// same component used everywhere else in the app) will typeset it for a
// student — as opposed to the per-field previews in each EquationField,
// which only show one fragment at a time.
function LivePreview({ questionForm, isMcq, showOptions, showCorrectAnswer }) {
  const hasAnyOption = questionForm.options?.some((o) => o?.trim());

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-3">
        <Eye className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Student Preview</h3>
        <span className="text-xs text-muted-foreground">(with answer key)</span>
      </div>

      <div className="space-y-4 p-5">
        {questionForm.points && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
            <Trophy className="h-3.5 w-3.5" />
            {questionForm.points} {Number(questionForm.points) === 1 ? "point" : "points"}
          </div>
        )}

        {questionForm.text?.trim() ? (
          <MathText className="text-[15px] font-medium leading-relaxed text-foreground">{questionForm.text}</MathText>
        ) : (
          <p className="text-sm italic text-muted-foreground">
            Start typing the question stem on the left — it&apos;ll appear here exactly as a student sees it.
          </p>
        )}

        {questionForm.image_url && (
          <img
            src={questionForm.image_url}
            alt="Question illustration"
            className="max-h-56 rounded-lg border border-border object-contain"
          />
        )}

        {showOptions && hasAnyOption && (
          <div className="space-y-2">
            {questionForm.options.map((option, index) => {
              if (!option?.trim()) return null;
              const letter = OPTION_LABELS[index] || String(index + 1);
              const isCorrect = isMcq
                ? questionForm.correct_option_id === letter
                : (questionForm.correct_option_ids || []).includes(letter);
              const highlight = isCorrect;
              return (
                <div
                  key={index}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-3 py-2",
                    highlight
                      ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30"
                      : "border-border"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      highlight ? "bg-green-600 text-white" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {letter}
                  </span>
                  <MathText inline className="flex-1 min-w-0 text-sm">
                    {option}
                  </MathText>
                  {highlight && <CircleCheck className="h-4 w-4 flex-shrink-0 text-green-600" />}
                </div>
              );
            })}
          </div>
        )}

        {showCorrectAnswer && questionForm.correct_answer?.trim() && (
          <div className="rounded-lg border border-green-300 bg-green-50 px-3 py-2 dark:border-green-800 dark:bg-green-950/30">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-green-700 dark:text-green-400">
              Sample correct answer
            </p>
            <MathText className="text-sm text-foreground">{questionForm.correct_answer}</MathText>
          </div>
        )}
      </div>
    </div>
  );
}

// The header title/description double as plain tags when rendered outside a
// Dialog (see MathQuestionEditorBody's `asDialog` prop) — Radix's
// DialogTitle/DialogDescription require a Dialog.Root ancestor, which isn't
// present when this body is previewed standalone.
function HeaderTitle({ asDialog, className, children }) {
  return asDialog ? (
    <DialogTitle className={className}>{children}</DialogTitle>
  ) : (
    <h2 className={className}>{children}</h2>
  );
}

function HeaderDescription({ asDialog, children }) {
  return asDialog ? (
    <DialogDescription className="sr-only">{children}</DialogDescription>
  ) : (
    <p className="sr-only">{children}</p>
  );
}

// The actual editor UI: sticky header + two-column (fields / live preview)
// body. Split out from MathQuestionEditorDialog so it can be rendered
// standalone (asDialog=false) wherever a Dialog.Root isn't available.
export function MathQuestionEditorBody({
  questionForm,
  setQuestionForm,
  onDone,
  onSubmit,
  onTypeChange,
  submitLabel = "Done",
  isSubmitting = false,
  asDialog = true,
}) {
  const updateOption = (index, newValue) => {
    const options = [...questionForm.options];
    options[index] = newValue;
    setQuestionForm({ ...questionForm, options });
  };

  const isMcq = questionForm.type === "mcq";
  const isMcqMultiple = questionForm.type === "mcq_multiple";
  const showOptions = isMcq || isMcqMultiple;
  const showCorrectAnswer = questionForm.type === "short" || questionForm.type === "long";
  const isUnsupportedType = !showOptions && !showCorrectAnswer;

  const toggleMultiCorrect = (letter) => {
    const current = questionForm.correct_option_ids || [];
    const next = current.includes(letter)
      ? current.filter((id) => id !== letter)
      : [...current, letter];
    setQuestionForm({ ...questionForm, correct_option_ids: next });
  };

  const filledOptions = questionForm.options?.filter((o) => o?.trim()).length || 0;
  const statusItems = [{ label: "Question text", ok: !!questionForm.text?.trim() }];
  if (showOptions) {
    statusItems.push({ label: "Options", ok: filledOptions >= 2 });
    statusItems.push({
      label: "Correct answer",
      ok: isMcq ? !!questionForm.correct_option_id : (questionForm.correct_option_ids || []).length > 0,
    });
  }

  return (
    <>
      <HeaderDescription asDialog={asDialog}>
        Edit this question&apos;s text, options, and correct answer using LaTeX math notation, with a live preview
        of exactly how students will see it.
      </HeaderDescription>

      {/* Sticky header: stays reachable without scrolling to the bottom */}
      <div className="flex-shrink-0 border-b border-border bg-background/95 px-6 py-4 pr-16 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gray-900 text-white dark:bg-gray-800">
              <Sigma className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <HeaderTitle asDialog={asDialog} className="text-base leading-tight">
                Math Question Editor
              </HeaderTitle>
              <p className="truncate text-xs text-muted-foreground">
                Use <code className="rounded bg-muted px-1 py-0.5">$...$</code> for inline math or{" "}
                <code className="rounded bg-muted px-1 py-0.5">$$...$$</code> for a block equation.
                </p>
              </div>
              <Select value={questionForm.type} onValueChange={onTypeChange}>
                <SelectTrigger size="sm" className="w-auto flex-shrink-0 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mcq">Multiple Choice (Single Answer)</SelectItem>
                  <SelectItem value="mcq_multiple">Multiple Choice (Multiple Answers)</SelectItem>
                  <SelectItem value="fill_blank">Fill in the Blanks</SelectItem>
                  <SelectItem value="short">Short Answer</SelectItem>
                  <SelectItem value="long">Long Answer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-shrink-0 items-center gap-4">
              <div className="hidden items-center gap-3 lg:flex">
                {statusItems.map((item) => (
                  <span
                    key={item.label}
                    className={cn(
                      "flex items-center gap-1.5 text-xs font-medium",
                      item.ok ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                    )}
                  >
                    {item.ok ? (
                      <CircleCheck className="h-3.5 w-3.5" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                    )}
                    {item.label}
                  </span>
                ))}
              </div>
              <Button type="button" onClick={onSubmit || onDone} disabled={isSubmitting}>
                {isSubmitting ? "Saving…" : submitLabel}
              </Button>
            </div>
          </div>
        </div>
      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-w-0 space-y-5">
              <Section icon={FileQuestion} title="Question Stem" required>
                <EquationField
                  value={questionForm.text}
                  onChange={(v) => setQuestionForm({ ...questionForm, text: v })}
                  placeholder="Enter your question... e.g. Solve $x^2 = 4$"
                  rows={3}
                />
              </Section>

              {showOptions && (
                <Section icon={ListChecks} title="Answer Options" required>
                  <div className="space-y-4">
                    {questionForm.options.map((option, index) => (
                      <EquationField
                        key={index}
                        label={`Option ${OPTION_LABELS[index] || index + 1}`}
                        value={option}
                        onChange={(v) => updateOption(index, v)}
                        placeholder={`Option ${OPTION_LABELS[index] || index + 1}`}
                        rows={1}
                      />
                    ))}
                  </div>

                  <div className="space-y-2 pt-1">
                    <Label className="text-[13px]">
                      {isMcq ? "Correct Answer" : "Correct Answers (select all that apply)"}
                    </Label>
                    <div className="space-y-2 rounded-lg border border-border p-3">
                      {questionForm.options.map((option, index) => {
                        const letter = OPTION_LABELS[index] || String(index + 1);
                        const isCorrect = isMcq
                          ? questionForm.correct_option_id === letter
                          : (questionForm.correct_option_ids || []).includes(letter);
                        const onSelect = () =>
                          isMcq
                            ? setQuestionForm({ ...questionForm, correct_option_id: letter })
                            : toggleMultiCorrect(letter);
                        return (
                          <button
                            key={letter}
                            type="button"
                            onClick={onSelect}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors",
                              isCorrect
                                ? "border-green-400 bg-green-50 dark:border-green-700 dark:bg-green-950/40"
                                : "border-border hover:bg-muted/40"
                            )}
                          >
                            <span
                              className={cn(
                                "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold",
                                isCorrect ? "bg-green-600 text-white" : "bg-muted text-muted-foreground"
                              )}
                            >
                              {letter}
                            </span>
                            <span className="min-w-0 flex-1">
                              {option?.trim() ? (
                                <MathText inline>{option}</MathText>
                              ) : (
                                <span className="text-sm italic text-muted-foreground">(empty)</span>
                              )}
                            </span>
                            {isCorrect && <CircleCheck className="h-4 w-4 flex-shrink-0 text-green-600" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </Section>
              )}

              {showCorrectAnswer && (
                <Section icon={MessageSquareText} title="Correct Answer">
                  <EquationField
                    value={questionForm.correct_answer}
                    onChange={(v) => setQuestionForm({ ...questionForm, correct_answer: v })}
                    placeholder="Expected answer"
                    rows={3}
                  />
                </Section>
              )}

              {isUnsupportedType && (
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
                  <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <p>
                    Fill-in-the-blank and multi-part fields aren&apos;t wired into the math editor yet — edit those
                    in the regular form.
                  </p>
                </div>
              )}
            </div>

            <div className="lg:sticky lg:top-6">
              <LivePreview
                questionForm={questionForm}
                isMcq={isMcq}
                showOptions={showOptions}
                showCorrectAnswer={showCorrectAnswer}
              />
            </div>
          </div>
        </div>
    </>
  );
}

// Thin wrapper: puts MathQuestionEditorBody inside the full-screen Dialog
// used in production. Reads/writes questionForm in place, so every edit is
// already saved — "Done" just closes the dialog, it never discards anything.
export function MathQuestionEditorDialog({
  open,
  onOpenChange,
  questionForm,
  setQuestionForm,
  onSubmit,
  onTypeChange,
  submitLabel,
  isSubmitting,
}) {
  if (!questionForm) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 top-0 left-0 sm:rounded-none">
        <MathQuestionEditorBody
          questionForm={questionForm}
          setQuestionForm={setQuestionForm}
          onDone={() => onOpenChange(false)}
          onSubmit={onSubmit}
          onTypeChange={onTypeChange}
          submitLabel={submitLabel}
          isSubmitting={isSubmitting}
        />
      </DialogContent>
    </Dialog>
  );
}
