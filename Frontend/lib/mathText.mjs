// Feedback stored before the backend JSON fix had LaTeX backslashes eaten as
// JSON escapes: \frac became form feed + "rac", \right carriage return +
// "ight". Those control characters never belong in feedback text, so turn
// them back into the command. Tab/newline are real prose characters, so they
// are restored only before unambiguous command names.
export function repairEscapedLatex(text) {
  return text
    .replace(/\f/g, '\\f')
    .replace(/\x08/g, '\\b')
    .replace(/\r(?=[A-Za-z])/g, '\\r')
    .replace(/\t(?=(?:heta|au|imes|ext[a-z]*|frac|ilde|riangle)(?![A-Za-z]))/g, '\\t')
    .replace(/\n(?=(?:abla|eq|eg|mid|ewline)(?![A-Za-z]))/g, '\\n');
}

// Normalize standard LaTeX delimiters to remark-math syntax. Leave Markdown
// code spans/fences alone so examples of source code stay readable.
export function normalizeMathText(text = '') {
  text = repairEscapedLatex(text);
  const normalized = text.split(/(```[\s\S]*?```|`[^`\n]*`)/g).map((part, i) => {
    if (i % 2) return part;
    return part.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => `\n\n$$\n${math.trim()}\n$$\n\n`)
      .replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => `$${math.trim()}$`);
  }).join('');
  if (normalized.includes('$') || normalized.includes('`')) return normalized;
  // Legacy bare expressions may start with a command. Never wrap an entire
  // prose sentence just because it contains a backslash somewhere inside it.
  return /^\s*\\[a-zA-Z]+/.test(normalized) ? `$$\n${normalized.trim()}\n$$` : normalized;
}
