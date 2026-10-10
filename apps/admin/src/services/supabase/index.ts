/**
 * The Supabase implementation (milestone B2): every admin service on the shared database. Sign-in
 * (B2.5), courses (B2.6a), classes (B2.6b), users (B2.7) and the dashboard (B2.8). A service that
 * is not connected would fail with a clear message instead of showing demo data (admin
 * REQUIREMENTS section 23, "nothing fake"); none remains.
 */

// The client, and the storage that honours "Remember me".
import { createSupabaseClient } from '@conote/supabase/client'
import { createRememberStorage } from '@conote/supabase/rememberStorage'
// The dashboard services.
import { createSupabaseAlertService } from './supabaseAlertService'
import { createSupabaseAnalyticsService } from './supabaseAnalyticsService'
import { createSupabaseHealthService } from './supabaseHealthService'
// The class and course services.
import { createSupabaseClassService } from './supabaseClassService'
import { createSupabaseCourseService } from './supabaseCourseService'
// The user service.
import { createSupabaseUserService } from './supabaseUserService'
// The staff sign-in service, shared with the teacher portal.
import { createSupabaseStaffAuthService } from '@conote/portal/supabase-auth'

// The console's reset page address, and its storage prefix.
import { ADMIN_ROUTES } from '@/lib/routes'
import { ADMIN_STORAGE_PREFIX } from '@/lib/storage'

// The shape the real implementation returns.
import type { Services } from '../types'

/** The checked settings the Supabase services need. */
interface SupabaseSettings {
  // The project URL.
  supabaseUrl: string
  // The public key.
  supabaseAnonKey: string
}

/**
 * The key the client stores its session under. It starts with the console's prefix, so signing
 * out (which clears every key with that prefix) removes it too.
 */
const AUTH_STORAGE_KEY = `${ADMIN_STORAGE_PREFIX}supabase-auth`

/** Builds the Supabase services. */
export function createSupabaseServices({
  supabaseUrl,
  supabaseAnonKey,
}: SupabaseSettings): Services {
  // The "Remember me" storage. Staff sign-in never asks to be remembered, so the session stays
  // in sessionStorage and ends with the tab.
  const rememberStorage = createRememberStorage({
    local: window.localStorage,
    session: window.sessionStorage,
    flagKey: `${ADMIN_STORAGE_PREFIX}remember`,
  })
  // The one client the console uses.
  const client = createSupabaseClient({
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
    storage: rememberStorage.storage,
    storageKey: AUTH_STORAGE_KEY,
  })
  return {
    // Sign-in, sign-out and password reset.
    auth: createSupabaseStaffAuthService({
      client,
      rememberStorage,
      storageKey: AUTH_STORAGE_KEY,
      origin: window.location.origin,
      resetPath: ADMIN_ROUTES.resetPassword,
    }),
    // Not connected yet.
    // The dashboard: counts and the activity chart, alerts, and platform health.
    analytics: createSupabaseAnalyticsService({ client }),
    alerts: createSupabaseAlertService({ client }),
    health: createSupabaseHealthService({ client }),
    // Accounts, invitations and status changes (the last two through Edge Functions).
    users: createSupabaseUserService({ client }),
    // Courses, their students and the students' requests to join.
    courses: createSupabaseCourseService({ client }),
    // Classes, with their summary stage and AI job history.
    classes: createSupabaseClassService({ client }),
  }
}
