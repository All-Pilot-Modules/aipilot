export function splitAnswer(value) {
  const parts = [];
  const pattern = /\$\$([\s\S]*?)\$\$|\$([^$\n]+)\$|\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)/g;
  let start = 0;
  for (const match of (value || '').matchAll(pattern)) {
    parts.push({ type: 'text', value: value.slice(start, match.index) });
    parts.push({ type: 'math', value: match[1] ?? match[2] ?? match[3] ?? match[4] });
    start = match.index + match[0].length;
  }
  parts.push({ type: 'text', value: (value || '').slice(start) });
  return parts;
}

