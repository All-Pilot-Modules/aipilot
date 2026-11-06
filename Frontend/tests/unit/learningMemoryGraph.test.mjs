import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLearningMemoryGraph } from '../../lib/learningMemoryGraph.js';
const entry = (id, attempt, concepts) => ({ id, attempt, date: `2026-10-0${attempt}`, source_answer_ids: [`answer-${id}`], observations: { summary: 'Observed work', concepts } });
test('shared concept preserves dated evidence and uses latest signal, not mastery', () => {
  const graph = buildLearningMemoryGraph([
    entry('old', 1, [{ concept: 'Product rule', signal: 'difficulty', observation: 'Missing term', answer_ids: ['answer-old'] }]),
    entry('new', 2, [{ concept: ' product RULE ', signal: 'demonstrated', observation: 'Both terms', answer_ids: ['answer-new'] }]),
  ]);
  const concepts = graph.nodes.filter(n => n.kind === 'concept');
  assert.equal(concepts.length, 1);
  assert.equal(concepts[0].records.length, 2);
  assert.equal(concepts[0].signal, 'demonstrated');
  assert.equal(graph.edges.length, 4);
  assert.deepEqual(concepts[0].records[0].detail.answer_ids, ['answer-new']);
});
test('legacy observations do not invent shared concepts or relationships', () => {
  const legacy = { ...entry('legacy', 1), observations: { strengths: ['Product rule'], areas_to_improve: ['Product rule'], next_steps: [] } };
  const graph = buildLearningMemoryGraph([legacy]);
  assert.equal(graph.nodes.filter(n => n.kind === 'concept').length, 0);
  assert.equal(graph.nodes.length, 4);
  assert.equal(graph.edges.length, 3);
  assert.ok(graph.nodes.every(n => Number.isFinite(n.x) && Number.isFinite(n.y)));
  assert.deepEqual(buildLearningMemoryGraph([]), { nodes: [], edges: [] });
});
test('tree layout gives shared concepts one row and links every attempt', async () => {
  const { layoutLearningMemoryTree } = await import('../../lib/learningMemoryGraph.js');
  const graph = buildLearningMemoryGraph([
    entry('b', 2, [{ concept: 'Joins', signal: 'demonstrated', observation: 'Correct join' }]),
    entry('a', 1, [{ concept: 'Joins', signal: 'difficulty', observation: 'Wrong key' }, { concept: 'Keys', signal: 'practice', observation: 'Review keys' }]),
  ]);
  const tree = layoutLearningMemoryTree(graph, { row: 60, gap: 20 });
  assert.deepEqual(tree.attempts.map(a => a.node.label), ['Attempt 1', 'Attempt 2']);
  assert.equal(tree.leaves.length, 2);
  const joins = tree.leaves.find(l => l.node.label === 'Joins');
  assert.equal(joins.parents.length, 2);
  assert.ok(tree.leaves.every(l => Number.isFinite(l.y)));
  assert.equal(tree.height, 60 * 2 + 20 + 60); // attempt 2 has no own rows, so it gets one slot
});
