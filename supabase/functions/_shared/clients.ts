/**
 * The two Supabase clients a function uses, and the check of who is calling. Behind an interface
 * so tests can stand in for it.
 */

// The SDK.
import {
  createClient,
  type SupabaseClient,
  type SupabaseClientOptions,
} from '@supabase/supabase-js'

// The settings.
import type { FunctionEnv } from './env.ts'

/** What a function needs from Supabase. */
export interface Clients {
  // SECURITY: acts with the server key, which bypasses Row Level Security. Used only after the
  // caller has been checked to be an active administrator.
  service: SupabaseClient
  // Acts with the public key, as a browser would. Used to send the emails Supabase sends for a
  // person who asks for them.
  anon: SupabaseClient
  // The account ID the token belongs to, or null if the token is missing, forged or expired.
  callerId: (token: string) => Promise<string | null>
}

/** Options that keep a server-side client from storing or refreshing sessions. */
const OPTIONS: SupabaseClientOptions<'public'> = {
  auth: { persistSession: false, autoRefreshToken: false },
}

/** Builds the clients for `env`. */
export function createClients(env: FunctionEnv): Clients {
  // The client with the server key.
  const service = createClient(env.url, env.serviceKey, OPTIONS)
  // The client with the public key.
  const anon = createClient(env.url, env.anonKey, OPTIONS)
  return {
    service,
    anon,
    async callerId(token) {
      // SECURITY: the token is checked with Supabase Auth, not just decoded, so a forged or
      // expired token is refused.
      const { data, error } = await anon.auth.getUser(token)
      return error ? null : data.user.id
    },
  }
}
