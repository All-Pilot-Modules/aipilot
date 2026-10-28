import { test, expect } from '@playwright/test';

const moduleData = {
  id: 'settings-module', teacher_id: 'teacher', name: 'Calculus', is_active: true,
  access_code: 'DEMO123', consent_required: true,
  assignment_config: { grading: { mode: 'auto' }, features: {
    multiple_attempts: { enabled: true, max_attempts: 2, show_feedback_after_each: true },
    chatbot_feedback: { enabled: true }, mastery_learning: { enabled: false },
  } },
};

test('settings preserve drafts across sections and save the existing module payload', async ({ page, context }) => {
  const token = `e30.${Buffer.from(JSON.stringify({ sub: 'teacher', exp: 4102444800 })).toString('base64url')}.test`;
  await context.addCookies([{ name: 'token', value: token, url: 'http://127.0.0.1:3100' }]);
  await page.addInitScript(() => sessionStorage.setItem('user', JSON.stringify({ id: 'teacher', name: 'Test teacher', can_create_modules: true })));
  const writes = [];
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) {
      if (request.method() !== 'GET') {
        writes.push({ path: url.pathname, data: request.postDataJSON() });
        return route.fulfill({ json: {} });
      }
      if (url.pathname.endsWith('/chatbot-instructions')) return route.fulfill({ json: { chatbot_enabled: true, chatbot_instructions: 'Guide students step by step.' } });
      if (url.pathname.endsWith('/survey')) return route.fulfill({ json: { survey_questions: [] } });
      if (url.pathname.endsWith('/rubric')) return route.fulfill({ json: { rubric: { grading_criteria: {}, feedback_style: {}, rag_settings: {}, grading_thresholds: {} } } });
      if (url.pathname === '/api/modules') return route.fulfill({ json: [moduleData] });
      return route.fulfill({ json: {} });
    }
    if (url.hostname === '127.0.0.1' && url.port === '3100') return route.continue();
    return route.abort();
  });
  await page.goto('/dashboard/settings?module=Calculus');
  const nav = page.getByRole('navigation', { name: 'Settings sections' });
  await expect(page.getByRole('heading', { name: 'Module details', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Student enrollment code' })).toBeVisible();
  await page.screenshot({ path: '/tmp/settings-desktop.png', fullPage: true });
  await nav.getByRole('button', { name: 'AI tutor', exact: true }).click();
  await page.getByRole('textbox', { name: 'Tutor instructions' }).fill('Ask a guiding question first.');
  await nav.getByRole('button', { name: 'Attempts & practice' }).click();
  await expect(page.getByText('Feedback between attempts', { exact: true })).toBeVisible();
  await page.getByRole('switch', { name: 'Feedback between attempts' }).click();
  await nav.getByRole('button', { name: 'AI tutor', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Tutor instructions' })).toHaveValue('Ask a guiding question first.');
  await page.getByRole('button', { name: 'Save instructions', exact: true }).click();
  await page.getByRole('button', { name: 'Save module settings', exact: true }).click();
  await expect.poll(() => writes.find(w => w.path === '/api/modules/settings-module')?.data.assignment_config.features.multiple_attempts.show_feedback_after_each).toBe(false);
  expect(writes.find(w => w.path.endsWith('/chatbot-instructions')).data.instructions).toBe('Ask a guiding question first.');
  await nav.getByRole('button', { name: 'Grading & feedback' }).click();
  await page.getByRole('button', { name: 'Grading criteria', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save module settings', exact: true })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Save rubric', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByLabel('Settings section', { exact: true }).selectOption('features');
  await expect(page.getByText('Feedback between attempts', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/settings-mobile.png', fullPage: true });
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.screenshot({ path: '/tmp/settings-dark.png', fullPage: true });
  await page.setViewportSize({ width: 320, height: 812 });
  for (const section of ['general', 'grading', 'chatbot', 'survey', 'consent']) {
    await page.getByLabel('Settings section', { exact: true }).selectOption(section);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), section).toBe(true);
  }
});

test('settings show a recoverable error instead of default fields when the API is offline', async ({ page, context }) => {
  const token = `e30.${Buffer.from(JSON.stringify({ sub: 'teacher', exp: 4102444800 })).toString('base64url')}.test`;
  await context.addCookies([{ name: 'token', value: token, url: 'http://127.0.0.1:3100' }]);
  await page.addInitScript(() => sessionStorage.setItem('user', JSON.stringify({ id: 'teacher', can_create_modules: true })));
  let offline = true;
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/modules') {
      return offline ? route.abort('connectionrefused') : route.fulfill({ json: [moduleData] });
    }
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: {} });
    if (url.hostname === '127.0.0.1' && url.port === '3100') return route.continue();
    return route.abort();
  });
  await page.goto('/dashboard/settings?module=Calculus');
  await expect(page.getByRole('heading', { name: 'Unable to load settings' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save module settings' })).toBeHidden();
  await expect(page.getByRole('textbox', { name: 'Module title' })).toBeHidden();
  offline = false;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Module title' })).toHaveValue('Calculus');
  await expect(page.getByRole('heading', { name: 'Unable to load settings' })).toBeHidden();
});
