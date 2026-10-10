/**
 * The steps every admin function starts with (admin REQUIREMENTS section 20): check the caller's
 * token, load their profile and require an active administrator, then read the JSON body. Each
 * function supplies only what it does after that.
 */

// Checks a value against a schema.
import type { ZodType } from 'zod'

// The clients and the settings.
import type { Clients } from './clients.ts'
import type { FunctionEnv } from './env.ts'
// The answers.
import { preflight, refuse } from './http.ts'

/** Everything a function is given. */
export interface FunctionDeps {
  env: FunctionEnv
  clients: Clients
  // The clock. Tests set it; the function uses the real one.
  now: () => Date
}

/** What the function body receives once the caller is checked. */
export interface AdminContext<Body> {
  // The administrator's account ID.
  actorId: string
  // The validated body.
  body: Body
}

/** The bearer token in the request, or null. */
function bearerToken(request: Request): string | null {
  // The header looks like "Bearer eyJ…".
  const header = request.headers.get('Authorization') ?? ''
  const match = /^Bearer\s+(\S+)$/i.exec(header)
  return match?.[1] ?? null
}

/**
 * Builds a function's handler. `schema` describes the body; `run` does the work for an active
 * administrator. Anything else is refused before `run` is reached.
 */
export function adminHandler<Body>(
  deps: FunctionDeps,
  schema: ZodType<Body>,
  run: (context: AdminContext<Body>) => Promise<Response>,
): (request: Request) => Promise<Response> {
  return async (request) => {
    // A browser asks first whether it may call; answer yes.
    if (request.method === 'OPTIONS') return preflight()
    if (request.method !== 'POST') return refuse('validation', 'Use POST.')
    // 1. The caller's token.
    const token = bearerToken(request)
    if (token === null) return refuse('unauthorized', 'Sign in again to continue.')
    // SECURITY: the token must belong to a real, current session.
    const actorId = await deps.clients.callerId(token)
    if (actorId === null) return refuse('unauthorized', 'Sign in again to continue.')
    // 2. The caller's profile. SECURITY: the role and status come from the profiles table, which
    // only an administrator can change, never from anything the request says, so a student or a
    // teacher gets 403 here whatever they send.
    const { data: profile, error } = await deps.clients.service
      .from('profiles')
      .select('role, status')
      .eq('id', actorId)
      .maybeSingle()
    if (error) return refuse('unknown', 'Something went wrong. Try again.')
    if (profile?.role !== 'admin' || profile.status !== 'active') {
      return refuse('forbidden', 'You do not have access to this.')
    }
    // 3. The body, checked before anything is done with it.
    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      return refuse('validation', 'Send a JSON body.')
    }
    const parsed = schema.safeParse(raw)
    if (!parsed.success) {
      return refuse('validation', parsed.error.issues[0]?.message ?? 'Check the details.')
    }
    // 4 and 5. The work, and its audit entry, are the function's own.
    return run({ actorId, body: parsed.data })
  }
}
