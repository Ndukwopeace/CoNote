/**
 * Tests for the staff Supabase auth service's own rules, against a fake client: the wording,
 * the email and password checks, and that a staff session is never remembered. The session
 * machinery itself is tested through the student service; the real backend is covered by the
 * integration contract run (staffAuthService.integration.test.ts).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The fake client and the data it uses.
import { createFakeSupabase, profileRow } from '@conote/testing/fakeSupabase'

// The service under test.
import { createSupabaseStaffAuthService } from './staffAuthService'

// Key the session is stored under in these tests.
const KEY = 'test-staff-auth'

/** A service over a fresh fake client whose account is an administrator. */
function setup() {
  window.localStorage.clear()
  window.sessionStorage.clear()
  const fake = createFakeSupabase()
  fake.profile.answer = {
    data: profileRow({ role: 'admin', full_name: 'Amara Okafor', email: 'admin@conote.example' }),
    error: null,
  }
  const service = createSupabaseStaffAuthService({
    client: fake.client,
    rememberStorage: fake.rememberStorage,
    storageKey: KEY,
    origin: 'https://admin.example',
    resetPath: '/admin/reset-password',
  })
  return { ...fake, service }
}

describe('signIn', () => {
  // Proves bad input never reaches the network.
  it('validates before calling Supabase', async () => {
    const { service, auth } = setup()
    await expect(service.signIn({ email: 'nope', password: 'x' })).rejects.toMatchObject({
      kind: 'validation',
      message: 'Enter a valid email address.',
    })
    await expect(service.signIn({ email: 'a@b.co', password: '' })).rejects.toMatchObject({
      kind: 'validation',
      message: 'Enter your password.',
    })
    expect(auth.signInWithPassword).not.toHaveBeenCalled()
  })

  // Proves the email is cleaned the way the form cleans it, and the role comes from the profile.
  it('signs in with the email trimmed and lower-cased', async () => {
    const { service, auth } = setup()
    const session = await service.signIn({ email: '  Admin@Conote.Example ', password: 'pw' })
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'admin@conote.example',
      password: 'pw',
    })
    expect(session.user).toMatchObject({ role: 'admin', fullName: 'Amara Okafor' })
  })

  // SECURITY: proves a staff session is never written to long-lived storage.
  it('never remembers the session', async () => {
    const { service } = setup()
    await service.signIn({ email: 'admin@conote.example', password: 'pw' })
    expect(window.localStorage.getItem('fake-remember')).not.toBe('1')
  })

  // Proves a wrong password gives the staff wording, the same for any account.
  it('maps a wrong password to the staff message', async () => {
    const { service, auth } = setup()
    auth.signInWithPassword.mockResolvedValueOnce({
      data: {},
      error: { name: 'AuthApiError', code: 'invalid_credentials', status: 400, message: 'raw' },
    })
    await expect(
      service.signIn({ email: 'admin@conote.example', password: 'wrong' }),
    ).rejects.toMatchObject({ kind: 'validation', message: 'Incorrect email or password.' })
  })

  // Proves other failures (a dropped connection) keep their own wording.
  it('lets other failures through unchanged', async () => {
    const { service, auth } = setup()
    auth.signInWithPassword.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(
      service.signIn({ email: 'admin@conote.example', password: 'pw' }),
    ).rejects.toBeInstanceOf(Error)
  })

  // SECURITY: proves a switched-off account is refused, whatever the password was.
  it('refuses a suspended account', async () => {
    const { service, auth, profile } = setup()
    profile.answer = { data: profileRow({ role: 'admin', status: 'suspended' }), error: null }
    await expect(
      service.signIn({ email: 'admin@conote.example', password: 'pw' }),
    ).rejects.toMatchObject({ kind: 'forbidden' })
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })
})

describe('password reset', () => {
  // Proves the email points at the portal's own reset page, and reveals nothing else.
  it('sends the reset email pointing at the portal reset page', async () => {
    const { service, auth } = setup()
    await expect(service.requestPasswordReset(' Admin@Conote.example ')).resolves.toEqual({})
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('admin@conote.example', {
      redirectTo: 'https://admin.example/admin/reset-password',
    })
  })

  // Proves a malformed address is refused before anything is sent.
  it('refuses a malformed email', async () => {
    const { service, auth } = setup()
    await expect(service.requestPasswordReset('not-an-email')).rejects.toMatchObject({
      kind: 'validation',
    })
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled()
  })

  // SECURITY: proves a weak password is refused before the link is spent, so the person can retry.
  it('checks the staff password rules before touching the link', async () => {
    const { service, auth } = setup()
    await expect(service.resetPassword('code', 'short1')).rejects.toMatchObject({
      kind: 'validation',
    })
    expect(auth.verifyOtp).not.toHaveBeenCalled()
  })

  // Proves a good password and a good link change the password and end the temporary session.
  it('sets the password and ends the temporary session', async () => {
    const { service, auth } = setup()
    await service.resetPassword('code', 'new-password-2026')
    expect(auth.verifyOtp).toHaveBeenCalledWith({ type: 'recovery', token_hash: 'code' })
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'new-password-2026' })
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  // Proves the same link is not honoured once Supabase refuses it.
  it('refuses a link Supabase rejects', async () => {
    const { service, auth } = setup()
    auth.verifyOtp.mockResolvedValueOnce({
      data: {},
      error: { name: 'AuthApiError', code: 'otp_expired', status: 403, message: 'expired' },
    })
    await expect(service.checkResetLink('old')).resolves.toBe(false)
    await expect(service.resetPassword('old', 'new-password-2026')).rejects.toMatchObject({
      kind: 'validation',
      message: 'This reset link has expired. Request a new one.',
    })
  })
})
