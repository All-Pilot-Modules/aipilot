import test from 'node:test';
import assert from 'node:assert/strict';
import { chatMessageText, feedbackDiscussionContext } from '../../lib/feedbackDiscussion.mjs';

test('saved context stays intact while the chat displays a readable question', () => {
  const context = { question: 'Differentiate $x^2$.', answer: {text_response:'2x'}, attempt:1, feedback:{explanation:'Correct'} };
  const content = 'Help me understand this feedback and improve my answer.\n\n' + JSON.stringify(context);
  const message = {role:'student', content};
  assert.deepEqual(feedbackDiscussionContext(message), context);
  assert.equal(chatMessageText(message), 'Help me understand the feedback on this question:\n\nDifferentiate $x^2$.');
  assert.equal(message.content, content);
});
test('ordinary messages and malformed context are shown unchanged', () => {
  for (const message of [{role:'student',content:'What is a derivative?'}, {role:'assistant',content:'Help me understand this feedback and improve my answer.\n\n{}'}, {role:'student',content:'Help me understand this feedback and improve my answer.\n\n{broken'}]) {
    assert.equal(chatMessageText(message), message.content);
    assert.equal(feedbackDiscussionContext(message), null);
  }
});
