import type { Session, SessionUser } from '@/types/auth'

/** Test data factories (ENGINEERING_STANDARDS.md 2.4). Override only what a test cares about. */
export function makeSessionUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 'student-1',
    role: 'student',
    fullName: 'Victory Okafor',
    email: 'victory@example.com',
    ...overrides,
  }
}

export function makeSession(overrides: Partial<SessionUser> = {}): Session {
  return { user: makeSessionUser(overrides) }
}
