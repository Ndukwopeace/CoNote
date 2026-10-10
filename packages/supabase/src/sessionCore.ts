/**
 * The session machinery every app's Supabase auth service shares (D83): reading the stored
 * session, signing in and out with a password, the password-reset link, and telling listeners
 * about changes. It was written for the student app and moved here so the staff portals get the
 * same careful handling of late and duplicate reports from Supabase, and a bug is fixed once.
 * Each app wraps it with its own wording, rules and extras (sign-up, Google, addresses).
 */

// The client type.
import type {
  AuthChangeEvent,
  Session as SupabaseSession,
  SupabaseClient,
} from '@supabase/supabase-js'

// The error type every service throws.
import { AppError } from '@conote/core/errors'

// Turns Supabase failures into AppErrors.
import { fromSupabaseError } from './errors'
// Reads the signed-in person's profile.
import { fetchProfile, toSessionUser, type SignedInUser } from './profile'
// Where the session is kept, with the "Remember me" switch.
import type { RememberStorage } from './rememberStorage'

/** A signed-in session, as every app sees it. */
export interface CoreSession {
  user: SignedInUser
}

/** What the core needs. */
export interface SessionCoreOptions {
  // The one client the app uses.
  client: SupabaseClient
  // The "Remember me" switch for the client's storage.
  rememberStorage: RememberStorage
  // The key the client stores its session under, so sign-out can clear it even if the server
  // cannot be reached.
  storageKey: string
}

// Shown when an account exists but may not sign in.
const INACTIVE = 'This account is not active. Contact your administrator.'
// Shown when a reset link cannot be used any more.
export const LINK_EXPIRED = 'This reset link has expired. Request a new one.'

/** What the core offers the app's own service. */
export interface SessionCore {
  /** The stored session, or null when signed out or the account may not sign in. */
  getSession: () => Promise<CoreSession | null>
  /** Signs in with a password. The caller has already validated the input. */
  signInWithPassword: (email: string, password: string, remember: boolean) => Promise<CoreSession>
  /** Announces a session Supabase created some other way (sign-up that returns a session). */
  adoptSession: (userId: string) => Promise<CoreSession>
  /** Signs out everywhere on this computer, whatever the server says. */
  signOut: () => Promise<void>
  /** Sends the reset email; Supabase answers the same whether or not the account exists. */
  requestPasswordReset: (email: string, redirectTo: string) => Promise<void>
  /** True when `code` (from the reset link) can still be used. Asking again is safe. */
  checkResetLink: (code: string | null) => Promise<boolean>
  /** Sets a new password with `code`, then ends the temporary session. */
  resetPassword: (code: string, newPassword: string) => Promise<void>
  /** Reads the profile again and tells listeners (a renamed person sees the new name at once). */
  refreshUser: () => Promise<void>
  /** Calls `listener` whenever the session changes. Returns a function that stops listening. */
  onAuthChange: (listener: (session: CoreSession | null) => void) => () => void
}

