import { test, expect } from '@playwright/test';

test('teacher creates a question directly inside the math workspace', async ({ page, context }, testInfo) => {
  const token = `e30.${Buffer.from(JSON.stringify({ sub: 'teacher', exp: 4102444800 })).toString('base64url')}.test`;
  await context.addCookies([{ name: 'token', value: token, url: 'http://127.0.0.1:3100' }]);
  await page.addInitScript(() => sessionStorage.setItem('user', JSON.stringify({ id: 'teacher', name: 'Teacher', can_create_modules: true })));
  const module = { id: 'math-module', name: 'Calculus', teacher_id: 'teacher' };
  let saved;
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/questions' && route.request().method() === 'POST') {
      saved = route.request().postDataJSON();
      return route.fulfill({ json: { ...saved, id: 'created-question' } });
    }
    if (url.pathname === '/api/modules') return route.fulfill({ json: [module] });
    if (url.pathname === '/api/modules/math-module') return route.fulfill({ json: module });
    if (url.pathname === '/api/questions' || url.pathname === '/api/questions/by-module' || url.pathname === '/api/documents') return route.fulfill({ json: [] });
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: {} });
    if (url.hostname === '127.0.0.1' && url.port === '3100') return route.continue();
    return route.abort();
  });
  await page.goto('/dashboard/questions?module=Calculus&moduleId=math-module');
  await page.getByRole('button', { name: 'Add equations', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Question text', { exact: true }).fill('What is $2 + 2$?');
  await dialog.getByLabel('Option A', { exact: true }).fill('$4$');
  await dialog.getByLabel('Option B', { exact: true }).fill('$5$');
  await dialog.locator('button[aria-pressed]').first().click();
  await page.screenshot({ path: '/tmp/math-create-workspace.png' });
  await dialog.getByRole('button', { name: 'Create question', exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(saved.text).toBe('What is $2 + 2$?');
  expect(saved.options.A).toBe('$4$');
  expect(saved.correct_option_id).toBe('A');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Export as RTF (opens in Word)' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.rtf$/);
  const path = testInfo.outputPath('questions.rtf');
  await download.saveAs(path);
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await page.getByLabel('Document file', { exact: true }).setInputFiles(path);
  await expect(page.getByRole('button', { name: 'Upload testbank', exact: true })).toBeEnabled();
});
