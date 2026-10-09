/**
 * The admin console's demo AuthService (D66, D68): the shared demo service (packages/portal), set
 * up with the console's accounts, storage keys and reset page. Three demo accounts, one per role,
 * start with one demo password, so the admin-only guard can be tried out.
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
import { ADMIN_ROUTES } from '@/lib/routes'
// The console's storage prefix.
import { ADMIN_STORAGE_PREFIX } from '@/lib/storage'

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

/**
 * The prefix for the demo's stand-in server data. Not ADMIN_STORAGE_PREFIX, so sign-out (which
 * clears that prefix) doesn't undo a password change.
 */
export const DEMO_DATA_PREFIX = 'conote-admin-demo:'

/** The session stored in `store`, if it is present and well-formed. */
export function readStoredSession(store: Storage): Session | null {
  return readSession(store, SESSION_KEY)
}

/** Builds the console's demo AuthService over `options`' storage. */
export function createMockAuthService(options: MockAuthOptions): AuthService {
  return createDemoAuthService({
    accounts: DEMO_ACCOUNTS,
    password: DEMO_PASSWORD,
    sessionKey: SESSION_KEY,
    demoDataPrefix: DEMO_DATA_PREFIX,
    resetPath: ADMIN_ROUTES.resetPassword,
    ...options,
  })
}
