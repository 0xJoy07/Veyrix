const STAGES = new Set(['checking', 'working', 'saving']);
const MAX_STREAM = 1024 * 1024;
const MAX_EVENT = 256 * 1024;
export class ChatStreamError extends Error {
  constructor(message, code = 'stream_interrupted') { super(message); this.code = code; }
}
const interrupted = () => new ChatStreamError('The reply was interrupted. Check your saved conversation before sending again; the request may already have completed.');

/** Only fixed progress stages and the server's persisted final answer reach the UI. */
export async function readChatStream(body, onStatus = () => {}) {
  if (!body) throw interrupted();
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let buffer = '', bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) throw interrupted();
      bytes += value.byteLength;
      if (bytes > MAX_STREAM) throw interrupted();
      buffer += decoder.decode(value, { stream: true });
      let boundary;
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        if (frame.length > MAX_EVENT) throw interrupted();
        let event = 'message';
        const data = [];
        for (const line of frame.split(/\r?\n/)) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
        }
        if (!data.length) continue;
        const payload = JSON.parse(data.join('\n'));
        if (event === 'status' && STAGES.has(payload?.stage)) onStatus(payload.stage);
        if (event === 'error') {
          const error = payload?.error;
          throw new ChatStreamError(typeof error?.message === 'string' ? error.message : 'The request could not be completed.', typeof error?.code === 'string' ? error.code : 'request_failed');
        }
        if (event === 'result') {
          if (!payload || typeof payload.answer !== 'string' || payload.answer.length > 32000) throw interrupted();
          return payload;
        }
      }
      if (buffer.length > MAX_EVENT) throw interrupted();
    }
  } catch (error) {
    if (error instanceof ChatStreamError) throw error;
    throw interrupted();
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
