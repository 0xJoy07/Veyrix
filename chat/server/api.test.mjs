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
  return async (path, body, headers = {}, raw = false) => {
    const response = await fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (raw) return response;
    return { status: response.status, body: response.headers.get('content-type')?.startsWith('text/event-stream') ? await response.text() : await response.json(), cookie: response.headers.get('set-cookie') };
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

test('passes chat progress streams and Accept without forwarding browser authorization', async t => {
  let headers;
  const wire = 'event: status\ndata: {"stage":"working"}\n\nevent: result\ndata: {"answer":"Ready"}\n\n';
  const send = await fixture(t, async (_url, options) => {
    headers = options.headers;
    return new Response(wire, { headers: { 'Content-Type': 'text/event-stream' } });
  });
  const response = await send('/api/chat', { message: 'Hi' }, { Accept: 'text/event-stream', Authorization: 'secret' });
  assert.equal(response.body, wire);
  assert.equal(headers.Accept, 'text/event-stream');
  assert.equal(headers.Authorization, undefined);
});

test('stream negotiation preserves JSON errors and is restricted to chat', async t => {
  const accepts = [];
  const send = await fixture(t, async (_url, options) => {
    accepts.push(options.headers.Accept);
    return Response.json({ error: { code: 'session_expired', message: 'Verify again.' } }, { status: 401 });
  });
  assert.equal((await send('/api/chat', {}, { Accept: 'text/event-stream' })).body.error.code, 'session_expired');
  await send('/api/chat/confirm', {}, { Accept: 'text/event-stream' });
  assert.deepEqual(accepts, ['text/event-stream', undefined]);
});

test('forwards first progress chunk before upstream completion', { timeout: 5000 }, async t => {
  let controller;
  const encoder = new TextEncoder();
  const send = await fixture(t, async () => new Response(new ReadableStream({ start(value) { controller = value; value.enqueue(encoder.encode('event: status\ndata: {"stage":"working"}\n\n')); } }), { headers: { 'Content-Type': 'text/event-stream' } }));
  const response = await send('/api/chat', { message: 'Hi' }, { Accept: 'text/event-stream' }, true);
  const reader = response.body.getReader();
  const first = await reader.read();
  assert.match(new TextDecoder().decode(first.value), /working/);
  controller.enqueue(encoder.encode('event: result\ndata: {"answer":"Done"}\n\n'));
  controller.close();
  assert.match(new TextDecoder().decode((await reader.read()).value), /Done/);
  assert.equal((await reader.read()).done, true);
});

test('an interrupted streaming request advises checking saved state without leaking transport errors', async t => {
  const send = await fixture(t, async () => { throw new Error('private upstream detail'); });
  const result = await send('/api/chat', { message: 'Update cart' }, { Accept: 'text/event-stream' });
  assert.equal(result.status, 503);
  assert.equal(result.body.error.code, 'stream_interrupted');
  assert.match(result.body.error.message, /saved conversation/);
  assert.ok(!result.body.error.message.includes('private upstream'));
});
