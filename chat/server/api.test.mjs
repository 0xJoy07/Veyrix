import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createApiMiddleware } from './api.mjs';

const apiKey = 'test-server-key-that-is-at-least-32-characters';

async function fixture(t, fetchImpl) {
  const server = createServer(createApiMiddleware({ apiKey, customerId: 'demo', fetchImpl }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  return async (path, body = {}, cookie = '', headers = {}) => {
    const response = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie, ...headers }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  };
}

test('isolates browsers, retains identity server-side, resets and confirms actual API routes', async t => {
  const requests = [];
  let sequence = 0;
  const send = await fixture(t, async (url, options) => {
    const body = JSON.parse(options.body);
    requests.push({ path: url.pathname, body, auth: options.headers.Authorization });
    if (url.pathname.endsWith('/confirm')) return Response.json({ order_id: 'order-1', status: 'confirmed' });
    if (url.pathname.endsWith('/reset')) return Response.json({ session_id: 'reset-session', status: 'reset' });
    return Response.json({ session_id: body.session_id || `session-${++sequence}`, answer: 'Hello', pending: { token: 'confirm-1', kind: 'order' } });
  });
  const a = await send('/api/chat', { message: 'Hello' });
  assert.equal(a.status, 200);
  assert.equal(a.body.answer, 'Hello');
  assert.equal(a.body.session_id, undefined);
  assert.ok(a.cookie);
  await send('/api/chat', { message: 'Follow up' }, a.cookie);
  await send('/api/chat', { message: 'Different browser' });
  assert.deepEqual(requests.map(r => r.body), [{ customer_id: 'demo', message: 'Hello' }, { session_id: 'session-1', message: 'Follow up' }, { customer_id: 'demo', message: 'Different browser' }]);
  const confirmation = await send('/api/chat/confirm', { confirmation_id: 'confirm-1' }, a.cookie);
  assert.match(confirmation.body.answer, /order-1.*confirmed/);
  assert.deepEqual(confirmation.body.pending, {});
  assert.equal(requests.at(-1).path, '/api/sessions/session-1/confirm');
  await send('/api/chat/reset', {}, a.cookie);
  await send('/api/chat', { message: 'New conversation' }, a.cookie);
  assert.equal(requests.at(-1).body.session_id, 'reset-session');
  assert.ok(requests.every(r => r.auth === `Bearer ${apiKey}`));
});

test('rejects identity injection, blank and oversized messages, and cross-origin requests', async t => {
  const send = await fixture(t, () => { throw new Error('Must not call backend'); });
  assert.equal((await send('/api/chat', { message: 'Hi', customer_id: 'victim' })).status, 400);
  assert.equal((await send('/api/chat', { message: 'Hi', session_id: 'victim' })).status, 400);
  assert.equal((await send('/api/chat', { message: '  ' })).status, 400);
  assert.equal((await send('/api/chat', { message: 'x'.repeat(8001) })).status, 400);
  assert.equal((await send('/api/chat', { message: 'Hi' }, '', { Origin: 'https://attacker.example' })).status, 403);
  assert.equal((await send('/api/chat/confirm', { confirmation_id: 'fake' })).status, 409);
});

test('sanitizes backend failures and allows explicit reset after expired session', async t => {
  let count = 0;
  const send = await fixture(t, async () => {
    count += 1;
    if (count === 1) return Response.json({ session_id: 'old', answer: 'Hello', pending: {} });
    if (count === 2) return Response.json({ error: { message: apiKey } }, { status: 500 });
    return Response.json({ error: { code: 'session_not_found' } }, { status: 404 });
  });
  const first = await send('/api/chat', { message: 'Hi' });
  const failed = await send('/api/chat', { message: 'Again' }, first.cookie);
  assert.equal(failed.status, 500);
  assert.ok(!JSON.stringify(failed.body).includes(apiKey));
  assert.equal((await send('/api/chat/reset', {}, first.cookie)).status, 200);
});

test('reports backend unavailability without leaking exception details', async t => {
  const send = await fixture(t, async () => { throw new Error(apiKey); });
  const failed = await send('/api/chat', { message: 'Hi' });
  assert.equal(failed.status, 503);
  assert.equal(failed.body.error.code, 'backend_unavailable');
  assert.ok(!JSON.stringify(failed.body).includes(apiKey));
});
