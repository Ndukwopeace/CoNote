/**
 * Tests for the demo auth service: the shared contract plus demo-specific storage behaviour.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The behaviour every auth service must share.
import { runAuthServiceContract } from '../contracts/authService.contract'

// The implementation under test.
import { createMockAuthService } from './mockAuthService'

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
  it('accepts password reset requests without revealing whether the account exists', async () => {
    await expect(
      createService().requestPasswordReset('nobody@example.com'),
    ).resolves.toBeUndefined()
  })

  // Proves the minimum password length is enforced.
  it('rejects a new password shorter than 8 characters', async () => {
    await expect(createService().updatePassword('short1')).rejects.toMatchObject({
      kind: 'validation',
    })
  })

  // Proves a valid password is accepted.
  it('accepts a valid new password', async () => {
    await expect(createService().updatePassword('longenough1')).resolves.toBeUndefined()
  })
})
