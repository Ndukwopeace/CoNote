/**
 * Tests for the demo AuthService: the shared contract, plus what only the demo does (stored
 * session, demo accounts for each role).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The shared rules.
import { describeAuthServiceContract } from '../contracts/authService.contract'

// The unit under test.
import { createMockAuthService, DEMO_ACCOUNTS, DEMO_PASSWORD, SESSION_KEY } from './mockAuthService'

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

// The demo admin account.
const admin = DEMO_ACCOUNTS.find((account) => account.role === 'admin')!

describeAuthServiceContract('mock', {
  createService: () => createService(),
  admin: { email: admin.email, password: DEMO_PASSWORD, fullName: admin.fullName },
  resetCodeFrom,
})

describe('mock AuthService', () => {
  // Proves the demo offers one account per role, so the admin-only guard can be tried out.
  it('has a demo account for each role', () => {
    expect(DEMO_ACCOUNTS.map((account) => account.role).sort()).toEqual([
      'admin',
      'student',
      'teacher',
    ])
  })

  // Proves non-admins can sign in here; the route guard, not the service, turns them away.
  it('signs in a teacher with the teacher role', async () => {
    const teacher = DEMO_ACCOUNTS.find((account) => account.role === 'teacher')!
    const session = await createService().signIn({
      email: teacher.email,
      password: DEMO_PASSWORD,
    })
    expect(session.user.role).toBe('teacher')
  })

  // Proves a reload keeps the admin signed in: a new service over the same store finds the session.
  it('keeps the session in the given store', async () => {
    await createService().signIn({ email: admin.email, password: DEMO_PASSWORD })
    await expect(createService().getSession()).resolves.toMatchObject({
      user: { role: 'admin' },
    })
  })

  // SECURITY: a stored session that was edited by hand (for example to change the role) doesn't
  // match the expected shape, so it is thrown away instead of trusted.
  it('ignores and removes a malformed stored session', async () => {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ user: { role: 'admin' } }))
    await expect(createService().getSession()).resolves.toBeNull()
    expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull()
  })

  // Proves the demo hands back a link to the reset page, since no email is sent.
  it('returns a demo link to the reset page', async () => {
    const request = await createService().requestPasswordReset(admin.email)
    expect(request.demoResetPath).toMatch(/^\/admin\/reset-password\?code=[\w-]+$/)
  })

  // Proves a reset survives a reload, like a server-side change: a new service sees it.
  it('keeps a reset password across services', async () => {
    const first = createService()
    const code = resetCodeFrom(await first.requestPasswordReset(admin.email))
    await first.resetPassword(code, 'new-password-2026')
    await expect(
      createService().signIn({ email: admin.email, password: 'new-password-2026' }),
    ).resolves.toMatchObject({ user: { role: 'admin' } })
  })

  // SECURITY: a reset requested for an unknown email changes nothing, and the demo answers the
  // same way as for a real account (account enumeration).
  it('treats an unknown email like a known one', async () => {
    const service = createService()
    const code = resetCodeFrom(await service.requestPasswordReset('nobody@example.com'))
    await expect(service.checkResetLink(code)).resolves.toBe(true)
    await service.resetPassword(code, 'new-password-2026')
    await expect(
      service.signIn({ email: admin.email, password: DEMO_PASSWORD }),
    ).resolves.toMatchObject({ user: { role: 'admin' } })
  })

  // Proves unreadable stored text is treated the same way.
  it('ignores a stored session that is not JSON', async () => {
    window.sessionStorage.setItem(SESSION_KEY, '{not json')
    await expect(createService().getSession()).resolves.toBeNull()
  })
})
