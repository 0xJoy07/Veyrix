import { randomBytes } from 'node:crypto';

const COOKIE = 'veyrix_demo';
const MAX_BODY = 64 * 1024;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function reply(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(data));
}

function fail(res, status, code, message) { reply(res, status, { error: { code, message } }); }

async function readBody(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) {
    throw Object.assign(new Error('Send application/json.'), { status: 415 });
  }
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > MAX_BODY) throw Object.assign(new Error('Request body exceeds 64 KiB.'), { status: 413 });
    chunks.push(chunk);
  }
  let value;
  try { value = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { throw new Error('Send a valid JSON object.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Send a JSON object.');
  return value;
}

/** Loopback-only demo adapter. Never expose this as a public customer-authentication service. */
export function createApiMiddleware({ backendUrl = 'http://127.0.0.1:8000', apiKey = '', customerId = 'demo', fetchImpl = fetch } = {}) {
  const upstream = new URL(backendUrl);
  if (!['http:', 'https:'].includes(upstream.protocol)) throw new Error('SHOPPING_BACKEND_URL must use HTTP or HTTPS.');
  const sessions = new Map();

  return async function apiMiddleware(req, res, next = () => fail(res, 404, 'not_found', 'Endpoint not found.')) {
    const path = (req.url || '').split('?')[0];
    if (!path.startsWith('/api/')) return next();
    let host;
    try { host = new URL(`http://${req.headers.host}`).hostname; } catch { /* rejected below */ }
    if (!LOCAL_HOSTS.has(host)) return fail(res, 403, 'local_only', 'This demo is available only on localhost.');
    if (req.headers.origin) {
      let origin;
      try { origin = new URL(req.headers.origin); } catch { /* rejected below */ }
      if (!origin || !LOCAL_HOSTS.has(origin.hostname) || origin.host !== req.headers.host) {
        return fail(res, 403, 'invalid_origin', 'Cross-origin requests are not allowed.');
      }
    }
    if (req.headers['sec-fetch-site'] === 'cross-site') return fail(res, 403, 'invalid_origin', 'Cross-site requests are not allowed.');
    const health = path === '/api/health';
    if (!health && !['/api/chat', '/api/chat/reset', '/api/chat/confirm'].includes(path)) return fail(res, 404, 'not_found', 'Endpoint not found.');
    if (req.method !== (health ? 'GET' : 'POST')) return fail(res, 405, 'method_not_allowed', 'This method is not supported.');
    if (apiKey.length < 32 || /\s/.test(apiKey)) return fail(res, 503, 'not_configured', 'Set SHOPPING_API_KEY in chat/.env to match the backend.');

    async function call(route, body) {
      let response;
      try {
        response = await fetchImpl(new URL(route, upstream), {
          method: body === undefined ? 'GET' : 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal: AbortSignal.timeout(120_000),
        });
      } catch {
        throw Object.assign(new Error('The shopping backend is unavailable. Check that it is running, then try again.'), { status: 503, code: 'backend_unavailable' });
      }
      let data;
      try { data = await response.json(); } catch { throw Object.assign(new Error('The backend returned an invalid response.'), { status: 502, code: 'invalid_response' }); }
      if (!response.ok) {
        const errors = {
          400: ['invalid_request', 'The operation could not be completed. Check the request or prepare a new confirmation.'],
          401: ['backend_authentication', 'The server API key does not match the backend configuration.'],
          404: ['session_not_found', 'This conversation has expired. Start a new chat to continue.'],
          503: ['provider_unavailable', 'The shopping provider is unavailable. Please try again later.'],
        };
        const [code, message] = errors[response.status] || ['backend_error', 'The shopping backend could not complete this request.'];
        throw Object.assign(new Error(message), { status: response.status === 401 ? 502 : response.status, code });
      }
      return data;
    }

    if (health) {
      try { const result = await call('/health'); reply(res, 200, { status: result.status === 'ok' ? 'ok' : 'unavailable' }); }
      catch (error) { fail(res, error.status || 503, error.code || 'backend_unavailable', error.message); }
      return;
    }

    let body;
    try {
      body = await readBody(req);
      const fields = path === '/api/chat' ? ['message'] : path.endsWith('/confirm') ? ['confirmation_id'] : [];
      if (Object.keys(body).some(key => !fields.includes(key))) throw new Error('The request contains unsupported fields.');
      if (path === '/api/chat' && (typeof body.message !== 'string' || !body.message.trim() || body.message.length > 8000)) throw new Error('Enter a message between 1 and 8,000 characters.');
      if (path.endsWith('/confirm') && (typeof body.confirmation_id !== 'string' || !body.confirmation_id.trim() || body.confirmation_id.length > 100)) throw new Error('Provide a valid confirmation ID.');
    } catch (error) { return fail(res, error.status || 400, 'invalid_request', error.message); }

    const cookie = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    let state = cookie && sessions.get(cookie);
    if (!state) {
      if (sessions.size >= 1000) return fail(res, 503, 'capacity', 'The demo has reached its session limit. Restart the demo server.');
      const token = randomBytes(32).toString('hex');
      state = { sessionId: null, busy: false };
      sessions.set(token, state);
      res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict`);
    }
    if (state.busy) return fail(res, 409, 'request_in_progress', 'Wait for the current response before sending another request.');
    state.busy = true;
    try {
      if (path === '/api/chat') {
        const identity = state.sessionId ? { session_id: state.sessionId } : { customer_id: customerId };
        const data = await call('/api/chat', { message: body.message.trim(), ...identity });
        if (typeof data.session_id !== 'string' || typeof data.answer !== 'string') throw Object.assign(new Error('The backend returned an invalid chat response.'), { status: 502, code: 'invalid_response' });
        state.sessionId = data.session_id;
        reply(res, 200, { answer: data.answer, pending: data.pending || {} });
      } else if (path.endsWith('/reset')) {
        if (state.sessionId) {
          try {
            const data = await call(`/api/sessions/${encodeURIComponent(state.sessionId)}/reset`, {});
            if (typeof data.session_id !== 'string' || !data.session_id) throw Object.assign(new Error('The backend returned an invalid reset response.'), { status: 502, code: 'invalid_response' });
            state.sessionId = data.session_id;
          } catch (error) {
            if (error.code !== 'session_not_found') throw error;
            state.sessionId = null;
          }
        }
        reply(res, 200, { status: 'reset' });
      } else {
        if (!state.sessionId) return fail(res, 409, 'no_session', 'Start a conversation before confirming an action.');
        const result = await call(`/api/sessions/${encodeURIComponent(state.sessionId)}/confirm`, body);
        const id = result.order_id || result.id;
        if (typeof id !== 'string' || !['confirmed', 'preparing', 'cancelled'].includes(result.status)) throw Object.assign(new Error('The backend returned an invalid confirmation response. Check order status before retrying.'), { status: 502, code: 'invalid_response' });
        reply(res, 200, { answer: result.status === 'cancelled' ? `Order ${id} has been cancelled.` : `Order ${id} is confirmed. Payment is due on delivery.`, pending: {}, result });
      }
    } catch (error) { fail(res, error.status || 502, error.code || 'backend_error', error.message); }
    finally { state.busy = false; }
  };
}
