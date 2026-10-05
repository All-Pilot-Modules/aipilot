// Normalize standard LaTeX delimiters to remark-math syntax. Leave Markdown
// code spans/fences alone so examples of source code stay readable.
export function normalizeMathText(text = '') {
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
