import test from 'node:test';
import assert from 'node:assert/strict';
import { feedbackCounts, questionStatus } from '../../lib/feedbackState.mjs';

test('active automatic retries are separate from exhausted failures', () => {
  assert.deepEqual(feedbackCounts({ attempt: 1, feedback_failed: 0, feedback_retrying: 1 }, 1), { failed: 0, retrying: 1 });
  assert.deepEqual(feedbackCounts({ attempt: 1, feedback_failed: 1, feedback_retrying: 0 }, 1), { failed: 1, retrying: 0 });
});
test('another attempt or unavailable status does not show a false failure', () => {
  assert.deepEqual(feedbackCounts({ attempt: 2, feedback_failed: 3 }, 1), { failed: 0, retrying: 0 });
  assert.deepEqual(feedbackCounts(null, 1), { failed: 0, retrying: 0 });
});

const done = (fields) => ({ generation_status: 'completed', ...fields });

test('question status follows the score, preferring the teacher grade', () => {
  assert.equal(questionStatus(done({ correctness_score: 100 }), true), 'correct');
  assert.equal(questionStatus(done({ correctness_score: 40 }), true), 'partial');
  assert.equal(questionStatus(done({ correctness_score: 0 }), true), 'incorrect');
  assert.equal(questionStatus(done({ is_correct: true }), true), 'correct');
  assert.equal(questionStatus(done({ correctness_score: 0, points_possible: 2,
    teacher_grade: { points_awarded: 2 } }), true), 'correct');
});
test('question status never reveals correctness the teacher hid', () => {
  assert.equal(questionStatus(done({ correctness_score: null, is_correct: null }), true), 'reviewed');
});
test('question status covers unanswered, pending and failed feedback', () => {
  assert.equal(questionStatus(done({ correctness_score: 100 }), false), 'unanswered');
  assert.equal(questionStatus(undefined, true), 'pending');
  assert.equal(questionStatus({ generation_status: 'generating' }, true), 'pending');
  assert.equal(questionStatus({ generation_status: 'failed' }, true), 'unavailable');
});
