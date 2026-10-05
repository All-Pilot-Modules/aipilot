import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitAnswer } from '../../lib/studentAnswer.mjs';
test('prose stays text', () => assert.deepEqual(splitAnswer('One half.'), [{type:'text',value:'One half.'}]));
test('matrix stays editable math alongside prose', () => {
 const matrix = String.raw`\begin{pmatrix}4 & 3\\4 & 5\end{pmatrix}`;
 assert.deepEqual(splitAnswer(`Answer $${matrix}$ done`), [{type:'text',value:'Answer '},{type:'math',value:matrix},{type:'text',value:' done'}]);
});
test('display and inline delimiters become math fields', () => {
 assert.deepEqual(splitAnswer(String.raw`$$x^2$$ and \(x\)`), [{type:'text',value:''},{type:'math',value:'x^2'},{type:'text',value:' and '},{type:'math',value:'x'},{type:'text',value:''}]);
});
