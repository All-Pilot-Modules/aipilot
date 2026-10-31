import { test, expect } from '@playwright/test';

test('students can compare all options and written answers without waiting for AI', async ({ page, context }) => {
  const moduleId = 'comparison-module';
  const token = `e30.${Buffer.from(JSON.stringify({ sub: 'student', role: 'student', module_id: moduleId, exp: 4102444800 })).toString('base64url')}.test`;
  await page.addInitScript(({ token, moduleId }) => {
    sessionStorage.setItem(`student_token:${moduleId}`, token);
    sessionStorage.setItem('student_token:active', token);
    sessionStorage.setItem('student_module_access', JSON.stringify({ moduleId, studentId: 'student', moduleName: 'Learning review' }));
  }, { token, moduleId });
  const questions = [
    { id: 'q1', type: 'mcq', text: 'Which city is the capital of France?', options: { A: 'London', B: 'Paris', C: 'Berlin', D: 'Madrid' }, points: 1 },
    { id: 'q2', type: 'short', text: 'Explain why practice helps learning.', points: 1 },
    { id: 'q3', type: 'mcq_multiple', text: 'Select the even numbers.', options: { A: '2', B: '3', C: '4' }, points: 1 },
    { id: 'q4', type: 'fill_blank', text: 'The capital of France is ___.', extended_config: { blanks: [{ position: 0 }] }, points: 1 },
  ];
  const feedback = questions.map((q, i) => ({
    question_id: q.id, answer_id: `a${i}`, attempt: 1, generation_status: 'completed',
    answer_key_only: true, released: true, score: null, correctness_score: null, is_correct: null, points_possible: 1,
    ...[
      { student_answer: { selected_option: 'A' }, available_options: q.options, correct_option: 'B' },
      { student_answer: { text_response: 'Practice builds confidence.' }, answer_key: [{ label: 'Reference answer', text: 'Practice strengthens recall and helps identify mistakes.' }] },
      { student_answer: { selected_options: ['A', 'B'] }, correct_options: ['A', 'C'] },
      { student_answer: { blanks: { 0: 'London' } }, answer_key: [{ label: 'Blank 1', text: 'Paris' }] },
    ][i],
  }));
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/api/')) {
      let json = {};
      if (url.pathname === `/api/modules/${moduleId}`) json = { id: moduleId, name: 'Learning review', consent_required: false, assignment_config: { features: { multiple_attempts: { max_attempts: 5 } } } };
      else if (url.pathname.endsWith('/questions')) json = questions;
      else if (url.pathname.endsWith('/documents') || url.pathname.includes('/conversations')) json = [];
      else if (url.pathname.endsWith('/feedback')) json = feedback;
      else if (url.pathname.endsWith('/my-answers')) json = feedback.map(f => ({ question_id: f.question_id, answer: f.student_answer, attempt: 1 }));
      else if (url.pathname.endsWith('/feedback-status')) json = { attempt: 1, all_complete: true, feedback_ready: 4, total_questions: 4, feedback_pending: 0, questions: [] };
      else if (url.pathname.endsWith('/submission-status')) json = { current_attempt: 2, max_attempts: 5, can_submit_again: true, submissions: [{ attempt: 1, questions_count: 4 }] };
      return route.fulfill({ json });
    }
    if (url.hostname === '127.0.0.1' && url.port === '3100') return route.continue();
    return route.abort();
  });
  await page.goto(`/student/module/${moduleId}?tab=feedback`);
  const first = page.locator('#feedback-question-q1');
  await expect(first.getByText('Which city is the capital of France?')).toBeVisible();
  for (const option of ['London', 'Paris', 'Berlin', 'Madrid']) await expect(first.getByText(option, { exact: true })).toBeVisible();
  await expect(first.getByRole('listitem').filter({ hasText: 'London' })).toContainText('Your selection');
  await expect(first.getByRole('listitem').filter({ hasText: 'Paris' })).toContainText('Correct answer');
  await expect(first.getByText('Score', { exact: true })).toBeHidden();
  const written = page.locator('#feedback-question-q2');
  await expect(written.getByText('Practice builds confidence.')).toBeVisible();
  await expect(written.getByText('Practice strengthens recall and helps identify mistakes.')).toBeVisible();
  const multiple = page.locator('#feedback-question-q3');
  await expect(multiple.getByText('Your selection', { exact: true })).toHaveCount(2);
  await expect(multiple.getByText('Correct answer', { exact: true })).toHaveCount(2);
  await page.getByRole('button', { name: 'Go to question 4', exact: true }).click();
  await expect(page.locator('#feedback-question-q4')).toBeFocused();
  await expect(page.locator('#feedback-question-q4').getByText('London', { exact: true })).toBeVisible();
  await expect(page.locator('#feedback-question-q4').getByText('Paris', { exact: true })).toBeVisible();
  await page.screenshot({ path: '/tmp/answer-comparison-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/answer-comparison-mobile.png', fullPage: true });
});
