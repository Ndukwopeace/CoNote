/**
 * The demo AuthService shared by the staff portals (D66, D68, D77). Demo accounts, one per role,
 * start with one demo password, so a portal's role guard can be tried out. The session lives in
 * the browser's session storage, so closing the tab signs the user out. Changed passwords and the
 * current reset link live in local storage under a separate prefix: they stand in for the server,
 * so sign-out keeps them.
 */

// The shared error type.
import { AppError } from '@conote/core/errors'
// The shared vocabulary.
import type { AccountStatus } from '@conote/domain'
// Shape checks for what is read back from storage.
import { z } from 'zod'

// The new-password rules, shared with the reset form.
import { forgotPasswordSchema, newStaffPasswordSchema } from './authSchemas'
// Fake network delay.
import { simulateLatency } from './latency'
// Session shapes, and the interface implemented here.
import type { AuthService, Session, SessionUser } from './types'

/** The one message for any wrong sign-in detail. */
const WRONG_DETAILS = 'Incorrect email or password.'

/** The message for a reset link that is missing, made up, replaced or already used. */
const EXPIRED_LINK = 'This reset link has expired. Request a new one.'

/** What the stored reset record must look like. */
const resetSchema = z.object({ code: z.string().min(1), email: z.email().nullable() })

/** What the stored passwords must look like. */
const passwordsSchema = z.record(z.string(), z.string())

/** What a stored session must look like to be trusted. */
const sessionSchema = z.object({
  user: z.object({
    id: z.string().min(1),
    role: z.enum(['student', 'teacher', 'admin']),
    fullName: z.string().min(1),
    email: z.email(),
  }),
})

/** What makes one portal's demo different from another's. */
export interface DemoAuthConfig {
  // The demo accounts: one per role, so the guard can be tried out.
  accounts: readonly SessionUser[]
  // The demo password every account starts with.
  password: string
  // Where the session is stored in session storage.
  sessionKey: string
  // The prefix for the stand-in server data, kept apart from the portal's own prefix so sign-out
  // doesn't undo a password change.
  demoDataPrefix: string
  // The address of the portal's reset page, for the demo reset link.
  resetPath: string
}

/**
 * What the demo service needs: where to keep the session (`store`), where to keep the stand-in
 * server data (`demoStore`), and how slow to pretend to be.
 */
export interface MockAuthOptions {
  store: Storage
  demoStore: Storage
  latencyMs: number
  // The account's status on the platform; accounts that aren't active can't sign in.
  accountStatus?: ((email: string) => AccountStatus | undefined) | undefined
}

/** Reads JSON from `store` and checks it against `schema`; anything else counts as absent. */
function readChecked<T>(store: Storage, key: string, schema: z.ZodType<T>): T | null {
  // Nothing stored.
  const raw = store.getItem(key)
  if (raw === null) return null
  // SECURITY: storage can be edited by hand, so its contents are checked before use.
  try {
    const parsed = schema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    // Not JSON.
    return null
  }
}

/** Throws a validation AppError with the first message if `value` breaks `schema`. */
function assertRule(schema: z.ZodType, value: unknown) {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new AppError('validation', result.error.issues[0]?.message ?? 'Check this value.')
  }
}

/**
 * The session stored under `sessionKey` in `store`, if it is present and well-formed. The other
 * demo services use it to know who is acting.
 */
export function readStoredSession(store: Storage, sessionKey: string): Session | null {
  // Nothing stored: signed out.
  const raw = store.getItem(sessionKey)
  if (raw === null) return null
  // SECURITY: storage can be edited by hand or by a script, so its contents are checked before
  // use. Anything that isn't a well-formed session is removed and treated as signed out.
  try {
    const parsed = sessionSchema.safeParse(JSON.parse(raw))
    if (parsed.success) return parsed.data
  } catch {
    // Not JSON: handled below like any other malformed value.
  }
  store.removeItem(sessionKey)
  return null
}

