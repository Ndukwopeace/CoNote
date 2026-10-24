/**
 * The Supabase implementation (milestone B3): the teacher portal on the shared database. Sign-in
 * and the teacher's courses (B3.1), and reviewing and publishing (B3.2).
 */

// The client, and the storage that honours "Remember me".
import { createSupabaseClient } from '@conote/supabase/client'
import { createRememberStorage } from '@conote/supabase/rememberStorage'
// The staff sign-in service, shared with the admin console.
import { createSupabaseStaffAuthService } from '@conote/portal/supabase-auth'

// The portal's reset page address, and its storage prefix.
import { TEACHER_ROUTES } from '@/lib/routes'
import { TEACHER_STORAGE_PREFIX } from '@/lib/storage'

// The shape the real implementation returns.
import type { Services } from '../types'

// The teacher's notices.
import { createSupabaseNotificationService } from './supabaseNotificationService'
// Reviewing and publishing summaries.
import { createSupabaseReviewService } from './supabaseReviewService'
// The teacher's courses and classes.
import { createSupabaseTeachingService } from './supabaseTeachingService'

/** The checked settings the Supabase services need. */
interface SupabaseSettings {
  // The project URL.
  supabaseUrl: string
  // The public key.
  supabaseAnonKey: string
}

/**
 * The key the client stores its session under. It starts with the portal's prefix, so signing
 * out (which clears every key with that prefix) removes it too.
 */
const AUTH_STORAGE_KEY = `${TEACHER_STORAGE_PREFIX}supabase-auth`

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
    flagKey: `${TEACHER_STORAGE_PREFIX}remember`,
  })
  // The one client the portal uses.
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
      resetPath: TEACHER_ROUTES.resetPassword,
    }),
    // The teacher's courses, and the classes of each.
    teaching: createSupabaseTeachingService({ client }),
    // The summaries waiting for review, and saving and publishing a draft.
    review: createSupabaseReviewService({ client }),
    // The notice that a draft is ready, and marking it read.
    notifications: createSupabaseNotificationService({
      client,
      origin: window.location.origin,
    }),
  }
}
