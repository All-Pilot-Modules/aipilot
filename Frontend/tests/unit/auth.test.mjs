import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { auth, apiClient } from '../../lib/auth.js';

const jwt = () => ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({ sub: 'teacher-test', exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url'), 'test'].join('.');
const response = (status, body = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  globalThis.window = {};
  globalThis.document = { cookie: '' };
  globalThis.sessionStorage = { removeItem() {}, getItem() { return null; }, setItem() {} };
  mock.method(auth, 'getToken', () => jwt());
  mock.method(console, 'warn', () => {});
  mock.method(console, 'error', () => {});
});
afterEach(() => {
  mock.restoreAll();
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.sessionStorage;
});

test('attaches teacher token to a successful request', async () => {
  const fetch = mock.method(globalThis, 'fetch', async (url, options) => {
    assert.match(options.headers.Authorization, /^Bearer /);
    return response(200, { feedback: [] });
  });
  assert.deepEqual(await apiClient.request('/api/ai-feedback/teacher/module/test/released'), { feedback: [] });
  assert.equal(fetch.mock.callCount(), 1);
});

test('403 permission failure does not refresh or log out', async () => {
  mock.method(globalThis, 'fetch', async () => response(403, { detail: 'Forbidden' }));
  const refresh = mock.method(auth, 'refreshAccessToken', async () => 'new-token');
  const logout = mock.method(auth, 'logout', () => {});
  await assert.rejects(apiClient.request('/api/private'), /Forbidden/);
  assert.equal(refresh.mock.callCount(), 0);
  assert.equal(logout.mock.callCount(), 0);
});

test('401 refresh success retries with the new token', async () => {
  let count = 0;
  mock.method(globalThis, 'fetch', async (url, options) => {
    if (++count === 1) return response(401);
    assert.equal(options.headers.Authorization, 'Bearer refreshed-token');
    return response(200, { ok: true });
  });
  const refresh = mock.method(auth, 'refreshAccessToken', async () => 'refreshed-token');
  const logout = mock.method(auth, 'logout', () => {});
  assert.deepEqual(await apiClient.request('/api/private'), { ok: true });
  assert.equal(refresh.mock.callCount(), 1);
  assert.equal(logout.mock.callCount(), 0);
});

test('best-effort feedback request preserves session after repeated 401', async () => {
  mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal('skipAuthLogout' in options, false);
    return response(401);
  });
  mock.method(auth, 'refreshAccessToken', async () => 'refreshed-token');
  const logout = mock.method(auth, 'logout', () => {});
  await assert.rejects(apiClient.request('/api/student/modules/test/feedback', { skipAuthLogout: true }), /HTTP 401/);
  assert.equal(logout.mock.callCount(), 0);
});

test('required request logs out when refresh is unavailable', async () => {
  mock.method(globalThis, 'fetch', async () => response(401));
  mock.method(auth, 'refreshAccessToken', async () => null);
  const logout = mock.method(auth, 'logout', () => {});
  await assert.rejects(apiClient.request('/api/private'), /Authentication required/);
  assert.equal(logout.mock.callCount(), 1);
});

test('422 validation failures are not retried', async () => {
  const fetch = mock.method(globalThis, 'fetch', async () => response(422, { detail: [{ loc: ['body', 'answer'], msg: 'Required' }] }));
  await assert.rejects(apiClient.request('/api/student/save-answer'), /body.answer: Required/);
  assert.equal(fetch.mock.callCount(), 1);
});

for (const status of [401, 403, 500]) {
  test(`successful refresh followed by ${status} preserves teacher session`, async () => {
    let calls = 0;
    mock.method(globalThis, 'fetch', async () => response(++calls === 1 ? 401 : status));
    mock.method(auth, 'refreshAccessToken', async () => 'refreshed-token');
    const logout = mock.method(auth, 'logout', () => {});
    await assert.rejects(apiClient.request('/api/modules/test/survey/students/student'), new RegExp(`HTTP ${status}`));
    assert.equal(logout.mock.callCount(), 0);
    assert.equal(calls, 2);
  });
}

test('student retry never exchanges its session for a teacher refresh token', async () => {
  window.location = { pathname: '/student/module/test' };
  mock.method(globalThis, 'fetch', async () => response(401));
  const refresh = mock.method(auth, 'refreshAccessToken', async () => 'teacher-token');
  const logout = mock.method(auth, 'logout', () => {});
  await assert.rejects(apiClient.request('/api/ai-feedback/retry/module/test', {method:'POST'}), /Rejoin this module/);
  assert.equal(refresh.mock.callCount(), 0);
  assert.equal(logout.mock.callCount(), 0);
});

test('joining a student module preserves teacher cookies and stores a separate session', () => {
  const stored = new Map();
  sessionStorage.setItem = (key, value) => stored.set(key, value);
  document.cookie = 'token=teacher-session';
  const token = ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({sub:'student',role:'student',module_id:'module-a'})).toString('base64url'), 'test'].join('.');
  auth.setStudentToken(token);
  assert.equal(document.cookie, 'token=teacher-session');
  assert.equal(stored.get('student_token:module-a'), token);
});
