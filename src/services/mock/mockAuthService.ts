/**
 * Demo authentication. It behaves like a real auth service (sessions, listeners, validation)
 * but keeps everything in the browser. The Supabase version will pass the same contract tests.
 */

// zod checks stored data and email formats.
import { z } from 'zod'

// The same name and password rules the forms use (FR-AUTH-3).
import { fullNameSchema, newPasswordSchema } from '@/lib/authSchemas'
// The error type every service throws.
import { AppError } from '@/lib/errors'
// The reset page's address, for the demo reset link.
import { ROUTES } from '@/lib/routes'
// Builds "conote:"-prefixed storage keys.
import { storageKey } from '@/lib/storage'
// The session shape returned to the app.
import type { Session } from '@/types/auth'

// The interface this implementation must satisfy.
import type { AuthService } from '../types'

// Fake network delay.
import { simulateLatency } from './latency'

/**
 * The signed-in identity. Kept in sessionStorage only, so it never outlives the browser session.
 * SECURITY: the browser deletes sessionStorage when the tab or browser closes, so a name and
 * email are not left sitting on a shared computer.
 */
const SESSION_KEY = storageKey('session')
/**
 * "Remember me" marker in localStorage. Deliberately holds no email or name
 * (ENGINEERING_STANDARDS.md 6.4); a remembered visit restores the demo student.
 * SECURITY: nothing personal is written to long-lived storage.
 */
const REMEMBER_KEY = storageKey('remember')
/**
 * The outstanding demo reset code. Kept in sessionStorage so it survives the jump from the
 * forgot page to the reset page, and disappears when the browser closes.
 */
const RESET_CODE_KEY = storageKey('reset-code')

// The demo account every sign-in becomes.
const DEMO_STUDENT = {
  // Stable ID so demo data can belong to this student.
  id: 'student-victory',
  // Name from the wireframes.
  fullName: 'Victory Okafor',
  // Used for OAuth sign-ins and remembered visits, where no email was typed.
  email: 'victory@conote.demo',
} as const

/**
 * Expected shape of a stored session.
 * SECURITY: storage can be edited by anyone with the browser's developer tools, so stored data
 * is never trusted. Anything that doesn't match this shape is treated as "not signed in".
 */
const sessionSchema = z.object({
  user: z.object({
    // Non-empty ID.
    id: z.string().min(1),
    // Only known roles. The route guards act on this, so an unknown role must not slip through.
    role: z.enum(['student', 'teacher', 'admin']),
    // Non-empty name.
    fullName: z.string().min(1),
    // Well-formed email.
    email: z.email(),
    // Optional picture address.
    avatarUrl: z.string().optional(),
  }),
})

// Rule for a well-formed email address.
const emailSchema = z.email()

/**
 * Throws a validation error carrying the first rule `value` breaks, so the student sees the
 * same message the form would have shown.
 */
function assertRule(schema: z.ZodType, value: unknown) {
  // Check without throwing zod's own error type.
  const result = schema.safeParse(value)
  // Passed: nothing to do.
  if (result.success) return
  // The first broken rule's message, or a generic one if zod gave none.
  const message = result.error.issues[0]?.message ?? 'Check this field and try again.'
  // The app's own error type, with a message that is safe to show.
  throw new AppError('validation', message)
}

/** What the factory needs: two storage areas (injected so tests can use their own) and a delay. */
interface MockAuthOptions {
  // Long-lived storage; holds only the remember marker.
  localStore: Storage
  // Per-session storage; holds the identity.
  sessionStore: Storage
  // Milliseconds to wait on each call.
  latencyMs: number
}

/** Reads and checks the stored session. Returns null for missing, broken or tampered data. */
function readSession(store: Storage): Session | null {
  // Raw JSON text, or null when nothing is stored.
  const raw = store.getItem(SESSION_KEY)
  // Nothing stored means nobody is signed in.
  if (raw === null) return null
  try {
    // Parse the text and check its shape.
    const parsed = sessionSchema.safeParse(JSON.parse(raw))
    // Wrong shape: treat as signed out.
    if (!parsed.success) return null
    // Separate the optional picture from the rest of the user fields.
    const { avatarUrl, ...user } = parsed.data.user
    // Only include avatarUrl when it has a value (the strict "optional" type rule requires this).
    return { user: avatarUrl === undefined ? user : { ...user, avatarUrl } }
  } catch {
    // Text that isn't JSON: treat as signed out.
    return null
  }
}

/** Throws a student-friendly validation error unless `email` is well-formed. */
function assertEmail(email: string) {
  // Check the format.
  if (!emailSchema.safeParse(email).success) {
    // The message is shown on the form as-is.
    throw new AppError('validation', 'Enter a valid email address.')
  }
}

