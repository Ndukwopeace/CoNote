/**
 * The Supabase implementation (milestone B2), built service by service. Services that are not
 * connected yet fail with a clear message instead of showing demo data (admin REQUIREMENTS
 * section 23, "nothing fake"). Sign-in (B2.5), courses (B2.6a) and classes (B2.6b) are built; the rest follow.
 */

// The client, and the storage that honours "Remember me".
import { createSupabaseClient } from '@conote/supabase/client'
import { createRememberStorage } from '@conote/supabase/rememberStorage'
// Stands in for the services that are not built yet.
import { notBuilt } from '@conote/supabase/notBuilt'
// The class and course services.
import { createSupabaseClassService } from './supabaseClassService'
import { createSupabaseCourseService } from './supabaseCourseService'
// The staff sign-in service, shared with the teacher portal.
import { createSupabaseStaffAuthService } from '@conote/portal/supabase-auth'

// The console's reset page address, and its storage prefix.
import { ADMIN_ROUTES } from '@/lib/routes'
import { ADMIN_STORAGE_PREFIX } from '@/lib/storage'

// The shape the real implementation returns.
import type { AlertService, AnalyticsService, HealthService, Services, UserService } from '../types'

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
    analytics: notBuilt<AnalyticsService>('The dashboard'),
    alerts: notBuilt<AlertService>('Alerts'),
    health: notBuilt<HealthService>('Platform health'),
    users: notBuilt<UserService>('Users'),
    // Courses, their students and the students' requests to join.
    courses: createSupabaseCourseService({ client }),
    // Classes, with their summary stage and AI job history.
    classes: createSupabaseClassService({ client }),
  }
}
