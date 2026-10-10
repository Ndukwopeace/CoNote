/**
 * Runs the Edge Functions' handlers in-process, in Node, against a real Supabase stack. The
 * functions run in Supabase's Deno runtime, which the CI stack does not start; their logic is plain
 * TypeScript, so a test can call the same handlers with the same requests and check the same
 * answers. Used only by tests that run against the throwaway local stack.
 */

// The handlers, the settings and the real clients, exactly as the functions use them.
import { inviteUserHandler } from '../../../supabase/functions/_shared/inviteUser.ts'
import { sendPasswordResetHandler } from '../../../supabase/functions/_shared/sendPasswordReset.ts'
import { setUserStatusHandler } from '../../../supabase/functions/_shared/setUserStatus.ts'
import { createClients } from '../../../supabase/functions/_shared/clients.ts'
import { readEnv } from '../../../supabase/functions/_shared/env.ts'

/** What a function answered: the HTTP status and the JSON body. */
export interface FunctionResult {
  status: number
  body: unknown
}

/** What the bridge needs. */
export interface BridgeOptions {
  // The stack's address and keys.
  url: string
  anonKey: string
  serviceKey: string
  // The clock the functions stamp their audit entries with.
  now: () => Date
  // The signed-in administrator's access token, read when each call is made.
  token: () => Promise<string | null>
}

/** Builds a caller that answers "invite-user", "set-user-status" and "send-password-reset". */
export function createFunctionBridge({ url, anonKey, serviceKey, now, token }: BridgeOptions) {
  // The settings, with app addresses the emails would link to.
  const settings: Record<string, string> = {
    SUPABASE_URL: url,
    SUPABASE_ANON_KEY: anonKey,
    SUPABASE_SERVICE_ROLE_KEY: serviceKey,
    APP_URL_STUDENT: 'http://localhost:4173',
    APP_URL_TEACHER: 'http://localhost:4175',
    APP_URL_ADMIN: 'http://localhost:4174',
  }
  const env = readEnv((name) => settings[name])
  const deps = { env, clients: createClients(env), now }
  // Each function's handler, by name.
  const handlers: Record<string, ((request: Request) => Promise<Response>) | undefined> = {
    'invite-user': inviteUserHandler(deps),
    'set-user-status': setUserStatusHandler(deps),
    'send-password-reset': sendPasswordResetHandler(deps),
  }
  return async (name: string, body: Record<string, unknown>): Promise<FunctionResult> => {
    const handler = handlers[name]
    // A name no function has, as Supabase would answer it.
    if (!handler)
      return { status: 404, body: { error: { kind: 'not_found', message: 'No such function.' } } }
    const access = await token()
    // The same request the console's call would make.
    const response = await handler(
      new Request(`${url}/functions/v1/${name}`, {
        method: 'POST',
        headers: access === null ? {} : { Authorization: `Bearer ${access}` },
        body: JSON.stringify(body),
      }),
    )
    return { status: response.status, body: await response.json() }
  }
}
