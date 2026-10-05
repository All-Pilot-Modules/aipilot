// Older discussion messages store their context in the first student message.
// Keep that saved content intact for the tutor; present readable prose in chat.
export function feedbackDiscussionContext(message) {
  if (message?.role !== 'student' || !message.content?.startsWith('Help me understand this feedback and improve my answer.')) return null;
  const separator = message.content.indexOf('\n\n');
  if (separator < 0) return null;
  try {
    const context = JSON.parse(message.content.slice(separator + 2));
    return typeof context?.question === 'string' && context.feedback && typeof context.feedback === 'object'
      ? context : null;
  } catch {
    return null;
  }
}

export function chatMessageText(message) {
  const context = feedbackDiscussionContext(message);
  return context ? `Help me understand the feedback on this question:\n\n${context.question}` : message.content;
}
