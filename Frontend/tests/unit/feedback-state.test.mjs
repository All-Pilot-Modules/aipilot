import test from 'node:test';
import assert from 'node:assert/strict';
import { feedbackCounts } from '../../lib/feedbackState.mjs';

test('active automatic retries are separate from exhausted failures', () => {
  assert.deepEqual(feedbackCounts({ attempt: 1, feedback_failed: 0, feedback_retrying: 1 }, 1), { failed: 0, retrying: 1 });
  assert.deepEqual(feedbackCounts({ attempt: 1, feedback_failed: 1, feedback_retrying: 0 }, 1), { failed: 1, retrying: 0 });
});
test('another attempt or unavailable status does not show a false failure', () => {
  assert.deepEqual(feedbackCounts({ attempt: 2, feedback_failed: 3 }, 1), { failed: 0, retrying: 0 });
  assert.deepEqual(feedbackCounts(null, 1), { failed: 0, retrying: 0 });
});
