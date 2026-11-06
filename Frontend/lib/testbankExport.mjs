// Every export format is rendered from the same lines, so RTF and PDF carry
// identical text and re-import through Backend/app/utils/question_parser.py
// the same way. Spacing is in twips (1/20 pt), the unit RTF uses.

// Written to the PDF "Creator" field; the backend reads PDFs carrying it with
// its exact text extractor instead of the layout model. Keep both in sync.
export const EXPORT_PDF_CREATOR = 'AI Pilot testbank export v1';

export function buildQuestionExportLines(questions, moduleName) {
  const toLetter = (key) => (key || '').toLowerCase();
  const lines = [];
  const add = (text, { bold = false, before = 60, indent = 0, style = 'body' } = {}) =>
    lines.push({ text, bold, before, indent, style });

  add(`${moduleName} \u2013 Questions`, { bold: true, before: 0, style: 'title' });
  add(`${questions.length} question${questions.length !== 1 ? 's' : ''} \u00b7 exported ${new Date().toLocaleDateString()}`, { before: 120, style: 'meta' });

  questions.forEach((q, i) => {
    add(`${i + 1}. ${q.text || ''}`, { bold: true, before: 240 });

    if ((q.type === 'mcq' || q.type === 'mcq_multiple') && q.options && typeof q.options === 'object') {
      const correctIds = q.type === 'mcq_multiple'
        ? (q.extended_config?.correct_option_ids || [])
        : [q.correct_option_id || q.correct_answer];
      Object.entries(q.options).forEach(([key, text]) => add(`${toLetter(key)}. ${text}`));
      const answerLabels = correctIds.filter(Boolean).map(toLetter).join(', ');
      if (answerLabels) add(`Answer: ${answerLabels}`, { bold: true, before: 100 });
    } else if (q.type === 'fill_blank' && q.extended_config?.blanks?.length) {
      q.extended_config.blanks.forEach((_, bi) => add(`Blank ${bi + 1}: ___`));
      const blankAnswers = q.extended_config.blanks.map((blank, bi) =>
        `Blank ${bi + 1}: ${(blank.correct_answers || []).join(' / ')}`
      ).join('  ');
      add(`Answer: ${blankAnswers}`, { bold: true, before: 100 });
    } else if (q.type === 'multi_part' && q.extended_config?.sub_questions?.length) {
      q.extended_config.sub_questions.forEach(sq => {
        // "Part" keeps sub-questions distinct from "a. option" lines on re-import.
        add(`Part ${sq.id}: ${sq.text}`, { bold: true, before: 120, indent: 360 });
        if (sq.type === 'mcq' && sq.options && typeof sq.options === 'object') {
          Object.entries(sq.options).forEach(([key, text]) => add(`${toLetter(key)}. ${text}`, { before: 40, indent: 720 }));
          if (sq.correct_option_id) add(`Answer: ${toLetter(sq.correct_option_id)}`, { bold: true, before: 80, indent: 720 });
        } else if (sq.correct_answer) {
          add(`Answer: ${sq.correct_answer}`, { bold: true, before: 80, indent: 720 });
        }
      });
    } else if (q.correct_answer) {
      add(`Answer: ${q.correct_answer}`, { bold: true, before: 100 });
    }

    lines.push({ rule: true });
  });
  return lines;
}

export function buildQuestionsRTF(questions, moduleName) {
  const esc = (s) => (s || '')
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\r?\n/g, '\\line ')
    .replace(/[^\x00-\x7F]/g, c => `\\u${c.charCodeAt(0) > 32767 ? c.charCodeAt(0) - 65536 : c.charCodeAt(0)}?`);

  const body = buildQuestionExportLines(questions, moduleName).map(line => {
    if (line.rule) return `\\pard\\sb200\\sa0\\brdrb\\brdrs\\brdrw10 \\par\n`;
    const indent = line.indent ? `\\li${line.indent}` : '';
    const text = esc(line.text);
    if (line.style === 'title') return `\\pard\\sb0\\sa120\\b\\fs28 ${text}\\b0\\fs26\\par\n`;
    if (line.style === 'meta') return `\\pard\\sb0\\sa240\\cf1 ${text}\\cf0\\par\n`;
    return line.bold
      ? `\\pard\\sb${line.before}\\sa0${indent}\\b ${text}\\b0\\par\n`
      : `\\pard\\sb${line.before}\\sa0${indent} ${text}\\par\n`;
  }).join('');

  return `{\\rtf1\\ansi\\deff0\n{\\fonttbl{\\f0\\fswiss\\fcharset0 Arial;}}\n{\\colortbl;\\red120\\green120\\blue120;}\n\\f0\\fs26\\widowctrl\n${body}}`;
}

// pdfmake document definition (no headers or footers: they would be read back
// as part of the last answer on each page).
export function buildQuestionsPdfDefinition(questions, moduleName) {
  const pt = twips => twips / 20;
  const content = buildQuestionExportLines(questions, moduleName).map(line => {
    if (line.rule) {
      return { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#cccccc' }], margin: [0, 10, 0, 0] };
    }
    if (line.style === 'title') return { text: line.text, bold: true, fontSize: 16, margin: [0, 0, 0, 4] };
    if (line.style === 'meta') return { text: line.text, color: '#787878', fontSize: 10, margin: [0, 0, 0, 12] };
    return { text: line.text, bold: line.bold, margin: [pt(line.indent), pt(line.before), 0, 0] };
  });
  return {
    info: { title: `${moduleName} – Questions`, creator: EXPORT_PDF_CREATOR, producer: EXPORT_PDF_CREATOR },
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 40],
    defaultStyle: { fontSize: 12, lineHeight: 1.25 },
    content,
  };
}
