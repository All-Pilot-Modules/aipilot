import { test, expect } from '@playwright/test';

// Browser UI contracts use synthetic API responses; never a production backend.
test.beforeEach(async ({ context }) => {
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' && url.port === '3100') return route.continue();
    return route.abort();
  });
});

test('invalid login displays error and preserves login form', async ({ page }) => {
  await page.route('**/api/auth/login', route => route.fulfill({ status: 401, json: { detail: 'Incorrect credentials' } }));
  await page.goto('/sign-in');
  await page.getByLabel('Email or Username').fill('teacher@example.test');
  await page.getByLabel('Password', { exact: true }).fill('incorrect-password');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.getByText('Invalid email/username or password. Please check your credentials and try again.')).toBeVisible();
  await expect(page).toHaveURL(/sign-in/);
});

test('invalid class access code is shown without granting a session', async ({ page, context }) => {
  await page.route('**/api/modules/all', route => route.fulfill({ json: [] }));
  await page.route('**/api/student/join-module**', route => route.fulfill({ status: 404, json: { detail: 'Invalid access code' } }));
  await page.goto('/join');
  await page.getByPlaceholder('Enter your Banner ID (e.g., B00123456)').fill('B00123456');
  await page.getByPlaceholder('Enter the code provided by your instructor').fill('BADCODE');
  await page.getByRole('button', { name: 'Join Module', exact: true }).click();
  await expect(page.getByText(/Invalid access code/)).toBeVisible();
  expect((await context.cookies()).some(cookie => cookie.name === 'token')).toBe(false);
});

test('math editor keeps prose unchanged after blur and renders equations', async ({ page }) => {
  await page.goto('/dev-math-test');
  await page.getByRole('button', { name: 'Open: Short', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const field = dialog.locator('textarea').first();
  const prose = 'Explain the product rule in ordinary words.';
  await field.fill(prose);
  await field.press('Tab');
  await expect(field).toHaveValue(prose);
  await field.fill('Differentiate $x^2$.');
  await field.press('Tab');
  await expect(dialog.locator('.katex:visible').first()).toBeVisible();
});


test('equation workspace supports labeled answers, contextual equation tools, and narrow screens', async ({ page }) => {
  await page.goto('/dev-math-test');
  await page.getByRole('button', { name: 'Open: Short', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const answer = dialog.getByLabel('Expected answer', { exact: true });
  await answer.fill('The answer is $x = 4$.');
  await answer.press('Tab');
  await expect(answer).toHaveValue('The answer is $x = 4$.');
  await expect(dialog.getByRole('button', { name: 'Add equation', exact: true })).toHaveCount(1);
  await expect(dialog.getByRole('button', { name: 'Add equation', exact: true })).toBeFocused();
  await expect(dialog.getByLabel('Add math to')).toHaveCount(0);
  await dialog.getByLabel('Question text', { exact: true }).focus();
  await page.screenshot({ path: '/tmp/math-workspace-desktop.png' });
  await page.setViewportSize({ width: 320, height: 812 });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
    document.querySelectorAll('*').forEach(el => { el.style.transition = 'none'; });
  });
  await expect(dialog).toHaveCSS('width', '320px');
  await page.screenshot({ path: '/tmp/math-workspace-mobile.png' });
});

test('matrix insertion rejects empty template cells and renders a completed matrix', async ({ page }) => {
  await page.goto('/dev-math-test');
  await page.getByRole('button', { name: 'Open: Short', exact: true }).click();
  const dialog = page.getByRole('dialog', { includeHidden: true });
  const question = dialog.getByLabel('Question text', { exact: true });
  await question.fill('Find the determinant: ');
  await question.press('End');
  await dialog.getByRole('button', { name: 'Add equation', exact: true }).first().click();
  const scratch = page.locator('math-field:visible');
  await expect(scratch).toBeVisible();
  await scratch.evaluate(el => { el.value = String.raw`\begin{pmatrix}\placeholder{} & 2 \\ 3 & 4\end{pmatrix}`; });
  await page.getByRole('button', { name: 'Insert', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Fill in every empty box');
  await expect(question).toHaveValue('Find the determinant: ');
  await scratch.evaluate(el => { el.value = String.raw`\begin{pmatrix}1 & 2 \\ 3 & 4\end{pmatrix}`; });
  await page.getByRole('button', { name: 'Insert', exact: true }).click();
  await expect(scratch).toHaveCount(0);
  await expect(question).toHaveValue(/Find the determinant: \$.*pmatrix/);
  await expect(dialog.locator('.katex:visible').first()).toBeVisible();
  await expect(dialog.locator('.katex-error')).toHaveCount(0);
  await expect(dialog.locator('.katex:visible').first()).toHaveCSS('white-space', 'nowrap');
});
