// An error response from the API. `details` is the list of { field, message } from a 400.
export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message ?? `Request failed (${status})`);
    this.status = status;
    this.details = body?.error?.details ?? [];
  }
}

// Sends a JSON request and returns the parsed response. Throws ApiError on any non-2xx status,
// so callers only handle the success shape.
export async function request(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, { error: { message: 'Cannot reach the server' } });
  }

  // 204 has no body; a non-JSON body (e.g. a proxy error page) is treated as empty.
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}
