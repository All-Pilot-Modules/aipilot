'use client';
// Static visual-QA harness for the Math Question Editor. Renders
// MathQuestionEditorBody directly (no Dialog/Portal) with asDialog=false so
// it's plain SSR'd markup — visible via `curl` or a screenshot even in an
// environment where client-side hydration isn't available. Not wired for
// interaction; setQuestionForm is a no-op.
import { useState } from "react";
import { StudentAnswerField } from "@/components/StudentAnswerField";
import { Button } from "@/components/ui/button";
import { MathQuestionEditorDialog, MathQuestionEditorBody } from "@/components/MathQuestionEditorDialog";

const MCQ = {
  type: "mcq",
  text: "If $f(x) = x^2 - 4x + 3$, what is the value of $f(2)$?",
  points: "2.0",
  options: ["$-1$", "$0$", "$1$", "$4$"],
  correct_answer: "",
  correct_option_id: "A",
  image_url: "",
  correct_option_ids: [],
};

const MCQ_MULTIPLE = {
  ...MCQ,
  type: "mcq_multiple",
  text: "Which of the following are prime numbers? $$2, 9, 11, 15$$",
  options: ["$2$", "$9$", "$11$", "$15$"],
  correct_option_id: "",
  correct_option_ids: ["A", "C"],
};

const SHORT = {
  type: "short",
  text: "Solve for $x$: $2x + 3 = 11$",
  points: "1.5",
  options: ["", "", "", ""],
  correct_answer: "$x = 4$",
  correct_option_id: "",
  image_url: "",
  correct_option_ids: [],
};

const EMPTY = {
  type: "mcq",
  text: "",
  points: "1.0",
  options: ["", "", "", ""],
  correct_answer: "",
  correct_option_id: "",
  image_url: "",
  correct_option_ids: [],
};

const BROKEN_LATEX = {
  ...MCQ,
  text: "Simplify $\\frac{1}{2 + $ and explain why it's undefined.",
};

function Case({ title, form }) {
  return (
    <div className="mb-16">
      <div className="sticky top-0 z-20 bg-yellow-200 px-3 py-1 text-sm font-bold text-black">{title}</div>
      <div className="relative flex h-[1000px] w-full flex-col border-4 border-dashed border-red-400">
        <MathQuestionEditorBody questionForm={form} setQuestionForm={() => {}} onDone={() => {}} asDialog={false} />
      </div>
    </div>
  );
}

function InteractiveHarness() {
  const [open, setOpen] = useState(false);
  const [questionForm, setQuestionForm] = useState(MCQ);
  const [submitting, setSubmitting] = useState(false);
  const [log, setLog] = useState("");

  const handleTypeChange = (value) => {
    setQuestionForm({
      ...questionForm,
      type: value,
      blanks: value === "fill_blank" ? (questionForm.blanks || []) : [],
      correct_option_ids: value === "mcq_multiple" ? (questionForm.correct_option_ids || []) : [],
      sub_questions: value === "multi_part" ? (questionForm.sub_questions || []) : [],
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 600));
    setSubmitting(false);
    setLog(`Submitted at ${new Date().toLocaleTimeString()}: ${JSON.stringify(questionForm).slice(0, 80)}...`);
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-2 p-8">
      <div className="flex gap-2">
        <Button onClick={() => { setQuestionForm(MCQ); setOpen(true); }}>Open: MCQ</Button>
        <Button variant="outline" onClick={() => { setQuestionForm(MCQ_MULTIPLE); setOpen(true); }}>Open: MCQ multi</Button>
        <Button variant="outline" onClick={() => { setQuestionForm(SHORT); setOpen(true); }}>Open: Short</Button>
        <Button variant="outline" onClick={() => { setQuestionForm(EMPTY); setOpen(true); }}>Open: Empty</Button>
      </div>
      {log && <p className="text-xs text-muted-foreground">{log}</p>}
      <MathQuestionEditorDialog
        open={open}
        onOpenChange={setOpen}
        questionForm={questionForm}
        setQuestionForm={setQuestionForm}
        onTypeChange={handleTypeChange}
        onSubmit={handleSubmit}
        submitLabel="Create Question"
        isSubmitting={submitting}
      />
    </div>
  );
}

export default function DevMathTest() {
  const [studentAnswer, setStudentAnswer] = useState("");
  return (
    <div className="bg-neutral-100 py-8">
      <section className="mx-auto mb-8 max-w-3xl rounded-xl bg-background p-6">
        <h2 className="mb-4 text-lg font-semibold">Student equation editor</h2>
        <StudentAnswerField value={studentAnswer} onChange={setStudentAnswer} />
      </section>
      <InteractiveHarness />
      <Case title="MCQ (seeded)" form={MCQ} />
      <Case title="MCQ multiple-select" form={MCQ_MULTIPLE} />
      <Case title="Short answer" form={SHORT} />
      <Case title="Empty MCQ" form={EMPTY} />
      <Case title="Broken LaTeX (unbalanced brace)" form={BROKEN_LATEX} />
    </div>
  );
}
