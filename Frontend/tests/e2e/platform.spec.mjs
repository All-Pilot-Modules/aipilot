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
