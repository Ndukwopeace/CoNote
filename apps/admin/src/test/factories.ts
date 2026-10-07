/**
 * Test data builders for the admin app.
 */

// The demo password, re-exported for sign-in tests (test helpers may reach the demo service).
export { DEMO_PASSWORD } from '@/services/mock/mockAuthService'
// Session shape.
import type { Session } from '@/types/auth'
// The shared role names.
import type { Role } from '@conote/domain'

/** A signed-in session for `role`, with overridable details. */
export function makeSession(
  role: Role = 'admin',
  overrides: Partial<Session['user']> = {},
): Session {
  return {
    user: {
      id: `${role}-test`,
      role,
      fullName: role === 'admin' ? 'Amara Okafor' : 'Sarah Mbarga',
      email: `${role}@conote.example`,
      ...overrides,
    },
  }
}
