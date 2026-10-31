import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMathText } from '../../lib/mathText.mjs';
import katex from 'katex';

test('question prose and parenthesized expressions render independently', () => {
 const source = String.raw`What is the maximum of \(f(x,y)=x^2+2y^2-x\) on \(D=\{(x,y)\mid x^2+y^2\le 1\}\)?`;
 const normalized = normalizeMathText(source);
 assert.ok(normalized.startsWith('What is'));
 const expressions = [...normalized.matchAll(/\$([^$]+)\$/g)];
 assert.equal(expressions.length, 2);
 for (const [, math] of expressions) assert.doesNotThrow(() => katex.renderToString(math, {throwOnError:true}));
});
test('normal prose is never wrapped in a math block', () => assert.equal(normalizeMathText('Integration by parts'), 'Integration by parts'));
test('display brackets become block math', () => assert.equal(normalizeMathText(String.raw`\[\frac{1}{2}\]`).trim(), '$$\n\\frac{1}{2}\n$$'));
test('code examples retain literal delimiters', () => assert.equal(normalizeMathText('`\\(x\\)`'), '`\\(x\\)`'));
test('feedback whose LaTeX escapes were eaten by JSON renders again', () => {
  // Stored text as observed: \f and \r of \frac / \right became control characters.
  const stored = 'is \\(\frac94\\) at \\(\\left(-\frac{1}{2}, \\pm \frac{\\sqrt{3}}{2}\right)\\) and \\(\theta\\)';
  const expressions = [...normalizeMathText(stored).matchAll(/\$([^$]+)\$/g)].map(([, math]) => math);
  assert.deepEqual(expressions, [String.raw`\frac94`, String.raw`\left(-\frac{1}{2}, \pm \frac{\sqrt{3}}{2}\right)`, String.raw`\theta`]);
  for (const math of expressions) assert.doesNotThrow(() => katex.renderToString(math, { throwOnError: true }));
});
test('ordinary line breaks, tabs and CRLF are left alone', () => {
  assert.equal(normalizeMathText('Step one\r\nThe next\tthing\nnext line'), 'Step one\r\nThe next\tthing\nnext line');
});
