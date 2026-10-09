/**
 * The teacher portal's demo AuthService (D68, D74): the shared demo service (packages/portal), set
 * up with the portal's accounts, storage keys and reset page. Three demo accounts, one per role,
 * start with one demo password, so the teacher-only guard can be tried out.
 */

// The shared demo service, and the shapes it works with.
import {
  createDemoAuthService,
  readStoredSession as readSession,
  type AuthService,
  type MockAuthOptions,
  type Session,
} from '@conote/portal'

// Route constants, for the demo reset link.
import { TEACHER_ROUTES } from '@/lib/routes'
// The portal's storage prefix.
import { TEACHER_STORAGE_PREFIX } from '@/lib/storage'

/** The demo password for every demo account. Demo mode only; the login page shows it. */
export const DEMO_PASSWORD = 'password1'

/** The demo accounts: a teacher who gets in, and an admin and a student who are turned away. */
export const DEMO_ACCOUNTS = [
  { id: 'teacher-1', role: 'teacher', fullName: 'Sarah Mbarga', email: 'teacher@conote.example' },
  { id: 'admin-1', role: 'admin', fullName: 'Amara Okafor', email: 'admin@conote.example' },
  { id: 'student-1', role: 'student', fullName: 'Victory Eze', email: 'student@conote.example' },
] as const satisfies readonly Session['user'][]

/** Where the session is stored. The "conote-teacher:" prefix keeps it apart from the other apps'. */
export const SESSION_KEY = `${TEACHER_STORAGE_PREFIX}session`

/**
 * The prefix for the demo's stand-in server data. Not TEACHER_STORAGE_PREFIX, so sign-out (which
 * clears that prefix) doesn't undo a password change or a published summary.
 */
export const DEMO_DATA_PREFIX = 'conote-teacher-demo:'

/** The session stored in `store`, if it is present and well-formed. */
export function readStoredSession(store: Storage): Session | null {
  return readSession(store, SESSION_KEY)
}

/** Builds the portal's demo AuthService over `options`' storage. */
export function createMockAuthService(options: MockAuthOptions): AuthService {
  return createDemoAuthService({
    accounts: DEMO_ACCOUNTS,
    password: DEMO_PASSWORD,
    sessionKey: SESSION_KEY,
    demoDataPrefix: DEMO_DATA_PREFIX,
    resetPath: TEACHER_ROUTES.resetPassword,
    ...options,
  })
}
