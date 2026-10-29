/**
 * Answers in the one shape the console understands: `{ error: { kind, message } }` for a refusal
 * and a small JSON object for success. The kinds match the app's own error kinds, so the service
 * can turn an answer back into the error a screen already handles.
 */

/** The kinds of refusal a function gives. */
export type ErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'validation'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'unknown'

/** The HTTP status each kind is sent with. */
const STATUS: Record<ErrorKind, number> = {
  unauthorized: 401,
  forbidden: 403,
  validation: 400,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  unknown: 502,
}

/**
 * Which browsers may call a function. The call carries the person's own sign-in in the
 * `Authorization` header, not a cookie, so a page on another site cannot use it without that
 * token; every function checks the token itself.
 */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/**
 * Headers every answer carries. SECURITY: `no-store` keeps one person's answer out of any shared
 * cache, and `nosniff` stops a browser from guessing that the JSON is a page or a script.
 */
const SAFE_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
}

/** A JSON answer with `status`. */
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, ...SAFE_HEADERS, 'Content-Type': 'application/json' },
  })
}

/** A refusal of `kind` with a message that is safe to show. */
export function refuse(kind: ErrorKind, message: string): Response {
  return json({ error: { kind, message } }, STATUS[kind])
}

/** The answer to a browser's preflight question. */
export function preflight(): Response {
  return new Response(null, { status: 204, headers: { ...CORS_HEADERS, ...SAFE_HEADERS } })
}
