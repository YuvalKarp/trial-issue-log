// An error response from the API. `details` is the list of { field, message } from a 400.
export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message ?? `Request failed (${status})`);
    this.status = status;
    this.details = body?.error?.details ?? [];
  }
}

// Sends a request and returns the parsed JSON response. Throws ApiError on any non-2xx status,
// so callers only handle the success shape.
//   body         an object, sent as JSON
//   text + type  raw text with its content type instead, e.g. a CSV file as 'text/csv'
export async function request(path, { method = 'GET', body, text, type } = {}) {
  let headers;
  let payload;
  if (text !== undefined) {
    headers = { 'Content-Type': type };
    payload = text;
  } else if (body) {
    headers = { 'Content-Type': 'application/json' };
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(path, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, { error: { message: 'Cannot reach the server' } });
  }

  // 204 has no body; a non-JSON body (e.g. a proxy error page) is treated as empty.
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}
