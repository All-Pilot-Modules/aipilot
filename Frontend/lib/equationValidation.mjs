import katex from 'katex';

// MathLive templates contain editable slots that KaTeX cannot typeset.
// Never silently replace a missing operand or matrix cell with a value.
export function equationError(latex = '') {
  if (!latex.trim()) return 'Enter an equation before inserting it.';
  if (/\\placeholder\b/.test(latex)) {
    return 'Fill in every empty box before inserting the equation, including each matrix cell.';
  }
  try {
    katex.renderToString(latex, { throwOnError: true, strict: false, trust: false });
    return null;
  } catch {
    return 'This equation cannot be displayed yet. Check its commands and complete any missing values.';
  }
}
