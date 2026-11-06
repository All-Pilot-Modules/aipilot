import { test, expect } from '@playwright/test';

for (const mode of ['normal', 'switch-pending', 'return-pending']) test(`feedback discussions switch and reopen (${mode})`, async ({ page, context }) => {
  const delayedFirst = mode !== 'normal';
  const returnPending = mode === 'return-pending';
  let firstDiscussionRequests = 0;
  const moduleId = 'comparison-module';
  const token = `e30.${Buffer.from(JSON.stringify({ sub: 'student', role: 'student', module_id: moduleId, exp: 4102444800 })).toString('base64url')}.test`;
  await page.addInitScript(({ token, moduleId }) => {
    sessionStorage.setItem(`student_token:${moduleId}`, token);
    sessionStorage.setItem('student_token:active', token);
    sessionStorage.setItem('student_module_access', JSON.stringify({ moduleId, studentId: 'student', moduleName: 'Learning review' }));
  }, { token, moduleId });
  const questions = [
    { id: 'q1', type: 'mcq', text: 'First question', options: { A: 'One', B: 'Two' }, points: 1 },
    { id: 'q2', type: 'mcq', text: 'Second question', options: { A: 'Three', B: 'Four' }, points: 1 },
  ];
  const feedback = questions.map((q, i) => ({
    id: `f${i+1}`, question_id: q.id, answer_id: `a${i}`, attempt: 1,
    generation_status: 'completed', released: true, correctness_score: 0,
    explanation: `Feedback for ${q.text}`, student_answer: { selected_option_id: 'A' },
    available_options: q.options, fallback: false,
  }));
  let releaseFirst;
  const firstPending = new Promise(resolve => { releaseFirst = resolve; });
  let delayRemaining = delayedFirst;
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/api/')) {
      let json = {};
      if (url.pathname.match(/\/api\/chat\/feedback\/f[12]\/discuss$/)) {
        if (url.pathname.includes('/f1/')) firstDiscussionRequests++;
        if (url.pathname.includes('/f1/') && delayRemaining) { delayRemaining = false; await firstPending; }
        return route.fulfill({ json: { conversation_id: url.pathname.includes('/f1/') ? 'c1' : 'c2' } });
      }
      if (url.pathname.match(/\/api\/chat\/conversations\/c[12]$/)) {
        const id = url.pathname.endsWith('c1') ? 'c1' : 'c2';
        return route.fulfill({ json: { id, title: id, messages: [{ role: 'assistant', content: id === 'c1' ? 'First discussion response' : 'Second discussion response' }] } });
      }
      if (url.pathname === `/api/modules/${moduleId}`) json = { id: moduleId, name: 'Learning review', consent_required: false, assignment_config: { features: { multiple_attempts: { max_attempts: 5 } } } };
      else if (url.pathname.endsWith('/questions')) json = questions;
      else if (url.pathname.endsWith('/documents') || url.pathname.includes('/conversations')) json = [];
      else if (url.pathname.endsWith('/feedback')) json = feedback;
      else if (url.pathname.endsWith('/my-answers')) json = feedback.map(f => ({ question_id: f.question_id, answer: f.student_answer, attempt: 1 }));
      else if (url.pathname.endsWith('/feedback-status')) json = { attempt: 1, all_complete: true, feedback_ready: 2, total_questions: 2, feedback_pending: 0, questions: [] };
      else if (url.pathname.endsWith('/submission-status')) json = { current_attempt: 2, max_attempts: 5, can_submit_again: true, submissions: [{ attempt: 1, questions_count: 4 }] };
      return route.fulfill({ json });
    }
    if (url.hostname === '127.0.0.1' && url.port === '3100') return route.continue();
    return route.abort();
  });
  await page.goto(`/student/module/${moduleId}?tab=feedback`);
  let first = true;
  try {
  for (const [question, expected] of [['q1', 'First discussion response'], ['q2', 'Second discussion response'], ['q1', 'First discussion response']]) {
    await page.getByRole('tab', { name: /Feedback/ }).click();
    const discuss = page.locator(`#feedback-question-${question}`).getByRole('button', { name: 'Discuss this feedback' });
    await expect(discuss).toBeEnabled();
    await discuss.click();
    await expect(page.getByRole('tab', { name: /Chat/ })).toHaveAttribute('aria-selected', 'true');
    if (first && delayedFirst) { first = false; continue; }
    first = false;
    if (returnPending && question === 'q1') releaseFirst();
    await expect(page.getByText(expected, { exact: true })).toBeVisible();
    if (!returnPending) releaseFirst();
    await expect(page.getByRole('button', { name: 'New chat', exact: true })).toBeEnabled();
  }
  if (returnPending) expect(firstDiscussionRequests).toBe(1);
  } finally { releaseFirst(); }
});
