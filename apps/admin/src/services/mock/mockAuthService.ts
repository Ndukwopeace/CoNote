/**
 * The demo AuthService (D66). Three demo accounts, one per role, share one demo password, so the
 * admin-only guard can be tried out. The session lives in the browser's session storage, so
 * closing the tab signs the administrator out.
 */

// The shared error type.
import { AppError } from '@conote/core/errors'
// Shape checks for the stored session.
import { z } from 'zod'

// The console's storage prefix.
import { ADMIN_STORAGE_PREFIX } from '@/lib/storage'
// Session shapes.
import type { Session } from '@/types/auth'

// The interface implemented here.
import type { AuthService } from '../types'

/** The demo password for every demo account. Demo mode only; the login page shows it. */
export const DEMO_PASSWORD = 'password1'

/** The demo accounts: an admin who gets in, and a teacher and a student who are turned away. */
export const DEMO_ACCOUNTS = [
  { id: 'admin-1', role: 'admin', fullName: 'Amara Okafor', email: 'admin@conote.example' },
  { id: 'teacher-1', role: 'teacher', fullName: 'Sarah Mbarga', email: 'teacher@conote.example' },
  { id: 'student-1', role: 'student', fullName: 'Victory Eze', email: 'student@conote.example' },
] as const satisfies readonly Session['user'][]

/** Where the session is stored. The "conote-admin:" prefix keeps it apart from the student app's. */
export const SESSION_KEY = `${ADMIN_STORAGE_PREFIX}session`

/** The one message for any wrong sign-in detail. */
const WRONG_DETAILS = 'Incorrect email or password.'

/** What a stored session must look like to be trusted. */
const sessionSchema = z.object({
  user: z.object({
    id: z.string().min(1),
    role: z.enum(['student', 'teacher', 'admin']),
    fullName: z.string().min(1),
    email: z.email(),
  }),
})

/** What the demo service needs: where to keep the session, and how slow to pretend to be. */
interface MockAuthOptions {
  store: Storage
  latencyMs: number
}

/** Resolves after `ms` milliseconds, so the demo shows real loading states. */
function wait(ms: number) {
  // No timer at all when there is no delay, which keeps tests fast.
  return ms > 0 ? new Promise<void>((resolve) => setTimeout(resolve, ms)) : Promise.resolve()
}

/** Builds the demo AuthService over `store`. */
export function createMockAuthService({ store, latencyMs }: MockAuthOptions): AuthService {
  // Everyone listening for session changes.
  const listeners = new Set<(session: Session | null) => void>()

  /** Tells every listener about the new session. */
  function notify(session: Session | null) {
    for (const listener of listeners) listener(session)
  }

  /** The stored session, if it is present and well-formed. */
  function readSession(): Session | null {
    // Nothing stored: signed out.
    const raw = store.getItem(SESSION_KEY)
    if (raw === null) return null
    // SECURITY: storage can be edited by hand or by a script, so its contents are checked before
    // use. Anything that isn't a well-formed session is removed and treated as signed out.
    try {
      const parsed = sessionSchema.safeParse(JSON.parse(raw))
      if (parsed.success) return parsed.data
    } catch {
      // Not JSON: handled below like any other malformed value.
    }
    store.removeItem(SESSION_KEY)
    return null
  }

  return {
    async getSession() {
      // Behave like a network call.
      await wait(latencyMs)
      return readSession()
    },

    async signIn({ email, password }) {
      // Behave like a network call.
      await wait(latencyMs)
      // Emails are matched as people type them: any letter case, spaces trimmed.
      const normalised = email.trim().toLowerCase()
      const account = DEMO_ACCOUNTS.find((candidate) => candidate.email === normalised)
      // SECURITY: one message for an unknown email and a wrong password, so the form doesn't
      // reveal which emails have accounts (account enumeration).
      if (!account || password !== DEMO_PASSWORD) throw new AppError('validation', WRONG_DETAILS)
      // Keep a copy of the account as the session, then tell listeners.
      const session: Session = { user: { ...account } }
      store.setItem(SESSION_KEY, JSON.stringify(session))
      notify(session)
      return session
    },

    async signOut() {
      // Behave like a network call.
      await wait(latencyMs)
      // Forget the session, then tell listeners.
      store.removeItem(SESSION_KEY)
      notify(null)
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
