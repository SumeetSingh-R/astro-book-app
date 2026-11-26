// Small HTTP helpers shared by the API handlers.

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export function errorResponse(err) {
  if (err instanceof ApiError) {
    return json({ error: { code: err.code, message: err.message } }, err.status);
  }
  console.error('Unhandled API error:', err);
  return json({ error: { code: 'internal_error', message: 'Something went wrong. Please try again.' } }, 500);
}

export function requireMethod(req, method) {
  if (req.method !== method) throw new ApiError(405, 'method_not_allowed', `Use ${method} for this endpoint.`);
}

export function bearerToken(req) {
  const header = req.headers.get('authorization') ?? '';
  const m = /^Bearer\s+(.+)$/i.exec(header);
  if (!m) throw new ApiError(401, 'not_signed_in', 'Sign in to use this feature.');
  return m[1].trim();
}

export async function readJson(req) {
  let body;
  try { body = await req.json(); } catch { throw new ApiError(400, 'invalid_json', 'Request body must be JSON.'); }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'invalid_json', 'Request body must be a JSON object.');
  }
  return body;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function requireUuid(value, field) {
  if (typeof value !== 'string' || !UUID.test(value)) {
    throw new ApiError(400, 'invalid_input', `${field} must be a valid id.`);
  }
  return value;
}
