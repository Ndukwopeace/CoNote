/**
 * Creates the one Supabase client an app uses. Each app builds it once, in its createServices
 * (the only place allowed to touch an implementation), and hands it to its services.
 */

// The SDK.
import { createClient } from '@supabase/supabase-js'

// Where the session is kept, with "Remember me" support.
import type { SessionStorageAdapter } from './rememberStorage'

/** What an app passes in. */
export interface SupabaseClientOptions {
  // The project URL (https only; checked in @conote/core/env).
  url: string
  // The public key. It is meant to be in the browser; Row Level Security protects the data.
  anonKey: string
  // Where the session is stored.
  storage: SessionStorageAdapter
  // A name for the stored session, so apps on one origin (local development) do not share it.
  storageKey: string
}

/** Builds a client that stores its session in `storage`. */
export function createSupabaseClient({
  url,
  anonKey,
  storage,
  storageKey,
}: SupabaseClientOptions): ReturnType<typeof createClient> {
  return createClient(url, anonKey, {
    auth: {
      // The session survives page reloads (in the storage chosen by "Remember me").
      persistSession: true,
      // The access token is renewed before it expires.
      autoRefreshToken: true,
      // SECURITY: the app reads the code from the address itself (reset links) and exchanges it
      // once. Letting the SDK scan every address would also act on links it should ignore.
      detectSessionInUrl: false,
      // SECURITY: PKCE, so a link intercepted on the way (an email scanner, a browser history
      // entry) cannot be turned into a session without the secret kept in this browser.
      flowType: 'pkce',
      storage,
      storageKey,
    },
  })
}
