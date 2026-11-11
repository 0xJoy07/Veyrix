export class ApiError extends Error {
  constructor(message: string, public code: string) { super(message); }
}
export async function request<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) });
  } catch { throw new ApiError('Cannot reach the demo server. Check your connection and try again.', 'network_error'); }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(data?.error?.message || 'The request could not be completed. Please try again.', data?.error?.code || 'request_failed');
  if (!data) throw new ApiError('The server returned an unexpected response.', 'invalid_response');
  return data as T;
}
