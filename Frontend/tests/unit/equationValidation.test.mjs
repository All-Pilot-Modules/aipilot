import test from 'node:test';
import assert from 'node:assert/strict';
import { equationError } from '../../lib/equationValidation.mjs';

test('rejects unfinished MathLive matrices and fractions instead of saving invalid LaTeX', () => {
  assert.match(equationError(String.raw`\begin{pmatrix}\placeholder{} & 2 \\ 3 & 4\end{pmatrix}`), /empty box/);
  assert.match(equationError(String.raw`\frac{1}{\placeholder{}}`), /empty box/);
  assert.ok(equationError(''));
  assert.ok(equationError(String.raw`\unknowncommand{1}`));
});

test('accepts complete matrices and fractions without changing their values', () => {
  assert.equal(equationError(String.raw`\begin{pmatrix}1 & 2 \\ 3 & 4\end{pmatrix}`), null);
  assert.equal(equationError(String.raw`\frac{1}{2}`), null);
});
