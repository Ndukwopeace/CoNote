/**
 * Authentication on Supabase (milestone B2). It meets the same AuthService contract as the demo,
 * so no page changes when the data source does. Sessions live in the storage the client was
 * built with, so "Remember me" decides how long they last. The session machinery (listeners, late
 * reports, the reset link) is shared with the staff portals in @conote/supabase/sessionCore
 * (D83); this file adds the student's rules, wording, sign-up, Google and password change.
 */

// The client type.
import type { SupabaseClient } from '@supabase/supabase-js'

// The error type every service throws.
import { AppError } from '@conote/core/errors'
// Turns Supabase failures into AppErrors.
import { fromSupabaseError } from '@conote/supabase/errors'
// Where the session is kept, with the "Remember me" switch.
import type { RememberStorage } from '@conote/supabase/rememberStorage'
// The session machinery shared with the staff portals.
import { createSessionCore } from '@conote/supabase/sessionCore'

// The checks every auth service runs, and the name and password rules.
import { assertEmail, assertRule } from '@/lib/authRules'
import { fullNameSchema, newPasswordSchema } from '@/lib/authSchemas'
// Addresses the emails and the Google redirect return to.
import { ROUTES } from '@/lib/routes'
// Session shape returned to the app.
import type { Session } from '@/types/auth'

// The interface this implementation must satisfy.
import type { AuthService } from '../types'

/** What the factory needs. */
interface SupabaseAuthOptions {
  // The one client the app uses.
  client: SupabaseClient
  // The "Remember me" switch for the client's storage.
  rememberStorage: RememberStorage
  // The key the client stores its session under, so sign-out can clear it even if the server
  // cannot be reached.
  storageKey: string
  // The app's address, for links in emails and the Google redirect.
  origin: string
}

/** The Supabase auth service: the shared interface, and a way to refresh who is shown as signed in. */
export type SupabaseAuthService = AuthService & {
  // Reads the profile again and tells listeners, so a renamed student sees the new name at once.
  refreshUser(): Promise<void>
}

/** The Supabase auth service. */
export function createSupabaseAuthService({
  client,
  rememberStorage,
  storageKey,
  origin,
}: SupabaseAuthOptions): SupabaseAuthService {
  // Reading, signing in and out, the reset link and the listeners.
  const core = createSessionCore({ client, rememberStorage, storageKey })

  return {
    getSession: core.getSession,

    async signIn({ email, password, remember }) {
      assertEmail(email)
      if (password.length === 0) throw new AppError('validation', 'Enter your password.')
      return core.signInWithPassword(email, password, remember)
    },

    async signUp({ fullName, email, password }) {
      assertEmail(email)
      // SECURITY: the name and password rules are enforced here too, so a request that skips the
      // form cannot create a weak password.
      assertRule(fullNameSchema, fullName)
      assertRule(newPasswordSchema, password)
      // New accounts are remembered, as most sign-up flows do.
      rememberStorage.setRemember(true)
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          // The database trigger copies the name into the profile. The role is NOT sent: a new
          // account is always a student, whatever the browser says.
          data: { full_name: fullName.trim() },
          // The confirmation email returns to the sign-in page.
          emailRedirectTo: `${origin}${ROUTES.login}`,
        },
      })
      if (error) throw fromSupabaseError(error)
      // Email confirmation is on (D76): the account exists but cannot sign in yet.
      if (!data.session) return { status: 'confirm_email' }
      const session = await core.adoptSession(data.session.user.id)
      return { status: 'signed_in', session }
    },

    async signInWithProvider(provider) {
      rememberStorage.setRemember(true)
      const { error } = await client.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${origin}${ROUTES.dashboard}` },
      })
      if (error) throw fromSupabaseError(error)
      // The browser is leaving for the provider; the session arrives when it comes back.
      return new Promise<Session>(() => undefined)
    },

    signOut: core.signOut,

    async requestPasswordReset(email) {
      assertEmail(email)
      await core.requestPasswordReset(email, `${origin}${ROUTES.resetPassword}`)
      // Real services send an email; there is no demo link.
      return {}
    },

    checkResetLink: core.checkResetLink,

    refreshUser: core.refreshUser,

    async resetPassword(code, newPassword) {
      // SECURITY: the same strength rules as sign-up, checked first so a weak password does not
      // spend the link and the student can retry.
      assertRule(newPasswordSchema, newPassword)
      await core.resetPassword(code, newPassword)
    },

    async updatePassword(currentPassword, newPassword) {
      if (currentPassword.length === 0) {
        throw new AppError('validation', 'Enter your current password.')
      }
      assertRule(newPasswordSchema, newPassword)
      const { data, error } = await client.auth.getUser()
      if (error) throw fromSupabaseError(error)
      const email = data.user.email
      if (email === undefined)
        throw new AppError('unauthorized', 'Your session has ended. Sign in again.')
      // SECURITY: the current password is checked first, so someone at an unlocked computer
      // cannot take over the account.
      const check = await client.auth.signInWithPassword({ email, password: currentPassword })
      if (check.error) {
        const mapped = fromSupabaseError(check.error)
        throw mapped.message === 'Email or password is incorrect.'
          ? new AppError('validation', 'Your current password is incorrect.')
          : mapped
      }
      const update = await client.auth.updateUser({ password: newPassword })
      if (update.error) throw fromSupabaseError(update.error)
    },

    onAuthChange: core.onAuthChange,
  }
}
