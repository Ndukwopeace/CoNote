/**
 * Tests for the shared demo AuthService: the contract every AuthService follows, plus the demo's
 * own storage rules.
 */

// Vitest building blocks.
import { afterEach, describe, expect, it, vi } from 'vitest'

// The shared rules, and the test portal's accounts and storage.
import { describeAuthServiceContract } from './authService.contract'
import {
  CONFIG,
  INVITED,
  PASSWORD,
  SESSION_KEY,
  STAFF,
  STUDENT,
  createTestAuth,
} from '../test/harness'

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

describe('demo sign-in code', () => {
  // Proves the demo hands back the code, since no email is sent, and the code signs the person in.
  it('returns a demo code that signs in', async () => {
    const service = createTestAuth()
    const request = await service.requestSignInCode(STAFF.email)

    expect(request.demoCode).toMatch(/^\d{6}$/)
    const session = await service.signInWithCode(STAFF.email, request.demoCode ?? '')
    expect(session.user.email).toBe(STAFF.email)
    await expect(service.getSession()).resolves.toEqual(session)
  })

  // Proves the email is matched as people type it, and a pasted code with a space works.
  it('accepts the email in any letter case and the code with a space', async () => {
    const service = createTestAuth()
    const request = await service.requestSignInCode(`  ${STAFF.email.toUpperCase()} `)
    const pasted = `${request.demoCode?.slice(0, 3) ?? ''} ${request.demoCode?.slice(3) ?? ''}`

    await expect(service.signInWithCode(STAFF.email, pasted)).resolves.toBeDefined()
  })

  // SECURITY: proves a code works once, so a code seen over a shoulder cannot be used again.
  it('spends the code', async () => {
    const service = createTestAuth()
    const code = (await service.requestSignInCode(STAFF.email)).demoCode ?? ''
    await service.signInWithCode(STAFF.email, code)

    await expect(service.signInWithCode(STAFF.email, code)).rejects.toMatchObject({
      kind: 'validation',
      message: 'That code is not right or has expired. Ask for a new one.',
    })
  })

  // SECURITY: proves a new request replaces the old code, so only the newest email works.
  it('replaces the code when a new one is asked for', async () => {
    const service = createTestAuth()
    const first = (await service.requestSignInCode(STAFF.email)).demoCode ?? ''
    let second = first
    while (second === first) second = (await service.requestSignInCode(STAFF.email)).demoCode ?? ''

    await expect(service.signInWithCode(STAFF.email, first)).rejects.toMatchObject({
      kind: 'validation',
    })
    await expect(service.signInWithCode(STAFF.email, second)).resolves.toBeDefined()
  })

  // SECURITY: proves a wrong code and a code for another address fail the same way.
  it('refuses a wrong code and another address with one message', async () => {
    const service = createTestAuth()
    const code = (await service.requestSignInCode(STAFF.email)).demoCode ?? ''
    const wrong = code === '000000' ? '111111' : '000000'

    for (const attempt of [
      service.signInWithCode(STAFF.email, wrong),
      service.signInWithCode(STUDENT.email, code),
    ]) {
      await expect(attempt).rejects.toMatchObject({
        kind: 'validation',
        message: 'That code is not right or has expired. Ask for a new one.',
      })
    }
  })

  // SECURITY: proves an address with no account is answered like one with an account, and its
  // code opens nothing (account enumeration).
  it('answers the same for an unknown address, and signs nobody in', async () => {
    const service = createTestAuth()
    const request = await service.requestSignInCode('nobody@example.com')

    expect(request.demoCode).toMatch(/^\d{6}$/)
    await expect(
      service.signInWithCode('nobody@example.com', request.demoCode ?? ''),
    ).rejects.toMatchObject({ kind: 'validation' })
  })

  // Proves bad input is refused before anything is checked.
  it('checks the email and the code shape', async () => {
    const service = createTestAuth()

    await expect(service.requestSignInCode('not-an-email')).rejects.toMatchObject({
      kind: 'validation',
      message: 'Enter a valid email address.',
    })
    await expect(service.signInWithCode(STAFF.email, '12')).rejects.toMatchObject({
      kind: 'validation',
      message: 'Enter the 6-digit code.',
    })
  })

  // SECURITY: proves an account that is not active is refused even with a right code.
  it('refuses an account that is not active', async () => {
    const service = createTestAuth({ accountStatus: () => 'suspended' })
    const code = (await service.requestSignInCode(STAFF.email)).demoCode ?? ''

    await expect(service.signInWithCode(STAFF.email, code)).rejects.toMatchObject({
      kind: 'forbidden',
    })
    await expect(service.getSession()).resolves.toBeNull()
  })

  // Proves listeners hear about a code sign-in, like any other.
  it('tells listeners about the sign-in', async () => {
    const service = createTestAuth()
    const heard: (string | undefined)[] = []
    service.onAuthChange((session) => heard.push(session?.user.email))
    const code = (await service.requestSignInCode(STAFF.email)).demoCode ?? ''
    await service.signInWithCode(STAFF.email, code)

    expect(heard).toEqual([STAFF.email])
  })

  // Proves an unreadable stored code is treated as absent.
  it('ignores an unreadable stored code', async () => {
    window.localStorage.setItem(`${CONFIG.demoDataPrefix}signin-code`, '{nope')

    await expect(createTestAuth().signInWithCode(STAFF.email, '123456')).rejects.toMatchObject({
      kind: 'validation',
    })
  })
})