/** Builds the session machinery over `client`. */
export function createSessionCore({
  client,
  rememberStorage,
  storageKey,
}: SessionCoreOptions): SessionCore {
  // Everyone who asked to hear about session changes (the AuthProvider, mainly).
  const listeners = new Set<(session: CoreSession | null) => void>()
  // Reset-link checks already made, by code. A reset code is single-use, so the answer to the
  // first check is kept and the page can ask again without spending the code twice.
  const linkChecks = new Map<string, Promise<boolean>>()
  // True between opening a reset link and finishing the reset. Opening the link signs in a
  // temporary "recovery" session; the app must not treat it as a normal sign-in.
  let recovering = false
  // Changes are handled one at a time, in the order they arrive.
  let queue: Promise<void> = Promise.resolve()
  // The stop function for the Supabase subscription, while anyone is listening.
  let unsubscribeFromSupabase: (() => void) | null = null

  // Who listeners were last told is signed in (null: nobody). Supabase reports the changes this
  // service makes itself, and sometimes late; comparing with this keeps each change announced once
  // and stops a late "signed in" report from reviving someone who has just signed out.
  let announcedUserId: string | null = null
  // Counts announcements. A report that was being checked while an announcement happened (a
  // sign-out, say) is out of date and must not announce anything when its check ends.
  let announcements = 0

  /** Tells every listener about the new session, or null after sign-out. */
  function emit(session: CoreSession | null) {
    // Remember who was announced, so the same change is not announced twice.
    announcedUserId = session?.user.id ?? null
    // Anything still being checked is now out of date.
    announcements += 1
    // Tell each listener in turn.
    for (const listener of listeners) listener(session)
  }

  /**
   * Reads the profile of account `id` and builds the session. An account that may not sign in
   * is signed out again and refused. SECURITY: the check reads the profile row, which only an
   * administrator can change, never anything the browser sends.
   */
  async function loadSession(id: string): Promise<CoreSession> {
    // Read the account's profile row (Row Level Security lets a person read their own).
    const profile = await fetchProfile(client, id)
    // Only active accounts may sign in.
    if (profile.status !== 'active') {
      // End the session that was just created, then refuse.
      await client.auth.signOut({ scope: 'local' })
      throw new AppError('forbidden', INACTIVE)
    }
    // The person as the app sees them.
    return { user: toSessionUser(profile) }
  }

  /** Announces the session of account `id` unless the same person was announced already. */
  async function announce(id: string): Promise<CoreSession> {
    const session = await loadSession(id)
    // Not announced twice if Supabase's own report was handled first.
    if (announcedUserId !== session.user.id) emit(session)
    return session
  }

  /** Handles one change reported by Supabase. */
  async function handle(event: AuthChangeEvent, session: SupabaseSession | null) {
    // A recovery session is not a sign-in, and the first report on subscribing is not a change.
    if (recovering || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return
    // The reset flow handles its own temporary session.
    if (event === 'PASSWORD_RECOVERY') return
    if (!session) {
      // Already announced (for example by signOut): nothing changed.
      if (announcedUserId !== null) emit(null)
      return
    }
    // Already announced by signIn: nothing changed.
    if (session.user.id === announcedUserId) return
    // Note the count now, to notice an announcement made while the checks below run.
    const seen = announcements
    try {
      // SECURITY: the report may be late. Only announce a sign-in if the session still exists.
      const current = await client.auth.getSession()
      if (!current.data.session) return
      const loaded = await loadSession(session.user.id)
      // SECURITY: a sign-out (or another change) happened during the checks; this report is
      // stale and must not bring the person back.
      if (announcements !== seen) return
      emit(loaded)
    } catch {
      // A stale report says nothing about who is signed in now.
      if (announcements !== seen) return
      // A profile that cannot be read or may not sign in counts as signed out.
      emit(null)
    }
  }

  /** Starts following Supabase's session changes. */
  function subscribe() {
    const { data } = client.auth.onAuthStateChange((event, session) => {
      // Supabase warns against calling its own methods from inside this callback; deferring the
      // work lets the call that caused the event finish first.
      setTimeout(() => {
        // Handle changes one at a time, in order; one failure does not stop the next.
        queue = queue.then(() => handle(event, session)).catch(() => undefined)
      }, 0)
    })
    // Remember how to stop following, for when the last listener leaves.
    unsubscribeFromSupabase = () => {
      data.subscription.unsubscribe()
    }
  }

  /**
   * Opens a reset link: swaps its code for a temporary session that may set a new password.
   * The link carries a hash of a single-use token, so it works in any browser, not only the one
   * that asked for it (a person often asks on a laptop and opens the email on a phone).
   */
  async function openResetLink(code: string): Promise<boolean> {
    // The recovery session this creates must not look like a sign-in.
    recovering = true
    // Swap the code for a temporary session; Supabase refuses used, expired and made-up codes.
    const { error } = await client.auth.verifyOtp({ type: 'recovery', token_hash: code })
    // Accepted: the temporary session lets the person set a new password.
    if (!error) return true
    // Refused: nothing is pending any more.
    recovering = false
    // A dropped connection says nothing about the link, so it is not "expired".
    if (fromSupabaseError(error).kind === 'network') throw fromSupabaseError(error)
    // Missing, made-up, used and replaced codes are all refused the same way.
    return false
  }

  /** True when `code` (from the reset link) can still be used. Asking again is safe. */
  function checkResetLink(code: string | null): Promise<boolean> {
    // A missing code is always refused.
    if (code === null || code === '') return Promise.resolve(false)
    // Use the earlier answer if this code was already checked.
    let check = linkChecks.get(code)
    if (!check) {
      // First time: open the link (this spends the code).
      check = openResetLink(code)
      // Keep the answer for the next check.
      linkChecks.set(code, check)
      // A failed attempt (offline) can be retried.
      check.catch(() => linkChecks.delete(code))
    }
    return check
  }

  return {
    async getSession() {
      // Read the session kept in this browser's storage.
      const { data, error } = await client.auth.getSession()
      if (error) throw fromSupabaseError(error)
      // Nobody is signed in on this browser.
      if (!data.session) return null
      try {
        return await loadSession(data.session.user.id)
      } catch (error_) {
        // An account that may not sign in has already been signed out; the visitor is signed out.
        if (error_ instanceof AppError && error_.kind === 'forbidden') return null
        throw error_
      }
    },

    async signInWithPassword(email, password, remember) {
      // The choice must be recorded before the session is written.
      rememberStorage.setRemember(remember)
      const { data, error } = await client.auth.signInWithPassword({ email, password })
      if (error) throw fromSupabaseError(error)
      // Tell the app now instead of waiting for Supabase's own report. If that report was
      // handled first it has already told them, and they are not told twice.
      return announce(data.user.id)
    },

    adoptSession: announce,

    async signOut() {
      try {
        const { error } = await client.auth.signOut({ scope: 'local' })
        if (error) throw fromSupabaseError(error)
      } finally {
        // SECURITY: whatever the server said, nothing stays on this computer.
        rememberStorage.storage.removeItem(storageKey)
        rememberStorage.setRemember(false)
        recovering = false
        linkChecks.clear()
        emit(null)
      }
    },

    async requestPasswordReset(email, redirectTo) {
      // SECURITY: Supabase answers the same whether or not the account exists, so this cannot be
      // used to find out who has an account (account enumeration).
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo })
      if (error) throw fromSupabaseError(error)
    },

    checkResetLink,

    async resetPassword(code, newPassword) {
      // SECURITY: the link is checked again here, not only when the page opened.
      const ok = await checkResetLink(code)
      if (!ok) throw new AppError('validation', LINK_EXPIRED)
      const { error } = await client.auth.updateUser({ password: newPassword })
      if (error) {
        const mapped = fromSupabaseError(error)
        // The temporary session timed out while the form was open.
        throw mapped.kind === 'unauthorized' ? new AppError('validation', LINK_EXPIRED) : mapped
      }
      // The link is spent. End the temporary session, so the person signs in with the new
      // password.
      linkChecks.delete(code)
      recovering = false
      await client.auth.signOut({ scope: 'local' })
    },

    async refreshUser() {
      // Nobody signed in: nothing to refresh.
      const { data } = await client.auth.getSession()
      if (!data.session) return
      // The profile as it is now (a rename, for example). The same person, so this is announced
      // even though the ID has not changed.
      emit(await loadSession(data.session.user.id))
    },

    onAuthChange(listener) {
      listeners.add(listener)
      // Follow Supabase only while someone is listening.
      if (unsubscribeFromSupabase === null) subscribe()
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0 && unsubscribeFromSupabase !== null) {
          unsubscribeFromSupabase()
          unsubscribeFromSupabase = null
        }
      }
    },
  }
}
