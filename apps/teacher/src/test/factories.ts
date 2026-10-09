/**
 * Test data builders for the teacher app.
 */

// The demo password, re-exported for sign-in tests (test helpers may reach the demo service).
export { DEMO_PASSWORD } from '@/services/mock/mockAuthService'
// Where the demo session is stored, for tests that sign in without the router helper.
export { SESSION_KEY } from '@/services/mock/mockAuthService'
// Session shape.
import type { Session } from '@/types/auth'
// The shared role names.
import type { Role } from '@conote/domain'

/** A signed-in session for `role`, with overridable details. */
export function makeSession(
  role: Role = 'teacher',
  overrides: Partial<Session['user']> = {},
): Session {
  return {
    user: {
      id: `${role}-test`,
      role,
      fullName: role === 'teacher' ? 'Sarah Mbarga' : 'Amara Okafor',
      email: `${role}@conote.example`,
      ...overrides,
    },
  }
}
