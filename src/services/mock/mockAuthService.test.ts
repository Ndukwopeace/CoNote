import { describe, expect, it } from 'vitest'

import { runAuthServiceContract } from '../contracts/authService.contract'

import { createMockAuthService } from './mockAuthService'

function createService() {
  return createMockAuthService({
    localStore: window.localStorage,
    sessionStore: window.sessionStorage,
    latencyMs: 0,
  })
}

runAuthServiceContract('mock', {
  create: createService,
  validCredentials: { email: 'victory@example.com', password: 'anything1' },
})

describe('mock AuthService', () => {
  it('remembers a session in localStorage without storing the email or name there', async () => {
    await createService().signIn({ email: 'v@example.com', password: 'x', remember: true })

    const persisted = Object.keys(window.localStorage).map((key) =>
      window.localStorage.getItem(key),
    )
    expect(persisted).not.toHaveLength(0)
    expect(persisted.join(' ')).not.toMatch(/v@example\.com|Victory|Okafor/)
  })

  it('restores a remembered session as the demo student after the browser restarts', async () => {
    await createService().signIn({ email: 'v@example.com', password: 'x', remember: true })
    window.sessionStorage.clear()

    await expect(createService().getSession()).resolves.toMatchObject({
      user: { role: 'student', fullName: 'Victory Okafor' },
    })
  })

  it('keeps a session without "remember me" in sessionStorage only', async () => {
    await createService().signIn({ email: 'v@example.com', password: 'x', remember: false })

    expect(window.sessionStorage.getItem('conote:session')).not.toBeNull()
    expect(window.localStorage.length).toBe(0)
  })

  it('restores a stored session in a new service instance', async () => {
    await createService().signIn({ email: 'v@example.com', password: 'x', remember: true })

    await expect(createService().getSession()).resolves.toMatchObject({
      user: { email: 'v@example.com' },
    })
  })

  it('treats a corrupted stored session as signed out', async () => {
    window.sessionStorage.setItem('conote:session', '{not json')

    await expect(createService().getSession()).resolves.toBeNull()
  })

  it('treats a stored session with the wrong shape as signed out', async () => {
    window.sessionStorage.setItem('conote:session', JSON.stringify({ user: { id: 1 } }))

    await expect(createService().getSession()).resolves.toBeNull()
  })

  it('signs in as the demo student', async () => {
    const session = await createService().signIn({
      email: 'v@example.com',
      password: 'x',
      remember: false,
    })

    expect(session.user.fullName).toBe('Victory Okafor')
  })

  it('rejects an empty password', async () => {
    await expect(
      createService().signIn({ email: 'v@example.com', password: '', remember: false }),
    ).rejects.toMatchObject({ kind: 'validation' })
  })

  it('signs in with an OAuth provider straight away', async () => {
    const session = await createService().signInWithProvider('google')

    expect(session.user.role).toBe('student')
  })

  it('accepts password reset requests without revealing whether the account exists', async () => {
    await expect(
      createService().requestPasswordReset('nobody@example.com'),
    ).resolves.toBeUndefined()
  })

  it('rejects a new password shorter than 8 characters', async () => {
    await expect(createService().updatePassword('short1')).rejects.toMatchObject({
      kind: 'validation',
    })
  })

  it('accepts a valid new password', async () => {
    await expect(createService().updatePassword('longenough1')).resolves.toBeUndefined()
  })
})