describe('demo first-time password (D118)', () => {
  /** Signs the invited account in with a code, as it does on its first visit. */
  async function signInInvitedWithCode(service = createTestAuth()) {
    const { demoCode } = await service.requestSignInCode(INVITED.email)
    return service.signInWithCode(INVITED.email, demoCode ?? '')
  }

  // Proves an invited account is told it has no password yet, and an ordinary account is not.
  it('flags an invited account on its first sign-in, and nobody else', async () => {
    const first = await signInInvitedWithCode()
    expect(first.user.mustSetPassword).toBe(true)

    const service = createTestAuth()
    const { demoCode } = await service.requestSignInCode(STAFF.email)
    const ordinary = await service.signInWithCode(STAFF.email, demoCode ?? '')
    expect(ordinary.user.mustSetPassword).toBeUndefined()
  })

  // Proves the flag survives a reload of the page, as the session does.
  it('keeps the flag in the stored session', async () => {
    await signInInvitedWithCode()

    await expect(createTestAuth().getSession()).resolves.toMatchObject({
      user: { id: INVITED.id, mustSetPassword: true },
    })
  })

  // Proves choosing a password clears the flag, in the answer, the stored session and for
  // listeners, and that the new password then signs in.
  it('clears the flag once a password is chosen, and the password works', async () => {
    const service = createTestAuth()
    await signInInvitedWithCode(service)
    const heard: (boolean | undefined)[] = []
    service.onAuthChange((session) => heard.push(session?.user.mustSetPassword))

    const session = await service.setPassword('chosen-password-2026')

    expect(session.user.mustSetPassword).toBeUndefined()
    expect(heard).toEqual([undefined])
    await expect(createTestAuth().getSession()).resolves.toMatchObject({
      user: { id: INVITED.id },
    })
    expect((await createTestAuth().getSession())?.user.mustSetPassword).toBeUndefined()
    await expect(
      createTestAuth().signIn({ email: INVITED.email, password: 'chosen-password-2026' }),
    ).resolves.toMatchObject({ user: { id: INVITED.id } })
  })

  // Proves the dialog does not come back on a later code sign-in.
  it('does not ask again on the next sign-in', async () => {
    const service = createTestAuth()
    await signInInvitedWithCode(service)
    await service.setPassword('chosen-password-2026')
    await service.signOut()

    const again = await signInInvitedWithCode(createTestAuth())

    expect(again.user.mustSetPassword).toBeUndefined()
  })

  // SECURITY: proves the staff password rules apply here too, and a refused password changes nothing.
  it('refuses a weak password and keeps the flag', async () => {
    const service = createTestAuth()
    await signInInvitedWithCode(service)

    await expect(service.setPassword('short1')).rejects.toMatchObject({ kind: 'validation' })

    expect((await createTestAuth().getSession())?.user.mustSetPassword).toBe(true)
  })

  // SECURITY: proves nobody can set a password without being signed in.
  it('refuses when nobody is signed in', async () => {
    await expect(createTestAuth().setPassword('chosen-password-2026')).rejects.toMatchObject({
      kind: 'unauthorized',
    })
  })
})
