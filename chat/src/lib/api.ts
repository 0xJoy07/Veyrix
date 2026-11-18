import { ChatStreamError, readChatStream, type ChatStage } from './chat-stream.mjs';
export class ApiError extends Error {
  constructor(message: string, public code: string) { super(message); }
}
export async function requestChat<T>(message: string, onStatus: (stage: ChatStage) => void): Promise<T> {
  let response: Response;
  try {
    response = await fetch('/api/chat', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' }, body: JSON.stringify({ message }) });
  } catch {
    throw new ApiError('The connection was interrupted. Check your saved conversation before sending again; the request may already have completed.', 'stream_interrupted');
  }
  if (response.ok && response.headers.get('content-type')?.split(';')[0].trim() === 'text/event-stream') {
    try { return await readChatStream(response.body, onStatus) as T; }
    catch (error) {
      if (error instanceof ChatStreamError) throw new ApiError(error.message, error.code);
      throw error;
    }
  }
  // Compatible with servers that still return the original JSON response.
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(data?.error?.message || 'The request could not be completed.', data?.error?.code || 'request_failed');
  if (!data || typeof data.answer !== 'string') throw new ApiError('The reply was interrupted. Check your saved conversation before sending again.', 'stream_interrupted');
  return data as T;
}
export async function request<T>(path: string, body?: Record<string, unknown>, method: 'GET' | 'POST' = 'POST', signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { method, headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined, credentials: 'same-origin', ...(method === 'POST' ? { body: JSON.stringify(body || {}) } : {}), signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError('Cannot reach Veyrix. Check your connection and try again.', 'network_error');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(data?.error?.message || 'The request could not be completed. Please try again.', data?.error?.code || 'request_failed');
  if (!data) throw new ApiError('The server returned an unexpected response.', 'invalid_response');
  return data as T;
}
