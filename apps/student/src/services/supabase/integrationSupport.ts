/**
 * What the real-backend tests share: reading their settings, and signing in clients. Used only by
 * tests that run against a throwaway local Supabase stack (see the "Supabase contract tests" job);
 * never import it from app code.
 */

// The client factory and its option type.
import {
  createClient,
  type SupabaseClient,
  type SupabaseClientOptions,
} from '@supabase/supabase-js'

/** A setting from the environment, or undefined when it is missing or empty. */
function setting(name: string): string | undefined {
  // Vitest exposes only VITE_-prefixed variables to tests.
  const value: unknown = import.meta.env[name]
  return typeof value === 'string' && value !== '' ? value : undefined
}

// The project to test against, and the demo accounts the seed creates.
export const URL = setting('VITE_SUPABASE_TEST_URL')
export const ANON_KEY = setting('VITE_SUPABASE_TEST_ANON_KEY')
export const SERVICE_KEY = setting('VITE_SUPABASE_TEST_SERVICE_KEY')
export const EMAIL = setting('VITE_SUPABASE_TEST_EMAIL')
export const PASSWORD = setting('VITE_SUPABASE_TEST_PASSWORD')
export const ADMIN_EMAIL = setting('VITE_SUPABASE_TEST_ADMIN_EMAIL')
// Another student in the same course, for the tests that prove notes stay private.
export const OTHER_EMAIL = setting('VITE_SUPABASE_TEST_OTHER_EMAIL')

/** True when every setting the suites need is present; otherwise they are skipped. */
export const CONFIGURED = Boolean(
  URL && ANON_KEY && SERVICE_KEY && EMAIL && PASSWORD && ADMIN_EMAIL && OTHER_EMAIL,
)

/** Storage that lives only in memory, so tests never touch the browser's. */
function memoryStorage() {
  const items = new Map<string, string>()
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value)
    },
    removeItem: (key: string) => {
      items.delete(key)
    },
  }
}

/** A client signed in as `email`. */
export async function signedIn(email: string, storageKey: string): Promise<SupabaseClient> {
  // Memory storage keeps the session out of the browser's; no refresh timer is needed.
  const options: SupabaseClientOptions<'public'> = {
    auth: { storage: memoryStorage(), storageKey, autoRefreshToken: false },
  }
  const client = createClient(URL ?? '', ANON_KEY ?? '', options)
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD ?? '' })
  if (error) throw new Error(`Could not sign in as ${email}`)
  return client
}

/** A client with the server key, which bypasses Row Level Security. Used only to reset data. */
export function serverClient(): SupabaseClient {
  const options: SupabaseClientOptions<'public'> = { auth: { persistSession: false } }
  const client = createClient(URL ?? '', SERVICE_KEY ?? '', options)
  return client
}
