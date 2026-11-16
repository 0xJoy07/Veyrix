import { once } from 'node:events';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const GET_ROUTES = new Set(['/api/health', '/api/account']);
const POST_ROUTES = new Set([
  '/api/auth/start', '/api/auth/verify', '/api/auth/logout', '/api/account/profile', '/api/addresses',
  '/api/checkout/prepare', '/api/chat', '/api/chat/confirm', '/api/chat/end',
  '/api/chat/reset', '/api/chat/restore', '/api/orders/lookup', '/api/orders/cancel/prepare',
]);
const MAX_BODY = 64 * 1024;
function fail(res, status, code, message) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify({ error: { code, message } }));
}
/** Same-origin transport only. The Node service owns all identity and state. */
export function createApiMiddleware({ backendUrl = 'http://127.0.0.1:8001', fetchImpl = fetch } = {}) {
  const upstream = new URL(backendUrl);
  if (!['http:', 'https:'].includes(upstream.protocol)) throw new Error('COMMERCE_API_URL must use HTTP or HTTPS.');
  return async function apiMiddleware(req, res, next = () => fail(res, 404, 'not_found', 'Endpoint not found.')) {
    const path = (req.url || '').split('?')[0];
    if (!path.startsWith('/api/')) return next();
    let host;
    try { host = new URL(`http://${req.headers.host}`).hostname; } catch { /* rejected below */ }
    if (!LOCAL_HOSTS.has(host)) return fail(res, 403, 'local_only', 'This development server is available only on localhost.');
    if (req.headers.origin) {
      let origin;
      try { origin = new URL(req.headers.origin); } catch { /* rejected below */ }
      if (!origin || !LOCAL_HOSTS.has(origin.hostname) || origin.host !== req.headers.host) {
        return fail(res, 403, 'invalid_origin', 'Cross-origin requests are not allowed.');
      }
    }
    if (req.headers['sec-fetch-site'] === 'cross-site') return fail(res, 403, 'invalid_origin', 'Cross-site requests are not allowed.');
    if (!GET_ROUTES.has(path) && !POST_ROUTES.has(path)) return fail(res, 404, 'not_found', 'Endpoint not found.');
    const started = performance.now();
    res.on('finish', () => console.log(`[chat] ${new Date().toISOString()} ${req.method} ${path} ${res.statusCode} ${Math.round(performance.now() - started)}ms`));
    const method = GET_ROUTES.has(path) ? 'GET' : 'POST';
    if (req.method !== method) return fail(res, 405, 'method_not_allowed', 'This method is not supported.');
    let body;
    if (method === 'POST') {
      if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return fail(res, 415, 'invalid_request', 'Send application/json.');
      const chunks = [];
      let bytes = 0;
      try {
        for await (const chunk of req) {
          bytes += chunk.length;
          if (bytes > MAX_BODY) return fail(res, 413, 'request_too_large', 'Request body exceeds 64 KiB.');
          chunks.push(chunk);
        }
        body = Buffer.concat(chunks).toString('utf8');
        const parsed = JSON.parse(body);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      } catch { return fail(res, 400, 'invalid_request', 'Send a valid JSON object.'); }
    }
    const wantsStream = path === '/api/chat' && req.headers.accept === 'text/event-stream';
    const controller = new AbortController();
    const disconnected = () => controller.abort();
    res.once('close', disconnected);
    try {
      const response = await fetchImpl(new URL(path, upstream), {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(wantsStream ? { Accept: 'text/event-stream' } : {}),
          ...(req.headers.cookie ? { Cookie: req.headers.cookie } : {}),
          ...(req.headers.origin ? { Origin: req.headers.origin } : {}),
        },
        ...(body === undefined ? {} : { body }),
        signal: AbortSignal.any([AbortSignal.timeout(180_000), controller.signal]),
        redirect: 'error',
      });
      const cookies = response.headers.getSetCookie();
      if (cookies.length) res.setHeader('Set-Cookie', cookies);
      if (wantsStream && response.ok && response.headers.get('content-type')?.split(';')[0].trim() === 'text/event-stream' && response.body) {
        res.writeHead(response.status, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Accel-Buffering': 'no' });
        res.flushHeaders();
        let bytes = 0;
        for await (const chunk of response.body) {
          bytes += chunk.byteLength;
          if (bytes > 1024 * 1024) throw new Error('Response too large');
          if (!res.write(chunk)) await once(res, 'drain', { signal: controller.signal });
        }
        res.end();
        return;
      }
      const data = await response.json();
      res.writeHead(response.status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(JSON.stringify(data));
    } catch {
      if (res.destroyed) return;
      if (res.headersSent) {
        res.end('event: error\ndata: ' + JSON.stringify({ error: { code: 'stream_interrupted', message: 'The reply was interrupted. Check your saved conversation before sending again; the request may already have completed.' } }) + '\n\n');
        return;
      }
      if (wantsStream) return fail(res, 503, 'stream_interrupted', 'The connection was interrupted. Check your saved conversation before sending again; the request may already have completed.');
      fail(res, 503, 'backend_unavailable', 'Cannot reach the Veyrix service. Check that the Node backend is running, then try again.');
    } finally {
      res.removeListener('close', disconnected);
      controller.abort();
    }
  };
}
