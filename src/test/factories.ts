/**
 * Test data factories (ENGINEERING_STANDARDS.md 2.4). Tests build data here instead of copying
 * object literals, so a change to a type is fixed in one place.
 */

// The shapes being built.
import type { Session, SessionUser } from '@/types/auth'

/** Test data factories (ENGINEERING_STANDARDS.md 2.4). Override only what a test cares about. */
export function makeSessionUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    // Default: a student called Victory.
    id: 'student-1',
    role: 'student',
    fullName: 'Victory Okafor',
    email: 'victory@example.com',
    // Anything the test passes replaces the defaults above.
    ...overrides,
  }
}

/** A signed-in session for the user built above. */
export function makeSession(overrides: Partial<SessionUser> = {}): Session {
  // Wrap the user in a session.
  return { user: makeSessionUser(overrides) }
}
