/**
 * Tests for the demo AuthService: the shared contract, plus what only the demo does (stored
 * session, demo accounts for each role).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The shared rules.
import { describeAuthServiceContract } from '../contracts/authService.contract'

// The unit under test.
import {
  createMockAuthService,
  DEMO_ACCOUNTS,
  DEMO_PASSWORD,
  readStoredSession,
  SESSION_KEY,
} from './mockAuthService'

/** A demo service over the test's storage, with no simulated delay. */
function createService(store: Storage = window.sessionStorage) {
  return createMockAuthService({ store, demoStore: window.localStorage, latencyMs: 0 })
}

/** The code inside the demo reset link. */
function resetCodeFrom(request: { demoResetPath?: string }) {
  return (
    new URL(request.demoResetPath ?? '', 'https://conote.example').searchParams.get('code') ?? ''
  )
}

// The demo teacher account.
const teacher = DEMO_ACCOUNTS.find((account) => account.role === 'teacher')!

describeAuthServiceContract('mock', {
  createService: () => createService(),
  teacher: { email: teacher.email, password: DEMO_PASSWORD, fullName: teacher.fullName },
  resetCodeFrom,
})

describe('mock AuthService', () => {
  // Proves an account a teacher has deactivated or suspended can't sign in (section 6.2).
  it('refuses accounts that are not active', async () => {
    // Arrange: the teacher account is suspended.
    const service = createMockAuthService({
      store: window.sessionStorage,
      demoStore: window.localStorage,
      latencyMs: 0,
      accountStatus: (email) => (email === 'teacher@conote.example' ? 'suspended' : 'active'),
    })

    // Act and assert.
    await expect(
      service.signIn({ email: 'teacher@conote.example', password: DEMO_PASSWORD }),
    ).rejects.toMatchObject({
      kind: 'forbidden',
      message: 'This account is not active. Contact your administrator.',
    })
    await expect(service.getSession()).resolves.toBeNull()
  })

  // Proves the stored session can be read without the service, for the other demo services.
  it('reads the stored session for other services', async () => {
    // Arrange.
    await createService().signIn({ email: teacher.email, password: DEMO_PASSWORD })

    // Act and assert.
    expect(readStoredSession(window.sessionStorage)?.user.id).toBe(teacher.id)
  })

  // Proves the demo offers one account per role, so the teacher-only guard can be tried out.
  it('has a demo account for each role', () => {
    expect(DEMO_ACCOUNTS.map((account) => account.role).sort()).toEqual([
      'admin',
      'student',
      'teacher',
    ])
  })

  // Proves non-teachers can sign in here; the route guard, not the service, turns them away.
  it('signs in a student with the student role', async () => {
    const student = DEMO_ACCOUNTS.find((account) => account.role === 'student')!
    const session = await createService().signIn({
      email: student.email,
      password: DEMO_PASSWORD,
    })
    expect(session.user.role).toBe('student')
  })

  // Proves a reload keeps the teacher signed in: a new service over the same store finds the session.
  it('keeps the session in the given store', async () => {
    await createService().signIn({ email: teacher.email, password: DEMO_PASSWORD })
    await expect(createService().getSession()).resolves.toMatchObject({
      user: { role: 'teacher' },
    })
  })

  // SECURITY: a stored session that was edited by hand (for example to change the role) doesn't
  // match the expected shape, so it is thrown away instead of trusted.
  it('ignores and removes a malformed stored session', async () => {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ user: { role: 'teacher' } }))
    await expect(createService().getSession()).resolves.toBeNull()
    expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull()
  })

  // Proves the demo hands back a link to the reset page, since no email is sent.
  it('returns a demo link to the reset page', async () => {
    const request = await createService().requestPasswordReset(teacher.email)
    expect(request.demoResetPath).toMatch(/^\/teacher\/reset-password\?code=[\w-]+$/)
  })

  // Proves a reset survives a reload, like a server-side change: a new service sees it.
  it('keeps a reset password across services', async () => {
    const first = createService()
    const code = resetCodeFrom(await first.requestPasswordReset(teacher.email))
    await first.resetPassword(code, 'new-password-2026')
    await expect(
      createService().signIn({ email: teacher.email, password: 'new-password-2026' }),
    ).resolves.toMatchObject({ user: { role: 'teacher' } })
  })

  // SECURITY: a reset requested for an unknown email changes nothing, and the demo answers the
  // same way as for a real account (account enumeration).
  it('treats an unknown email like a known one', async () => {
    const service = createService()
    const code = resetCodeFrom(await service.requestPasswordReset('nobody@example.com'))
    await expect(service.checkResetLink(code)).resolves.toBe(true)
    await service.resetPassword(code, 'new-password-2026')
    await expect(
      service.signIn({ email: teacher.email, password: DEMO_PASSWORD }),
    ).resolves.toMatchObject({ user: { role: 'teacher' } })
  })

  // Proves unreadable stored text is treated the same way.
  it('ignores a stored session that is not JSON', async () => {
    window.sessionStorage.setItem(SESSION_KEY, '{not json')
    await expect(createService().getSession()).resolves.toBeNull()
  })
})
