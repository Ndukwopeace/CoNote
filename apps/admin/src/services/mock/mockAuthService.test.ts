/**
 * Tests for the console's demo AuthService: the shared contract (packages/portal), plus what is
 * the console's own: its demo accounts, storage keys and reset page.
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

// The demo admin account.
const admin = DEMO_ACCOUNTS.find((account) => account.role === 'admin')!

describeAuthServiceContract('admin demo', {
  createService,
  account: {
    email: admin.email,
    password: DEMO_PASSWORD,
    fullName: admin.fullName,
    role: admin.role,
  },
  resetCodeFrom,
})

describe('admin demo AuthService', () => {
  // Proves the demo offers one account per role, so the admin-only guard can be tried out.
  it('has a demo account for each role', () => {
    expect(DEMO_ACCOUNTS.map((account) => account.role).sort()).toEqual([
      'admin',
      'student',
      'teacher',
    ])
  })

  // Proves the session is kept under the console's own key, apart from the other apps'.
  it('keeps the session under the console’s key', async () => {
    await createService().signIn({ email: admin.email, password: DEMO_PASSWORD })

    expect(SESSION_KEY).toBe('conote-admin:session')
    expect(readStoredSession(window.sessionStorage)?.user.id).toBe(admin.id)
  })

  // Proves the demo reset link goes to the console's reset page.
  it('returns a demo link to the console’s reset page', async () => {
    const request = await createService().requestPasswordReset(admin.email)

    expect(request.demoResetPath).toMatch(/^\/admin\/reset-password\?code=[\w-]+$/)
  })

  // Proves other roles can sign in here; the route guard, not the service, turns them away.
  it('signs in a teacher with the teacher role', async () => {
    const teacher = DEMO_ACCOUNTS.find((account) => account.role === 'teacher')!

    const session = await createService().signIn({
      email: teacher.email,
      password: DEMO_PASSWORD,
    })

    expect(session.user.role).toBe('teacher')
  })
})
