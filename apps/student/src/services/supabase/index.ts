/**
 * The Supabase implementation (milestone B2), built service by service. Services that are not
 * connected yet fail with a clear message instead of showing demo data.
 */

// The client, and the storage that honours "Remember me".
import { createSupabaseClient } from '@conote/supabase/client'
import { createRememberStorage } from '@conote/supabase/rememberStorage'

// Builds "conote:"-prefixed storage keys.
import { storageKey } from '@/lib/storage'

// The shape the real implementation returns.
import type { Services } from '../types'

// The services built so far.
import { createSupabaseAuthService } from './supabaseAuthService'
// Stands in for the rest.
import { notBuilt } from './notBuilt'

/** The checked settings the Supabase services need. */
interface SupabaseSettings {
  // The project URL.
  supabaseUrl: string
  // The public key.
  supabaseAnonKey: string
}

/** The key the client stores its session under. */
const AUTH_STORAGE_KEY = storageKey('supabase-auth')

/** Builds the Supabase services. */
export function createSupabaseServices({
  supabaseUrl,
  supabaseAnonKey,
}: SupabaseSettings): Services {
  // SECURITY: the session goes to long-lived storage only when the student chose "Remember me".
  const rememberStorage = createRememberStorage({
    local: window.localStorage,
    session: window.sessionStorage,
    flagKey: storageKey('remember'),
  })
  // The one client the app uses.
  const client = createSupabaseClient({
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
    storage: rememberStorage.storage,
    storageKey: AUTH_STORAGE_KEY,
  })
  return {
    // Sign-up, sign-in and password reset.
    auth: createSupabaseAuthService({
      client,
      rememberStorage,
      storageKey: AUTH_STORAGE_KEY,
      origin: window.location.origin,
    }),
    // Not connected yet.
    courses: notBuilt('Courses'),
    classes: notBuilt('Classes'),
    enrolment: notBuilt('Joining courses'),
    notes: notBuilt('Notes'),
    summaries: notBuilt('Summaries'),
    notifications: notBuilt('Notifications'),
    ai: notBuilt('Ask AI'),
    profile: notBuilt('Your profile'),
  }
}
