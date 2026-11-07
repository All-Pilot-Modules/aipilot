import { test, expect } from '@playwright/test';
const moduleName = 'Psychology & Learning: a module with a long name';
const module = { id: 'ux-module', name: moduleName, access_code: 'ABC123', teacher_id: 'teacher', status: 'active', is_active: true };
const query = new URLSearchParams({ module: moduleName, moduleId: module.id });
test.beforeEach(async ({ page, context }) => {
  const token = `e30.${Buffer.from(JSON.stringify({ sub: 'teacher', exp: 4102444800 })).toString('base64url')}.test`;
  await context.addCookies([{ name: 'token', value: token, url: 'http://127.0.0.1:3100' }]);
  await page.addInitScript(() => sessionStorage.setItem('user', JSON.stringify({ id: 'teacher', username: 'Teacher', can_create_modules: true })));
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/modules') return route.fulfill({ json: [module] });
    if (url.pathname === '/api/modules/ux-module') return route.fulfill({ json: module });
    if (url.pathname.endsWith('/dashboard-metrics')) return route.fulfill({ json: { access_code: 'ABC123', total_students: 0, total_questions: 0, total_documents: 0, average_score: 0, completion_rate: 0, ai_feedback_count: 0, total_submissions: 0, action_items: { pending_grades: 0, inactive_students: 0, low_performing_students: 0 } } });
    if (url.pathname.startsWith('/api/') && url.pathname.endsWith('/feedback-critiques')) return route.fulfill({ json: { critiques: [], total_critiques: 0, average_rating: 0 } });
    if (url.pathname.startsWith('/api/') && /rubric|instructions|survey/.test(url.pathname)) return route.fulfill({ json: {} });
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: [] });
    if (url.hostname === '127.0.0.1' && url.port === '3100') return route.continue();
    return route.abort();
  });
});
for (const route of ['mymodules', 'dashboard', 'dashboard/documents', 'dashboard/questions', 'dashboard/questions/review', 'dashboard/grading', 'dashboard/students', 'dashboard/settings', 'dashboard/feedback-critiques']) {
  test(`${route} fits a narrow teacher workspace`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 812 });
    await page.goto(`/${route}?${query}`);
    await expect(page.locator('h1,h2').first()).toBeVisible();
    await expect(page.getByText('Loading...', { exact: true })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('mobile.png'), fullPage: true });
    const overflow = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }));
    expect(overflow.content, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.width + 1);
    await page.evaluate(() => { document.documentElement.classList.add('dark'); document.querySelectorAll('*').forEach(el => { el.style.transition = 'none'; }); });
    await page.screenshot({ path: testInfo.outputPath('dark.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate(() => document.documentElement.classList.remove('dark'));
    await page.screenshot({ path: testInfo.outputPath('desktop.png'), fullPage: true });
  });
}
test('mobile sidebar navigates with module context and closes', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 812 });
  await page.goto(`/dashboard/questions?${query}`);
  await page.getByRole('button', { name: 'Toggle Sidebar' }).click();
  const menu = page.getByRole('dialog');
  await expect(menu.getByRole('button', { name: 'Switch module' })).toBeVisible();
  await menu.getByRole('link', { name: 'Documents', exact: true }).click();
  await expect(menu).toBeHidden();
  await expect(page).toHaveURL(/dashboard\/documents/);
  expect(new URL(page.url()).searchParams.get('module')).toBe(moduleName);
  expect(new URL(page.url()).searchParams.get('moduleId')).toBe(module.id);
});

test('mobile question form opens on demand', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 812 });
  await page.goto(`/dashboard/questions?${query}`);
  const fields = page.locator('#create-question-fields');
  await expect(fields).toBeHidden();
  await page.getByRole('button', { name: 'Create question', exact: true }).click();
  await expect(fields).toBeVisible();
  await fields.getByLabel('Question Text *', { exact: true }).fill('What is learning?');
  await page.getByRole('button', { name: 'Hide question form', exact: true }).click();
  await page.getByRole('button', { name: 'Create question', exact: true }).click();
  await expect(fields.getByLabel('Question Text *', { exact: true })).toHaveValue('What is learning?');
});

test('failed document deletion keeps the file and shows an actionable error', async ({ page }) => {
  const doc = { id: 'ux-doc', title: 'Lecture notes', file_name: 'lecture.pdf', file_type: 'pdf', processing_status: 'embedded', is_testbank: false };
  await page.route('**/api/documents?**', route => route.fulfill({ json: [doc] }));
  await page.route('**/api/documents/ux-doc', route => route.fulfill({ status: 409, json: { detail: 'Document is currently processing. Try again shortly.' } }));
  await page.setViewportSize({ width: 320, height: 812 });
  await page.goto(`/dashboard/documents?${query}`);
  await page.getByTitle('Delete').click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toContainText('Existing questions will be kept.');
  await confirm.getByRole('button', { name: 'Delete document', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Document is currently processing');
  await expect(page.getByText('Lecture notes', { exact: true })).toBeVisible();
});
