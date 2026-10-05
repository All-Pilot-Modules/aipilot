'use client';

import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from "@/components/ui/dropdown-menu";
import { MathText } from "@/components/MathText";
import { Eye, EyeOff, Sigma, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

// Scratch pad for symbols/fractions/matrices/etc: a disposable MathLive
// <math-field> whose own virtual keyboard does the work (fractions, roots,
// Greek letters, matrices, trig functions — the real palette, not a
// hand-picked subset of it), rather than us re-implementing a toolbar.
// Build the expression visually, hit Insert, and only its LaTeX lands in the
// field at the cursor — the scratch pad itself is thrown away afterward.
function MathSymbolPicker({ onInsert }) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const scratchRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    import("mathlive").then(() => {
      if (mounted) setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!open || !ready) return;
    const el = scratchRef.current;
    if (!el) return;
    el.value = "";
    const raf = requestAnimationFrame(() => {
      el.focus();
      window.mathVirtualKeyboard?.show({ animate: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [open, ready]);

  const close = () => {
    setOpen(false);
    window.mathVirtualKeyboard?.hide();
  };

  const handleInsert = () => {
    const latex = scratchRef.current?.value?.trim();
    if (latex) onInsert(latex);
    close();
  };

  return (
    <DropdownMenu open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          tabIndex={-1}
          className="flex h-6 items-center gap-1.5 rounded px-2 text-xs font-medium text-foreground/75 hover:bg-background hover:text-foreground hover:shadow-sm transition-colors"
        >
          <Sigma className="h-3.5 w-3.5" />
          Insert symbol, fraction, matrix…
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[340px] p-3">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Build it below, then insert
        </p>
        <div className="rounded-md border border-border px-2 py-2">
          {ready ? (
            // eslint-disable-next-line react/no-unknown-property
            <math-field
              ref={scratchRef}
              math-virtual-keyboard-policy="manual"
              style={{ width: "100%", minHeight: "2.25rem", fontSize: "1.15rem", display: "block" }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" className="h-7" onClick={close}>
            Cancel
          </Button>
          <Button type="button" size="sm" className="h-7" onClick={handleInsert}>
            Insert
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// One box to type or click-build LaTeX in. The rendered result stays out of
// the way by default — hover the eye icon for a quick peek, or click it to
// pin a small preview below while you work on something longer.
export function EquationField({ label, value, onChange, placeholder, rows = 3, disabled = false, id }) {
  const [hasError, setHasError] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef(null);
  const previewRef = useRef(null);

  // Flag LaTeX that KaTeX couldn't parse (rehype-katex renders a red
  // `.katex-error` span instead of throwing) so a teacher notices immediately
  // instead of shipping a broken equation to students. The preview stays
  // mounted (just visually hidden) when collapsed so this check keeps working.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setHasError(!!previewRef.current?.querySelector(".katex-error"));
    });
    return () => cancelAnimationFrame(raf);
  }, [value]);

  // Splices `snippet` in at the textarea's current (or last-known, even
  // right after it lost focus to the popover) cursor position. Wrapped in
  // $...$ here — at insertion, not on blur — so math built with the picker
  // is always delimited while surrounding prose is never touched. This
  // field mixes prose and math now (reused for general student short/long
  // answers, not just the original math-only teacher editor), so there's
  // no "wrap everything without a $" blur behavior anymore — that used to
  // turn a plain-English answer into a broken math block the moment the
  // student clicked away.
  const insertAtCursor = (snippet) => {
    const el = textareaRef.current;
    const current = value || "";
    const start = el ? el.selectionStart ?? current.length : current.length;
    const end = el ? el.selectionEnd ?? current.length : current.length;
    const delimited = `$${snippet}$`;
    const cursorPos = start + delimited.length;

    onChange(current.slice(0, start) + delimited + current.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(cursorPos, cursorPos);
    });
  };

  const preview = value?.trim() ? (
    <MathText>{value}</MathText>
  ) : (
    <span className="text-sm italic text-muted-foreground">Nothing to preview yet</span>
  );

  return (
    <div className="space-y-1">
      {label && <Label className="text-[13px]">{label}</Label>}

      <div
        className={cn(
          "rounded-lg border border-border overflow-hidden focus-within:ring-2 focus-within:ring-ring/40 focus-within:border-ring/60 transition-colors",
          disabled && "opacity-60"
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-1.5 py-1">
          {!disabled && <MathSymbolPicker onInsert={insertAtCursor} />}
          {disabled && <span />}

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPreview((v) => !v)}
                className={cn(
                  "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded transition-colors",
                  hasError
                    ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                    : showPreview
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background hover:text-foreground"
                )}
              >
                {showPreview ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-sm">
              {hasError ? "LaTeX error — click to see what's broken" : preview}
            </TooltipContent>
          </Tooltip>
        </div>
        <Textarea
          id={id}
          ref={textareaRef}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
          spellCheck={true}
          className="rounded-none border-0 font-mono text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>

      <div
        ref={previewRef}
        className={cn(
          "items-start gap-2 rounded px-2 py-1",
          showPreview ? "flex" : "hidden",
          hasError ? "border border-red-300 bg-red-50/50 dark:border-red-900 dark:bg-red-950/10" : "bg-muted/20"
        )}
      >
        <span className="mt-0.5 flex-shrink-0 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
          Renders as
        </span>
        <div className="min-w-0 flex-1 text-sm">{preview}</div>
      </div>

      {hasError && (
        <p className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
          <TriangleAlert className="h-3.5 w-3.5 flex-shrink-0" />
          Part of this didn&apos;t render — check the LaTeX for a typo.
        </p>
      )}
    </div>
  );
}