/** Builds a portal's demo AuthService. */
export function createDemoAuthService({
  accounts,
  password: demoPassword,
  sessionKey,
  demoDataPrefix,
  resetPath,
  store,
  demoStore,
  latencyMs,
  accountStatus,
}: DemoAuthConfig & MockAuthOptions): AuthService {
  // Where changed passwords (by email) and the newest reset link live.
  const passwordsKey = `${demoDataPrefix}passwords`
  const resetKey = `${demoDataPrefix}reset`
  // Everyone listening for session changes.
  const listeners = new Set<(session: Session | null) => void>()

  /** Tells every listener about the new session. */
  function notify(session: Session | null) {
    for (const listener of listeners) listener(session)
  }

  /** The password `email` currently has: a changed one if any, otherwise the demo password. */
  function passwordFor(email: string) {
    return readChecked(demoStore, passwordsKey, passwordsSchema)?.[email] ?? demoPassword
  }

  /** The newest reset record, if any: its code, and the account it is for (null if unknown). */
  function readReset() {
    return readChecked(demoStore, resetKey, resetSchema)
  }

  return {
    async getSession() {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      return readStoredSession(store, sessionKey)
    },

    async signIn({ email, password }) {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // Emails are matched as people type them: any letter case, spaces trimmed.
      const normalised = email.trim().toLowerCase()
      const account = accounts.find((candidate) => candidate.email === normalised)
      // SECURITY: one message for an unknown email and a wrong password, so the form doesn't
      // reveal which emails have accounts (account enumeration).
      if (!account || password !== passwordFor(account.email)) {
        throw new AppError('validation', WRONG_DETAILS)
      }
      // SECURITY: a deactivated or suspended account is refused even with the right password
      // (admin REQUIREMENTS section 6.2). Said only after the password matched, so it reveals
      // nothing to someone guessing.
      const status = accountStatus?.(account.email) ?? 'active'
      if (status !== 'active') {
        throw new AppError('forbidden', 'This account is not active. Contact your administrator.')
      }
      // Keep a copy of the account as the session, then tell listeners.
      const session: Session = { user: { ...account } }
      store.setItem(sessionKey, JSON.stringify(session))
      notify(session)
      return session
    },

    async signOut() {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // Forget the session, then tell listeners.
      store.removeItem(sessionKey)
      notify(null)
    },

    async requestPasswordReset(email) {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // Only the format is checked: the same rule as the form.
      const parsed = forgotPasswordSchema.safeParse({ email })
      if (!parsed.success) throw new AppError('validation', 'Enter a valid email address.')
      // The account, if any. SECURITY: the answer below never depends on it, so the form can't be
      // used to find out who has an account (account enumeration).
      const account = accounts.find((candidate) => candidate.email === parsed.data.email)
      // SECURITY: an unguessable code, so nobody can open the reset page by making one up. A new
      // request replaces the old record, so only the newest link works.
      const code = crypto.randomUUID()
      demoStore.setItem(resetKey, JSON.stringify({ code, email: account?.email ?? null }))
      // No email is sent in the demo, so hand the link back for the confirmation screen.
      return { demoResetPath: `${resetPath}?code=${code}` }
    },

    async checkResetLink(code) {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // SECURITY: a missing, made-up, replaced or used code is refused.
      return code !== null && code !== '' && readReset()?.code === code
    },

    async resetPassword(code, newPassword) {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // SECURITY: the same strength rules as the form, enforced here too. Checked first, so a
      // weak password doesn't spend the link and the user can try again.
      assertRule(newStaffPasswordSchema, newPassword)
      // SECURITY: check the code again now, not only when the page opened. A page left open on an
      // old link, or a link already used in another tab, can't change the password.
      const reset = readReset()
      if (code === '' || reset?.code !== code) throw new AppError('validation', EXPIRED_LINK)
      // SECURITY: spend the code, so the same link can't be used a second time.
      demoStore.removeItem(resetKey)
      // A link for an unknown email changes nothing (a real service sends no email for it).
      if (reset.email === null) return
      // Save the new password for that account.
      const passwords = readChecked(demoStore, passwordsKey, passwordsSchema) ?? {}
      demoStore.setItem(passwordsKey, JSON.stringify({ ...passwords, [reset.email]: newPassword }))
    },

    onAuthChange(listener) {
      // Start listening, and hand back the way to stop.
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
