/**
 * Tests for the portal's demo AuthService: the shared contract (packages/portal), plus what is the
 * portal's own: its demo accounts, storage keys and reset page.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The shared rules.
import { describeAuthServiceContract } from '@conote/portal/testing'

// The unit under test.
import {
  createMockAuthService,
  DEMO_ACCOUNTS,
  DEMO_PASSWORD,
  readStoredSession,
  SESSION_KEY,
} from './mockAuthService'

/** A demo service over the test's storage, with no simulated delay. */
function createService() {
  return createMockAuthService({
    store: window.sessionStorage,
    demoStore: window.localStorage,
    latencyMs: 0,
  })
}

/** The code inside the demo reset link. */
function resetCodeFrom(request: { demoResetPath?: string }) {
  return (
    new URL(request.demoResetPath ?? '', 'https://conote.example').searchParams.get('code') ?? ''
  )
}

// The demo teacher account.
const teacher = DEMO_ACCOUNTS.find((account) => account.role === 'teacher')!

describeAuthServiceContract('teacher demo', {
  createService,
  account: {
    email: teacher.email,
    password: DEMO_PASSWORD,
    fullName: teacher.fullName,
    role: teacher.role,
  },
  resetCodeFrom,
})

describe('teacher demo AuthService', () => {
  // Proves the demo offers one account per role, so the teacher-only guard can be tried out.
  it('has a demo account for each role', () => {
    expect(DEMO_ACCOUNTS.map((account) => account.role).sort()).toEqual([
      'admin',
      'student',
      'teacher',
    ])
  })

  // Proves the session is kept under the portal's own key, apart from the other apps'.
  it('keeps the session under the portal’s key', async () => {
    await createService().signIn({ email: teacher.email, password: DEMO_PASSWORD })

    expect(SESSION_KEY).toBe('conote-teacher:session')
    expect(readStoredSession(window.sessionStorage)?.user.id).toBe(teacher.id)
  })

  // Proves the demo reset link goes to the portal's reset page.
  it('returns a demo link to the portal’s reset page', async () => {
    const request = await createService().requestPasswordReset(teacher.email)

    expect(request.demoResetPath).toMatch(/^\/teacher\/reset-password\?code=[\w-]+$/)
  })

  // Proves other roles can sign in here; the route guard, not the service, turns them away.
  it('signs in a student with the student role', async () => {
    const student = DEMO_ACCOUNTS.find((account) => account.role === 'student')!

    const session = await createService().signIn({
      email: student.email,
      password: DEMO_PASSWORD,
    })

    expect(session.user.role).toBe('student')
  })
})
