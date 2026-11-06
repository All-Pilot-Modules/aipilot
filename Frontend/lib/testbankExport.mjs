export function buildQuestionsRTF(questions, moduleName) {
    const esc = (s) => (s || '')
      .replace(/\\/g, '\\\\')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/\r?\n/g, '\\line ')
      .replace(/[^\x00-\x7F]/g, c => `\\u${c.charCodeAt(0) > 32767 ? c.charCodeAt(0) - 65536 : c.charCodeAt(0)}?`);
    const toLetter = (key) => (key || '').toLowerCase();

    let body = `\\pard\\sb0\\sa120\\b\\fs28 ${esc(moduleName)} \u2013 Questions\\b0\\fs26\\par\n`;
    body += `\\pard\\sb0\\sa240\\cf1 ${questions.length} question${questions.length !== 1 ? 's' : ''} \u00b7 exported ${new Date().toLocaleDateString()}\\cf0\\par\n`;

    questions.forEach((q, i) => {
      body += `\\pard\\sb240\\sa0\\b ${i + 1}. ${esc(q.text)}\\b0\\par\n`;

      if ((q.type === 'mcq' || q.type === 'mcq_multiple') && q.options && typeof q.options === 'object') {
        const correctIds = q.type === 'mcq_multiple'
          ? (q.extended_config?.correct_option_ids || [])
          : [q.correct_option_id || q.correct_answer];
        Object.entries(q.options).forEach(([key, text]) => {
          body += `\\pard\\sb60\\sa0 ${toLetter(key)}. ${esc(text)}\\par\n`;
        });
        const answerLabels = correctIds.filter(Boolean).map(toLetter).join(', ');
        if (answerLabels) body += `\\pard\\sb100\\sa0\\b Answer: ${answerLabels}\\b0\\par\n`;
      } else if (q.type === 'fill_blank' && q.extended_config?.blanks?.length) {
        q.extended_config.blanks.forEach((_, bi) => {
          body += `\\pard\\sb60\\sa0 Blank ${bi + 1}: ___\\par\n`;
        });
        const blankAnswers = q.extended_config.blanks.map((blank, bi) =>
          `Blank ${bi + 1}: ${(blank.correct_answers || []).join(' / ')}`
        ).join('  ');
        body += `\\pard\\sb100\\sa0\\b Answer: ${esc(blankAnswers)}\\b0\\par\n`;
      } else if (q.type === 'multi_part' && q.extended_config?.sub_questions?.length) {
        q.extended_config.sub_questions.forEach(sq => {
          body += `\\pard\\sb120\\sa0\\li360\\b ${esc(sq.id)}. ${esc(sq.text)}\\b0\\par\n`;
          if (sq.type === 'mcq' && sq.options && typeof sq.options === 'object') {
            Object.entries(sq.options).forEach(([key, text]) => {
              body += `\\pard\\sb40\\sa0\\li720 ${toLetter(key)}. ${esc(text)}\\par\n`;
            });
            if (sq.correct_option_id) body += `\\pard\\sb80\\sa0\\li720\\b Answer: ${toLetter(sq.correct_option_id)}\\b0\\par\n`;
          } else if (sq.correct_answer) {
            body += `\\pard\\sb80\\sa0\\li720\\b Answer: ${esc(sq.correct_answer)}\\b0\\par\n`;
          }
        });
      } else if (q.correct_answer) {
        body += `\\pard\\sb100\\sa0\\b Answer: ${esc(q.correct_answer)}\\b0\\par\n`;
      }

      body += `\\pard\\sb200\\sa0\\brdrb\\brdrs\\brdrw10 \\par\n`;
    });

    return `{\\rtf1\\ansi\\deff0\n{\\fonttbl{\\f0\\fswiss\\fcharset0 Arial;}}\n{\\colortbl;\\red120\\green120\\blue120;}\n\\f0\\fs26\\widowctrl\n${body}}`;
  }
