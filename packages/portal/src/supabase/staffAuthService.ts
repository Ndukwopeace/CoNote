/**
 * Staff sign-in on Supabase (milestone B2.5, D83): the AuthService the admin console and the
 * teacher portal use when VITE_DATA_SOURCE=supabase. The session machinery is shared with the
 * student app (@conote/supabase/sessionCore); this adds the staff rules and wording. It has its
 * own entry point (`@conote/portal/supabase-auth`), so the demo bundle never downloads the
 * Supabase library.
 */

// The client type.
import type { SupabaseClient } from '@supabase/supabase-js'

// The error type every service throws.
import { AppError } from '@conote/core/errors'
// Where the session is kept, with the "Remember me" switch.
import type { RememberStorage } from '@conote/supabase/rememberStorage'
// The session machinery shared with the student app.
import { createSessionCore } from '@conote/supabase/sessionCore'

// The staff email and password rules, shared with the forms and the demo service.
import { forgotPasswordSchema, newStaffPasswordSchema } from '../auth/authSchemas'
// The interface this implementation must satisfy.
import type { AuthService } from '../auth/types'

/** What the factory needs. */
export interface StaffAuthOptions {
  // The one client the app uses.
  client: SupabaseClient
  // The storage the client keeps its session in. Staff sessions are never remembered.
  rememberStorage: RememberStorage
  // The key the client stores its session under, so sign-out can clear it even if the server
  // cannot be reached.
  storageKey: string
  // The app's address, for the link in the reset email.
  origin: string
  // The portal's reset page, such as "/admin/reset-password".
  resetPath: string
}

// The one message for any wrong sign-in detail, as in the demo.
const WRONG_DETAILS = 'Incorrect email or password.'
// The wording the shared mapping uses for a wrong password.
const MAPPED_WRONG_DETAILS = 'Email or password is incorrect.'

/** Trims and lower-cases `email`, or throws a validation error if it is not an address. */
function cleanEmail(email: string): string {
  // The same rule as the forms, so a request that skips the form meets it too.
  const parsed = forgotPasswordSchema.safeParse({ email })
  if (!parsed.success) throw new AppError('validation', 'Enter a valid email address.')
  return parsed.data.email
}

/** Builds the staff AuthService over a Supabase client. */
export function createSupabaseStaffAuthService({
  client,
  rememberStorage,
  storageKey,
  origin,
  resetPath,
}: StaffAuthOptions): AuthService {
  // Reading, signing in and out, the reset link and the listeners.
  const core = createSessionCore({ client, rememberStorage, storageKey })

  return {
    getSession: core.getSession,

    async signIn({ email, password }) {
      const clean = cleanEmail(email)
      if (password.length === 0) throw new AppError('validation', 'Enter your password.')
      try {
        // SECURITY: staff sessions end with the tab. A staff account can change or publish what
        // every student sees, so a session is never left on a shared computer by default.
        return await core.signInWithPassword(clean, password, false)
      } catch (error) {
        // The shared wording differs; staff pages say it this way.
        if (error instanceof AppError && error.message === MAPPED_WRONG_DETAILS) {
          throw new AppError('validation', WRONG_DETAILS)
        }
        throw error
      }
    },

    signOut: core.signOut,

    async requestPasswordReset(email) {
      await core.requestPasswordReset(cleanEmail(email), `${origin}${resetPath}`)
      // A real service sends an email; there is no demo link.
      return {}
    },

    checkResetLink: core.checkResetLink,

    async resetPassword(code, newPassword) {
      // SECURITY: the same strength rules as the form, checked first so a weak password does not
      // spend the link and the person can try again.
      const parsed = newStaffPasswordSchema.safeParse(newPassword)
      if (!parsed.success) {
        throw new AppError('validation', parsed.error.issues[0]?.message ?? 'Check this value.')
      }
      await core.resetPassword(code, newPassword)
    },

    onAuthChange: core.onAuthChange,
  }
}
