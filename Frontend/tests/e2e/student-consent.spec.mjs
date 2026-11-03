import { test, expect } from '@playwright/test';

test('public join page uses new student session for consent despite an existing teacher cookie', async ({ page, context }) => {
  const moduleId = '5681799e-5a2a-4173-b28b-5f93b3c20080';
  const token = claims => `e30.${Buffer.from(JSON.stringify({ ...claims, exp: 4102444800 })).toString('base64url')}.test`;
  const studentToken = token({ sub: 'the test two', role: 'student', module_id: moduleId });
  const teacherToken = token({ sub: 'teacher', role: 'teacher' });
  await context.addCookies([{ name: 'token', value: teacherToken, url: 'http://127.0.0.1:3100' }]);
  const consentRequests = [];
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/api/student/join-module') {
      return route.fulfill({ json: { token: studentToken, module: {
        id: moduleId, name: 'Test module', teacher_id: 'teacher', consent_required: true,
      } } });
    }
    if (url.pathname.includes('/consent/')) {
      consentRequests.push({ method: request.method(), authorization: request.headers().authorization, path: url.pathname });
      if (request.headers().authorization !== `Bearer ${studentToken}`) {
        return route.fulfill({ status: 401, json: { detail: 'Invalid student session' } });
      }
      return route.fulfill({ json: request.method() === 'GET' ? { has_consented: false } : { success: true } });
    }
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: {} });
    if (url.hostname === '127.0.0.1' && url.port === '3100') return route.continue();
    return route.abort();
  });
  await page.goto('/teacher/TestModule');
  await page.getByLabel('Student ID', { exact: true }).fill('the test two');
  await page.getByLabel('Access Code', { exact: true }).fill('ABC123');
  await page.locator('form button[type="submit"]').click();
  await page.getByText('I do not agree to participate in this research project.', { exact: true }).click();
  await page.getByRole('button', { name: 'Submit Response', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/student/module/${moduleId}`));
  expect(consentRequests.map(r => r.method)).toContain('GET');
  expect(consentRequests.map(r => r.method)).toContain('PUT');
  expect(consentRequests.every(r => r.authorization === `Bearer ${studentToken}`)).toBe(true);
  expect(consentRequests.every(r => r.path.endsWith('/the%20test%20two'))).toBe(true);
  expect((await context.cookies()).find(c => c.name === 'token').value).toBe(teacherToken);
});
