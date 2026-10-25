/**
 * Tests for the staff Supabase auth service's own rules, against a fake client: the wording,
 * the email and password checks, and that a staff session is never remembered. The session
 * machinery itself is tested through the student service; the real backend is covered by the
 * integration contract run (staffAuthService.integration.test.ts).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The fake client and the data it uses.
import { createFakeSupabase, profileRow, supabaseSession } from '@conote/testing/fakeSupabase'

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

describe('requestSignInCode', () => {
  // Proves a malformed address is refused before anything is sent.
  it('refuses a malformed email', async () => {
    const { service, auth } = setup()
    await expect(service.requestSignInCode('not-an-email')).rejects.toMatchObject({
      kind: 'validation',
      message: 'Enter a valid email address.',
    })
    expect(auth.signInWithOtp).not.toHaveBeenCalled()
  })

  // SECURITY: proves a code is only ever sent to an account that already exists, so asking for a
  // code can never create an account for a stranger.
  it('asks Supabase for a code without creating accounts, with the email cleaned', async () => {
    const { service, auth } = setup()
    await expect(service.requestSignInCode(' Admin@Conote.example ')).resolves.toEqual({})
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'admin@conote.example',
      options: { shouldCreateUser: false },
    })
  })

  // SECURITY: proves an address with no account is answered like one with an account, so the form
  // cannot be used to find out who has an account (account enumeration).
  it('answers the same for an address with no account', async () => {
    const { service, auth } = setup()
    auth.signInWithOtp.mockResolvedValueOnce({
      data: {},
      error: {
        name: 'AuthApiError',
        code: 'otp_disabled',
        status: 422,
        message: 'Signups not allowed for otp',
      },
    })
    await expect(service.requestSignInCode('nobody@example.com')).resolves.toEqual({})
  })

  // Proves a project with email codes switched off is not mistaken for "no account": the person
  // sees an error instead of waiting for an email that will never come.
  it('does not hide email codes being switched off', async () => {
    const { service, auth } = setup()
    auth.signInWithOtp.mockResolvedValueOnce({
      data: {},
      error: {
        name: 'AuthApiError',
        code: 'otp_disabled',
        status: 422,
        message: 'Email OTP is disabled',
      },
    })
    await expect(service.requestSignInCode('admin@conote.example')).rejects.toBeInstanceOf(Error)
  })

  // Proves a rate limit is explained, not hidden: nothing was sent, and the person must wait.
  it('explains a rate limit', async () => {
    const { service, auth } = setup()
    auth.signInWithOtp.mockResolvedValueOnce({
      data: {},
      error: {
        name: 'AuthApiError',
        code: 'over_email_send_rate_limit',
        status: 429,
        message: 'rate limit',
      },
    })
    await expect(service.requestSignInCode('admin@conote.example')).rejects.toMatchObject({
      kind: 'validation',
      message: 'Too many attempts. Wait a few minutes and try again.',
    })
  })

  // Proves a dropped connection is reported as one, so the person can simply try again.
  it('lets a dropped connection through', async () => {
    const { service, auth } = setup()
    auth.signInWithOtp.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(service.requestSignInCode('admin@conote.example')).rejects.toMatchObject({
      kind: 'network',
    })
  })
})

describe('signInWithCode', () => {
  // SECURITY: proves a request that skips the form cannot send Supabase anything but six digits.
  it('checks the code has six digits before calling Supabase', async () => {
    const { service, auth } = setup()
    await expect(service.signInWithCode('admin@conote.example', '12345')).rejects.toMatchObject({
      kind: 'validation',
      message: 'Enter the 6-digit code.',
    })
    await expect(service.signInWithCode('nope', '123456')).rejects.toMatchObject({
      kind: 'validation',
      message: 'Enter a valid email address.',
    })
    expect(auth.verifyOtp).not.toHaveBeenCalled()
  })

  // Proves a code pasted as "482 913" works, and the role comes from the profile, not the request.
  it('signs in with the code as pasted, and reads the role from the profile', async () => {
    const { service, auth } = setup()
    const session = await service.signInWithCode(' Admin@Conote.Example ', '482 913')
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: 'admin@conote.example',
      token: '482913',
      type: 'email',
    })
    expect(session.user).toMatchObject({ role: 'admin', fullName: 'Amara Okafor' })
  })

  // SECURITY: proves a staff session made with a code ends with the tab, like any staff session.
  it('never remembers the session', async () => {
    const { service } = setup()
    await service.signInWithCode('admin@conote.example', '482913')
    expect(window.localStorage.getItem('fake-remember')).not.toBe('1')
  })

  // SECURITY: proves a wrong, used and expired code are refused the same way, so the message
  // reveals nothing about which one it was.
  it('refuses every bad code with one message', async () => {
    const { service, auth } = setup()
    for (const code of ['otp_expired', 'validation_failed', 'anything_else']) {
      auth.verifyOtp.mockResolvedValueOnce({
        data: {},
        error: { name: 'AuthApiError', code, status: 403, message: 'raw' },
      })
      await expect(service.signInWithCode('admin@conote.example', '482913')).rejects.toMatchObject({
        kind: 'validation',
        message: 'That code is not right or has expired. Ask for a new one.',
      })
    }
  })

  // Proves a dropped connection says nothing about the code, so the person can simply retry.
  it('lets a dropped connection through', async () => {
    const { service, auth } = setup()
    auth.verifyOtp.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(service.signInWithCode('admin@conote.example', '482913')).rejects.toMatchObject({
      kind: 'network',
    })
  })

  // Proves an answer without a session is not a sign-in.
  it('refuses an answer that carries no session', async () => {
    const { service, auth } = setup()
    auth.verifyOtp.mockResolvedValueOnce({ data: { session: null, user: null }, error: null })
    await expect(service.signInWithCode('admin@conote.example', '482913')).rejects.toMatchObject({
      kind: 'validation',
      message: 'That code is not right or has expired. Ask for a new one.',
    })
  })

  // SECURITY: proves a switched-off account is refused even with a right code.
  it('refuses a suspended account', async () => {
    const { service, auth, profile } = setup()
    profile.answer = { data: profileRow({ role: 'admin', status: 'suspended' }), error: null }
    await expect(service.signInWithCode('admin@conote.example', '482913')).rejects.toMatchObject({
      kind: 'forbidden',
    })
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  // Proves an invited person is activated by their first code: a right code proves they own the
  // address, which is what accepting an invitation means. No password is needed.
  it('activates an invited account', async () => {
    const { service, auth, profile, rpc } = setup()
    profile.answer = { data: profileRow({ role: 'teacher', status: 'pending' }), error: null }
    rpc.mockImplementationOnce(() => {
      profile.answer = { data: profileRow({ role: 'teacher', status: 'active' }), error: null }
      return Promise.resolve({ data: null, error: null })
    })
    const session = await service.signInWithCode('admin@conote.example', '482913')
    expect(rpc).toHaveBeenCalledWith('accept_invitation')
    expect(session.user.role).toBe('teacher')
    expect(auth.signOut).not.toHaveBeenCalled()
  })

  // Proves Supabase's own "signed in" report, which arrives while the invitation is being
  // accepted, does not sign the person out because the profile still says pending.
  it('is not signed out by the sign-in report that arrives mid-way', async () => {
    const { service, auth, profile, rpc, emit } = setup()
    profile.answer = { data: profileRow({ role: 'teacher', status: 'pending' }), error: null }
    rpc.mockImplementationOnce(async () => {
      // Supabase reports the new session; the handler runs on the next tick.
      emit('SIGNED_IN', supabaseSession())
      await new Promise((resolve) => setTimeout(resolve, 20))
      profile.answer = { data: profileRow({ role: 'teacher', status: 'active' }), error: null }
      return { data: null, error: null }
    })
    // While the code is accepted, the session already exists as far as Supabase is concerned.
    auth.getSession.mockResolvedValue({ data: { session: supabaseSession() }, error: null })
    service.onAuthChange(() => undefined)
    await service.signInWithCode('admin@conote.example', '482913')
    expect(auth.signOut).not.toHaveBeenCalled()
  })
})
