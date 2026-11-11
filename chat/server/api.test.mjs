import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createApiMiddleware } from './api.mjs';

async function fixture(t, fetchImpl) {
  const server = createServer(createApiMiddleware({ fetchImpl }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  return async (path, body, headers = {}) => {
    const response = await fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie') };
  };
}

test('forwards verified session cookies without injecting demo identity or backend secrets', async t => {
  let forwarded;
  const send = await fixture(t, async (url, options) => {
    forwarded = { url, options };
    return Response.json({ answer: 'Hello', chat_id: 'chat-1' }, { headers: { 'Set-Cookie': 'veyrix_session=opaque; HttpOnly; SameSite=Strict; Path=/' } });
  });
  const result = await send('/api/chat', { message: 'Hello' }, { Cookie: 'veyrix_session=opaque', Authorization: 'Bearer browser-supplied' });
  assert.equal(result.status, 200);
  assert.equal(forwarded.url.port, '8001');
  assert.deepEqual(JSON.parse(forwarded.options.body), { message: 'Hello' });
  assert.equal(forwarded.options.headers.Cookie, 'veyrix_session=opaque');
  assert.equal(forwarded.options.headers.Authorization, undefined);
  assert.match(result.cookie, /HttpOnly/);
});

test('keeps account/OTP/address/chat restore routes and upstream authentication errors intact', async t => {
  const paths = [];
  const send = await fixture(t, async (url, options) => {
    paths.push(url.pathname);
    if (url.pathname === '/api/account') return Response.json({ authenticated: false });
    return Response.json({ error: { code: 'verification_required', message: 'Verify your email.' } }, { status: 401 });
  });
  assert.equal((await send('/api/account')).body.authenticated, false);
  for (const path of ['/api/auth/start', '/api/auth/verify', '/api/addresses', '/api/checkout/prepare', '/api/chat/restore', '/api/chat/end', '/api/orders/lookup']) {
    const result = await send(path, {});
    assert.equal(result.status, 401);
    assert.equal(result.body.error.code, 'verification_required');
  }
  assert.equal(paths.length, 8);
});

test('rejects cross-origin requests, unsupported routes, methods, and oversized bodies', async t => {
  const send = await fixture(t, () => { throw new Error('Should not forward'); });
  assert.equal((await send('/api/chat', {}, { Origin: 'https://attacker.example' })).status, 403);
  assert.equal((await send('/api/chat', {}, { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  assert.equal((await send('/api/internal/tools', {})).status, 404);
  assert.equal((await send('/api/chat')).status, 405);
  assert.equal((await send('/api/chat', { message: 'x'.repeat(65536) })).status, 413);
});

test('does not expose connection exception details', async t => {
  const send = await fixture(t, async () => { throw new Error('private connection secret'); });
  const result = await send('/api/chat', { message: 'Hi' });
  assert.equal(result.status, 503);
  assert.equal(result.body.error.code, 'backend_unavailable');
  assert.ok(!JSON.stringify(result.body).includes('private connection secret'));
});
