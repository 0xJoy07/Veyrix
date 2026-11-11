export class ApiError extends Error {
  constructor(message: string, public code: string) { super(message); }
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
