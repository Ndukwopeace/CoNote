/**
 * Tests for the demo auth service: the shared contract plus demo-specific storage behaviour.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The behaviour every auth service must share.
import { runAuthServiceContract } from '../contracts/authService.contract'

// The implementation under test.
import { createMockAuthService } from './mockAuthService'

/** The code inside a demo reset link. */
function codeFrom({ demoResetPath }: { demoResetPath?: string }) {
  // Parse the link against any origin; only the query string matters.
  return new URL(demoResetPath ?? '', 'https://conote.test').searchParams.get('code') ?? ''
}

/** A fresh service on the test's storage, with no delay. */
function createService() {
  return createMockAuthService({
    localStore: window.localStorage,
    sessionStore: window.sessionStorage,
    latencyMs: 0,
  })
}

// Run the shared contract against the mock.
runAuthServiceContract('mock', {
  create: createService,
  validCredentials: { email: 'victory@example.com', password: 'anything1' },
})

describe('mock AuthService', () => {
  // SECURITY: proves "remember me" never writes a name or email to long-lived storage.
  it('remembers a session in localStorage without storing the email or name there', async () => {
    // Act: sign in with "remember me".
    await createService().signIn({ email: 'v@example.com', password: 'x', remember: true })

    // Every value now in localStorage.
    const persisted = Object.keys(window.localStorage).map((key) =>
      window.localStorage.getItem(key),
    )
    // Something was stored (the marker)...
    expect(persisted).not.toHaveLength(0)
    // ...but none of it is personal.
    expect(persisted.join(' ')).not.toMatch(/v@example\.com|Victory|Okafor/)
  })

  // Proves "remember me" still works after the browser closes (simulated by clearing sessionStorage).
  it('restores a remembered session as the demo student after the browser restarts', async () => {
    // Arrange: remembered sign-in, then the "browser restart".
    await createService().signIn({ email: 'v@example.com', password: 'x', remember: true })
    window.sessionStorage.clear()

    // Assert: a new service instance restores the demo student.
    await expect(createService().getSession()).resolves.toMatchObject({
      user: { role: 'student', fullName: 'Victory Okafor' },
    })
  })

  // SECURITY: proves a session without "remember me" leaves nothing in long-lived storage.
  it('keeps a session without "remember me" in sessionStorage only', async () => {
    // Act.
    await createService().signIn({ email: 'v@example.com', password: 'x', remember: false })

    // Assert: identity in sessionStorage, localStorage empty.
    expect(window.sessionStorage.getItem('conote:session')).not.toBeNull()
    expect(window.localStorage.length).toBe(0)
  })

  // Proves a page reload (a new service instance) keeps the student signed in.
  it('restores a stored session in a new service instance', async () => {
    // Arrange.
    await createService().signIn({ email: 'v@example.com', password: 'x', remember: true })

    // Assert: same email restored.
    await expect(createService().getSession()).resolves.toMatchObject({
      user: { email: 'v@example.com' },
    })
  })

  // SECURITY: proves broken stored data is rejected instead of crashing or signing someone in.
  it('treats a corrupted stored session as signed out', async () => {
    // Arrange: text that isn't JSON.
    window.sessionStorage.setItem('conote:session', '{not json')

    // Assert.
    await expect(createService().getSession()).resolves.toBeNull()
  })

  // SECURITY: proves tampered data with the wrong shape is rejected.
  it('treats a stored session with the wrong shape as signed out', async () => {
    // Arrange: JSON, but not a valid session.
    window.sessionStorage.setItem('conote:session', JSON.stringify({ user: { id: 1 } }))

    // Assert.
    await expect(createService().getSession()).resolves.toBeNull()
  })

  // Proves every demo sign-in becomes the wireframes' student.
  it('signs in as the demo student', async () => {
    // Act.
    const session = await createService().signIn({
      email: 'v@example.com',
      password: 'x',
      remember: false,
    })

    // Assert.
    expect(session.user.fullName).toBe('Victory Okafor')
  })

  // Proves an empty password is refused with a message the form can show.
  it('rejects an empty password', async () => {
    await expect(
      createService().signIn({ email: 'v@example.com', password: '', remember: false }),
    ).rejects.toMatchObject({ kind: 'validation' })
  })

  // Proves the demo OAuth buttons sign straight in.
  it('signs in with an OAuth provider straight away', async () => {
    // Act.
    const session = await createService().signInWithProvider('google')

    // Assert.
    expect(session.user.role).toBe('student')
  })

  // SECURITY: proves the reset form gives the same answer for unknown accounts (no enumeration).
  it('answers a reset request the same way whether or not the account exists', async () => {
    // Act: one request for the signed-in demo address, one for an address nobody uses.
    const known = await createService().requestPasswordReset('victory@conote.demo')
    const unknown = await createService().requestPasswordReset('nobody@example.com')

    // Assert: both answers have the same shape, so nothing reveals which account exists.
    expect(Object.keys(unknown)).toEqual(Object.keys(known))
  })

  // Proves the demo hands back a reset link, because it sends no email (FR-AUTH-7).
  it('returns a demo reset link that opens the reset page with a working code', async () => {
    // Arrange.
    const auth = createService()

    // Act: request a reset.
    const { demoResetPath } = await auth.requestPasswordReset('v@example.com')

    // Assert: a link to the reset page carrying a code...
    expect(demoResetPath).toMatch(/^\/reset-password\?code=[\w-]+$/)
    // ...and that code is accepted.
    const code = new URL(demoResetPath ?? '', 'https://conote.test').searchParams.get('code')
    await expect(auth.checkResetLink(code)).resolves.toBe(true)
  })

  // SECURITY: proves a reset link works once only, so an old link from an inbox can't be reused.
  it('refuses a reset code once the password has been reset with it', async () => {
    // Arrange: request a reset and read the code.
    const auth = createService()
    const code = codeFrom(await auth.requestPasswordReset('v@example.com'))

    // Act: reset the password with it.
    await auth.resetPassword(code, 'newpassword1')

    // Assert: the link is now refused, both when checked and when used again.
    await expect(auth.checkResetLink(code)).resolves.toBe(false)
    await expect(auth.resetPassword(code, 'another1pass')).rejects.toMatchObject({
      kind: 'validation',
    })
  })

  // SECURITY: proves only the most recent link works, so an older email can't be used instead.
  it('refuses an older reset code after a newer one is requested', async () => {
    // Arrange: two requests in a row.
    const auth = createService()
    const oldCode = codeFrom(await auth.requestPasswordReset('v@example.com'))
    await auth.requestPasswordReset('v@example.com')

    // Assert: the first code no longer works, for checking or for resetting.
    await expect(auth.checkResetLink(oldCode)).resolves.toBe(false)
    await expect(auth.resetPassword(oldCode, 'newpassword1')).rejects.toMatchObject({
      kind: 'validation',
    })
  })

  // SECURITY: proves a page opened with a link that was later superseded can't reset the
  // password; the code is checked again at the moment of the reset, not only when the page opened.
  it('checks the code again when the password is reset', async () => {
    // Arrange: the page checks a valid code...
    const auth = createService()
    const code = codeFrom(await auth.requestPasswordReset('v@example.com'))
    await expect(auth.checkResetLink(code)).resolves.toBe(true)
    // ...then a newer link is requested elsewhere.
    await auth.requestPasswordReset('v@example.com')

    // Assert: the old page's reset is refused.
    await expect(auth.resetPassword(code, 'newpassword1')).rejects.toMatchObject({
      kind: 'validation',
    })
  })

  // Proves a weak password doesn't spend the code, so the student can fix it and try again.
  it('keeps the code when the new password breaks the rules', async () => {
    // Arrange.
    const auth = createService()
    const code = codeFrom(await auth.requestPasswordReset('v@example.com'))

    // Act: a weak password is refused.
    await expect(auth.resetPassword(code, 'weak')).rejects.toMatchObject({ kind: 'validation' })

    // Assert: the code still works.
    await expect(auth.checkResetLink(code)).resolves.toBe(true)
  })

  // Proves the new-password rules apply to reset as well as sign-up (FR-AUTH-3): [password].
  it.each([['abcdefgh'], ['12345678']])('rejects the weak new password %j', async (password) => {
    await expect(createService().updatePassword('current1', password)).rejects.toMatchObject({
      kind: 'validation',
    })
  })

  // Proves sign-up applies the full password rules, not just the length.
  it('rejects a sign-up password without a number', async () => {
    await expect(
      createService().signUp({ fullName: 'Ada Obi', email: 'a@b.co', password: 'password' }),
    ).rejects.toMatchObject({ kind: 'validation', message: 'Include at least one number.' })
  })

  // Proves sign-up applies the name length rule.
  it('rejects a one-letter full name at sign-up', async () => {
    await expect(
      createService().signUp({ fullName: 'A', email: 'a@b.co', password: 'password1' }),
    ).rejects.toMatchObject({ kind: 'validation' })
  })

  // Proves the minimum password length is enforced.
  it('rejects a new password shorter than 8 characters', async () => {
    await expect(createService().updatePassword('current1', 'short1')).rejects.toMatchObject({
      kind: 'validation',
    })
  })

  // Proves a valid password is accepted.
  it('accepts a valid new password', async () => {
    await expect(createService().updatePassword('current1', 'longenough1')).resolves.toBeUndefined()
  })
})
