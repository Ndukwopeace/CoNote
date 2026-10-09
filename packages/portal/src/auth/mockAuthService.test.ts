/**
 * Tests for the shared demo AuthService: the contract every AuthService follows, plus the demo's
 * own storage rules.
 */

// Vitest building blocks.
import { afterEach, describe, expect, it, vi } from 'vitest'

// The shared rules, and the test portal's accounts and storage.
import { describeAuthServiceContract } from './authService.contract'
import { CONFIG, PASSWORD, SESSION_KEY, STAFF, STUDENT, createTestAuth } from '../test/harness'

// The unit under test.
import { readStoredSession } from './mockAuthService'

/** The code inside the demo reset link. */
function resetCodeFrom(request: { demoResetPath?: string }) {
  return (
    new URL(request.demoResetPath ?? '', 'https://conote.example').searchParams.get('code') ?? ''
  )
}

describeAuthServiceContract('demo', {
  createService: () => createTestAuth(),
  account: { email: STAFF.email, password: PASSWORD, fullName: STAFF.fullName, role: STAFF.role },
  resetCodeFrom,
})

describe('demo AuthService', () => {
  // Restore the real timers after each test.
  afterEach(() => {
    vi.useRealTimers()
  })

  // Proves an account that isn't active can't sign in, even with the right password (section 6.2).
  it('refuses accounts that are not active', async () => {
    const service = createTestAuth({
      accountStatus: (email) => (email === STAFF.email ? 'suspended' : 'active'),
    })

    await expect(service.signIn({ email: STAFF.email, password: PASSWORD })).rejects.toMatchObject({
      kind: 'forbidden',
      message: 'This account is not active. Contact your administrator.',
    })
    await expect(service.getSession()).resolves.toBeNull()
  })

  // Proves the stored session can be read without the service, for the other demo services.
  it('reads the stored session for other services', async () => {
    await createTestAuth().signIn({ email: STAFF.email, password: PASSWORD })

    expect(readStoredSession(window.sessionStorage, SESSION_KEY)?.user.id).toBe(STAFF.id)
  })

  // Proves any account can sign in here; the route guard, not the service, turns other roles away.
  it('signs in an account of another role', async () => {
    const session = await createTestAuth().signIn({ email: STUDENT.email, password: PASSWORD })

    expect(session.user.role).toBe('student')
  })

  // SECURITY: a stored session that was edited by hand (for example to change the role) doesn't
  // match the expected shape, so it is thrown away instead of trusted.
  it('ignores and removes a malformed stored session', async () => {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ user: { role: 'admin' } }))

    await expect(createTestAuth().getSession()).resolves.toBeNull()
    expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull()
  })

  // Proves unreadable stored text is treated the same way.
  it('ignores a stored session that is not JSON', async () => {
    window.sessionStorage.setItem(SESSION_KEY, '{nope')

    await expect(createTestAuth().getSession()).resolves.toBeNull()
    expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull()
  })

  // Proves the demo hands back a link to the portal's reset page, since no email is sent.
  it('returns a demo link to the reset page', async () => {
    const request = await createTestAuth().requestPasswordReset(STAFF.email)

    expect(request.demoResetPath).toMatch(new RegExp(`^${CONFIG.resetPath}\\?code=[\\w-]+$`))
  })

  // Proves a reset survives a reload, like a server-side change: a new service sees it.
  it('keeps a reset password across services', async () => {
    const first = createTestAuth()
    const code = resetCodeFrom(await first.requestPasswordReset(STAFF.email))
    await first.resetPassword(code, 'new-password-2026')

    await expect(
      createTestAuth().signIn({ email: STAFF.email, password: 'new-password-2026' }),
    ).resolves.toMatchObject({ user: { id: STAFF.id } })
  })

  // SECURITY: a reset requested for an unknown email changes nothing, and the demo answers the
  // same way as for a real account (account enumeration).
  it('treats an unknown email like a known one', async () => {
    const service = createTestAuth()
    const code = resetCodeFrom(await service.requestPasswordReset('nobody@example.com'))

    await expect(service.checkResetLink(code)).resolves.toBe(true)
    await service.resetPassword(code, 'new-password-2026')
    await expect(service.signIn({ email: STAFF.email, password: PASSWORD })).resolves.toMatchObject(
      { user: { id: STAFF.id } },
    )
  })

  // Proves unreadable stored passwords or reset records are treated as absent.
  it('ignores unreadable stored passwords and reset records', async () => {
    window.localStorage.setItem(`${CONFIG.demoDataPrefix}passwords`, '{nope')
    window.localStorage.setItem(`${CONFIG.demoDataPrefix}reset`, JSON.stringify({ code: 5 }))
    const service = createTestAuth()

    await expect(service.signIn({ email: STAFF.email, password: PASSWORD })).resolves.toBeDefined()
    await expect(service.checkResetLink('anything')).resolves.toBe(false)
  })

  // Proves the demo waits like a network call, so loading states show in the app.
  it('answers only after the simulated delay', async () => {
    // Arrange: a 300 ms delay on a fake clock.
    vi.useFakeTimers()
    const service = createTestAuth({ latencyMs: 300 })
    let answered = false
    void service.getSession().then(() => {
      answered = true
    })

    // Act: 299 ms is not enough, 300 ms is.
    await vi.advanceTimersByTimeAsync(299)
    expect(answered).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(answered).toBe(true)
  })
})
