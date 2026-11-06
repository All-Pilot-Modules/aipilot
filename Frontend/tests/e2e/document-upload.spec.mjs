import { test, expect } from '@playwright/test';

test('closing upload dialog keeps progress visible and processing updates without refresh', async ({ page, context }) => {
  const token = `e30.${Buffer.from(JSON.stringify({ sub: 'teacher', exp: 4102444800 })).toString('base64url')}.test`;
  await context.addCookies([{ name: 'token', value: token, url: 'http://127.0.0.1:3100' }]);
  await page.addInitScript(() => sessionStorage.setItem('user', JSON.stringify({ id: 'teacher', name: 'Test teacher', can_create_modules: true })));
  const module = { id: 'upload-module', name: 'Calculus', teacher_id: 'teacher' };
  let documents = [];
  let releaseUpload;
  const pendingUpload = new Promise(resolve => { releaseUpload = resolve; });
  const doc = { id: 'new-document', title: 'Lecture notes.pdf', file_name: 'Lecture notes.pdf', file_type: 'pdf', processing_status: 'queued', processing_metadata: { file_size: 100, upload_complete: true } };
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/upload') {
      documents = [{ ...doc, processing_status: 'uploading' }];
      await pendingUpload;
      documents = [doc];
      return route.fulfill({ json: doc });
    }
    if (url.pathname === '/api/documents') return route.fulfill({ json: documents });
    if (url.pathname === '/api/modules') return route.fulfill({ json: [module] });
    if (url.pathname === '/api/modules/upload-module') return route.fulfill({ json: module });
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: {} });
    if (url.hostname === '127.0.0.1' && url.port === '3100') return route.continue();
    return route.abort();
  });
  try {
    await page.goto('/dashboard/documents?module=Calculus&moduleId=upload-module');
    await page.getByRole('button', { name: 'Upload', exact: true }).click();
    await page.getByRole('button', { name: 'Choose file', exact: true }).focus();
    const chooserPromise = page.waitForEvent('filechooser');
    await page.keyboard.press('Enter');
    await (await chooserPromise).setFiles({ name: 'invalid.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('invalid') });
    await expect(page.getByRole('alert')).toContainText('Supported formats');
    await expect(page.getByRole('button', { name: 'Upload document', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Remove selected file' }).click();
    await expect(page.getByRole('button', { name: 'Choose file', exact: true })).toBeFocused();
    await page.setViewportSize({ width: 320, height: 740 });
    await page.screenshot({ path: '/tmp/upload-empty.png' });
    await page.locator('input[type=file]').setInputFiles({ name: doc.file_name, mimeType: 'application/pdf', buffer: Buffer.from('test file') });
    await page.screenshot({ path: '/tmp/upload-mobile.png' });
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await expect.poll(() => page.getByRole('dialog').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(11, 17, 32)');
    await page.screenshot({ path: '/tmp/upload-dark.png' });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole('button', { name: 'Upload document', exact: true }).click();
    await page.getByRole('button', { name: 'Hide upload', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByRole('status').filter({ hasText: 'Uploading…' })).toContainText(doc.file_name);
    await expect(page.getByText('Waiting for upload to finish', { exact: true })).toBeVisible();
    await expect(page.getByText('Upload incomplete', { exact: false })).toHaveCount(0);
    releaseUpload();
    await expect(page.getByText('Queued / processing', { exact: true })).toBeVisible();
    documents = [{ ...doc, processing_status: 'embedded' }];
    await expect(page.getByTitle('Generate Questions')).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Uploading…' })).toHaveCount(0);
  } finally { releaseUpload(); }
});