/**
 * Demo authentication (REQUIREMENTS.md FR-AUTH-7). Any valid email and non-empty password
 * signs in as the demo student. The identity lives in sessionStorage; "Remember me" adds an
 * opaque marker to localStorage so the demo student is restored in a later browser session.
 */
export function createMockAuthService({
  localStore,
  sessionStore,
  latencyMs,
}: MockAuthOptions): AuthService {
  // Everyone who asked to hear about session changes (the AuthProvider, mainly).
  const listeners = new Set<(session: Session | null) => void>()

  /** Tells every listener about the new session, or null after sign-out. */
  function emit(session: Session | null) {
    // Call each listener in turn.
    for (const listener of listeners) listener(session)
  }

  /** Saves a new session, records "remember me", notifies listeners and returns the session. */
  function store(session: Session, remember: boolean) {
    // SECURITY: the identity goes in sessionStorage, which the browser clears when it closes.
    sessionStore.setItem(SESSION_KEY, JSON.stringify(session))
    // SECURITY: "remember me" stores only a marker, never a name or email.
    if (remember) localStore.setItem(REMEMBER_KEY, '1')
    // Without "remember me", remove any old marker so the next browser session starts signed out.
    else localStore.removeItem(REMEMBER_KEY)
    // Tell the app the student is signed in.
    emit(session)
    // Return the session to the caller.
    return session
  }

  /** Builds the demo student's session with the given email and, optionally, name. */
  function demoSession(email: string, fullName: string = DEMO_STUDENT.fullName): Session {
    // Always a student; the demo never creates teacher or admin sessions.
    return { user: { id: DEMO_STUDENT.id, role: 'student', fullName, email } }
  }

  // The service object handed to the app.
  return {
    async getSession() {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // Prefer the identity from this browser session.
      const current = readSession(sessionStore)
      // Found one: done.
      if (current) return current
      // No current identity: a remember marker restores the demo student, otherwise signed out.
      return localStore.getItem(REMEMBER_KEY) === null ? null : demoSession(DEMO_STUDENT.email)
    },

    async signIn({ email, password, remember }) {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // Reject badly formed emails with a clear message.
      assertEmail(email)
      // An empty password is rejected; any other password works in the demo.
      if (password.length === 0) throw new AppError('validation', 'Enter your password.')
      // Save and announce the session.
      return store(demoSession(email), remember)
    },

    async signUp({ fullName, email, password }) {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // Reject badly formed emails.
      assertEmail(email)
      // SECURITY: the name and password rules are enforced here too, so a request that skips
      // the form (for example, sent from the browser console) can't create a weak password.
      assertRule(fullNameSchema, fullName)
      assertRule(newPasswordSchema, password)
      // New accounts are remembered, as most sign-up flows do.
      return store(demoSession(email, fullName.trim()), true)
    },

    async signInWithProvider() {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // No real provider in the demo: sign straight in as the demo student.
      return store(demoSession(DEMO_STUDENT.email), true)
    },

    async signOut() {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // SECURITY: remove the marker so the next visit on this computer is not signed in.
      localStore.removeItem(REMEMBER_KEY)
      // SECURITY: remove the identity.
      sessionStore.removeItem(SESSION_KEY)
      // Tell the app the student is signed out.
      emit(null)
    },

    async requestPasswordReset(email) {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // Only the format is checked. SECURITY: the result never depends on whether an account
      // exists, so the form can't be used to find out who has an account (account enumeration).
      assertEmail(email)
      // SECURITY: an unguessable code, so nobody can open the reset page by making one up.
      // A new request replaces the old code, so only the latest link works.
      const code = crypto.randomUUID()
      // Remember it for checkResetLink.
      sessionStore.setItem(RESET_CODE_KEY, code)
      // No email is sent in the demo, so hand the link back for the confirmation screen.
      return { demoResetPath: `${ROUTES.resetPassword}?code=${code}` }
    },

    async checkResetLink(code) {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // The code this browser was last given, or null once used.
      const expected = sessionStore.getItem(RESET_CODE_KEY)
      // SECURITY: a missing, made-up, old or used code is refused.
      return code !== null && code !== '' && code === expected
    },

    async updatePassword(newPassword) {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // SECURITY: the same strength rules as sign-up, enforced here and not only in the form.
      assertRule(newPasswordSchema, newPassword)
      // SECURITY: spend the reset code, so the same link can't be used a second time.
      sessionStore.removeItem(RESET_CODE_KEY)
    },

    onAuthChange(listener) {
      // Start notifying this listener.
      listeners.add(listener)
      // The caller runs this to stop, e.g. when a component unmounts, so nothing leaks.
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
