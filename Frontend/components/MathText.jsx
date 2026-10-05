import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { cn } from "@/lib/utils";

import { normalizeMathText } from "@/lib/mathText.mjs";

// Renders text containing $inline$ or $$block$$ LaTeX as typeset math.
// Plain text with no $ delimiters renders unchanged.
// Pass `inline` when embedding inside a <span>/<p> (e.g. an MCQ option chip)
// so it doesn't emit a block-level <p>, which isn't valid inside those.
export function MathText({ children, className, inline = false }) {
  if (!children) return null;

  const Wrapper = inline ? "span" : "div";

  return (
    <Wrapper className={cn("text-sm leading-relaxed [&_.katex-display]:my-2", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
        components={inline ? { p: "span" } : undefined}
      >
        {normalizeMathText(children)}
      </ReactMarkdown>
    </Wrapper>
  );
}
