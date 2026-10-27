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
// Shown when Google's code cannot be turned into a session (used, expired or made up).
export const OAUTH_NOT_FINISHED = 'Google sign-in did not finish. Please try again.'
// Shown when a reset link cannot be used any more.
export const LINK_EXPIRED = 'This reset link has expired. Request a new one.'
// Shown when an emailed sign-in code is wrong, used, expired or made up. One message for all four,
// so it reveals nothing about which one it was.
export const CODE_REFUSED = 'That code is not right or has expired. Ask for a new one.'

/**
 * True when Supabase says it will not send a code because no account has this address. With
 * `shouldCreateUser: false` it answers "Signups not allowed for otp". The code of that answer
 * (`otp_disabled`) is also used when email codes are switched off for the whole project, so the
 * wording decides: a project with codes switched off must still show an error, not wait silently
 * for an email that will never come.
 */
function isNoAccountForCode(error: unknown): boolean {
  // Only a plain object can carry a message.
  if (typeof error !== 'object' || error === null) return false
  const { message } = error as { message?: unknown }
  return typeof message === 'string' && /signups not allowed/i.test(message)
}

/** What the core offers the app's own service. */
export interface SessionCore {
  /** The stored session, or null when signed out or the account may not sign in. */
  getSession: () => Promise<CoreSession | null>
  /** Signs in with a password. The caller has already validated the input. */
  signInWithPassword: (email: string, password: string, remember: boolean) => Promise<CoreSession>
  /** Announces a session Supabase created some other way (sign-up that returns a session). */
  adoptSession: (userId: string) => Promise<CoreSession>
  /**
   * Finishes a sign-in with a provider (Google): swaps the one-time `code` Google's redirect
   * brought back for a session, then checks the profile like any other sign-in.
   */
  completeOAuth: (code: string) => Promise<CoreSession>
  /**
   * Emails a sign-in code to an account that already exists (D114). Never creates an account, and
   * answers the same whether or not the address has one.
   */
  requestSignInCode: (email: string) => Promise<void>
  /**
   * Signs in with the code from `requestSignInCode`. A right code proves the person owns the
   * address, so an invited account is activated, as when a password is chosen. The caller has
   * already validated the input.
   */
  signInWithCode: (email: string, code: string, remember: boolean) => Promise<CoreSession>
  /** Signs out everywhere on this computer, whatever the server says. */
  signOut: () => Promise<void>
  /** Sends the reset email; Supabase answers the same whether or not the account exists. */
  requestPasswordReset: (email: string, redirectTo: string) => Promise<void>
  /** True when `code` (from the reset link) can still be used. Asking again is safe. */
  checkResetLink: (code: string | null) => Promise<boolean>
  /** Sets a new password with `code`, then ends the temporary session. */
  resetPassword: (code: string, newPassword: string) => Promise<void>
  /**
   * Sets the signed-in person's password and records that they have chosen one (D118), then tells
   * listeners. Rejects with `unauthorized` when nobody is signed in. The caller has already
   * validated the password.
   */
  setPassword: (newPassword: string) => Promise<CoreSession>
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
  // How many code sign-ins are between "the code was accepted" and "the person was announced".
  // Supabase reports the new session during that time, while an invited account still reads
  // "pending"; handling that report would sign the person straight back out.
  let codeSignIns = 0
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
   * True when the signed-in account was invited and has not chosen a password yet (D118): the
   * invitation marks it `invited` in its user data, and choosing a password clears the mark. This
   * only decides whether the app asks for a password. Nothing is allowed or refused because of it,
   * so a person who edits their own user data gains nothing.
   */
  async function mustChoosePassword(): Promise<boolean> {
    // The stored session carries the user data, so this makes no request.
    const { data } = await client.auth.getSession()
    return data.session?.user.user_metadata.invited === true
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
    // The person as the app sees them, with the mark when they still have to choose a password.
    const user = toSessionUser(profile)
    return { user: (await mustChoosePassword()) ? { ...user, mustSetPassword: true } : user }
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
    if (
      recovering ||
      codeSignIns > 0 ||
      event === 'INITIAL_SESSION' ||
      event === 'TOKEN_REFRESHED'
    ) {
      return
    }
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

    async completeOAuth(code) {
      // Swap the code for a session. The browser kept the matching secret from when the redirect
      // began (PKCE), so a code that was copied somewhere else cannot be used.
      const { data, error } = await client.auth.exchangeCodeForSession(code)
      if (error) {
        const mapped = fromSupabaseError(error)
        // A dropped connection says nothing about the code, so the person can simply retry.
        if (mapped.kind === 'network') throw mapped
        // Used, expired and made-up codes are all refused the same way, in wording we choose.
        throw new AppError('validation', OAUTH_NOT_FINISHED)
      }
      // SECURITY: the same checks as a password sign-in: an account that may not sign in
      // (suspended, or invited and not yet accepted) is signed out again and refused.
      return announce(data.user.id)
    },

    async requestSignInCode(email) {
      try {
        // SECURITY: `shouldCreateUser: false` means asking for a code can never make an account, so
        // a stranger cannot create one by typing an address.
        const { error } = await client.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: false },
        })
        // SECURITY: an address with no account is answered like one with an account, so this
        // cannot be used to find out who has an account (account enumeration).
        if (error && !isNoAccountForCode(error)) throw error
      } catch (error) {
        throw fromSupabaseError(error)
      }
    },

    async signInWithCode(email, code, remember) {
      // The choice must be recorded before the session is written.
      rememberStorage.setRemember(remember)
      // Hold back Supabase's own "signed in" report until the account has been checked below.
      codeSignIns += 1
      try {
        let answer
        try {
          answer = await client.auth.verifyOtp({ email, token: code, type: 'email' })
        } catch (error) {
          throw fromSupabaseError(error)
        }
        const { data, error } = answer
        if (error) {
          const mapped = fromSupabaseError(error)
          // A dropped connection says nothing about the code, so the person can simply retry.
          if (mapped.kind === 'network') throw mapped
          // Wrong, used, expired and made-up codes are all refused the same way.
          throw new AppError('validation', CODE_REFUSED)
        }
        // A right code always brings a session; an answer without one is not a sign-in.
        if (!data.session || !data.user) throw new AppError('validation', CODE_REFUSED)
        // A right code proves the person owns the address, which is what accepting an invitation
        // means: move an invited account from "pending" to "active". For anyone else this does
        // nothing. A failure is not reported here: the checks below then refuse a pending account.
        await client.rpc('accept_invitation')
        // SECURITY: the same checks as a password sign-in: an account that may not sign in
        // (suspended, or deactivated) is signed out again and refused.
        return await announce(data.user.id)
      } finally {
        // From here on Supabase's reports are handled as usual.
        codeSignIns -= 1
      }
    },

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
      // The invited mark is cleared with the password, so a later sign-in does not ask again.
      const { error } = await client.auth.updateUser({
        password: newPassword,
        data: { invited: false },
      })
      if (error) {
        const mapped = fromSupabaseError(error)
        // The temporary session timed out while the form was open.
        throw mapped.kind === 'unauthorized' ? new AppError('validation', LINK_EXPIRED) : mapped
      }
      // An invited person has just accepted the invitation by choosing a password: move them from
      // "pending" to "active" while the temporary session is open. For anyone else this does
      // nothing. A failure is not reported here: the password is already set, and the account
      // simply stays pending until an administrator looks at it.
      await client.rpc('accept_invitation')
      // The link is spent. End the temporary session, so the person signs in with the new
      // password.
      linkChecks.delete(code)
      recovering = false
      await client.auth.signOut({ scope: 'local' })
    },

    async setPassword(newPassword) {
      // Only a signed-in person can choose a password for their own account.
      const { data: current } = await client.auth.getSession()
      if (!current.session) throw new AppError('unauthorized', 'Sign in again to continue.')
      // The password and the "no longer invited" mark are saved together.
      const { error } = await client.auth.updateUser({
        password: newPassword,
        data: { invited: false },
      })
      if (error) throw fromSupabaseError(error)
      // The same person, now without the mark. Announced even though the ID has not changed.
      const session = await loadSession(current.session.user.id)
      emit(session)
      return session
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
