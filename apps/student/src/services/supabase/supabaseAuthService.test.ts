/**
 * Tests for the Supabase auth service's own logic, against a fake client: which calls it makes,
 * in what order, and how it reacts to each answer. The real backend is covered by the
 * integration contract run (supabaseAuthService.integration.test.ts).
 */

// Vitest building blocks.
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The type of what a listener hears.
import type { Session } from '@/types/auth'

// The fake client and the data it uses.
import { createFakeSupabase, profileRow, supabaseSession } from '@conote/testing/fakeSupabase'

// The service under test.
import { createSupabaseAuthService } from './supabaseAuthService'

// Key the session is stored under in these tests.
const KEY = 'test-auth'

/** A service over a fresh fake client. */
function setup() {
  window.localStorage.clear()
  window.sessionStorage.clear()
  const fake = createFakeSupabase()
  const service = createSupabaseAuthService({
    client: fake.client,
    rememberStorage: fake.rememberStorage,
    storageKey: KEY,
    origin: 'https://app.example',
  })
  return { ...fake, service }
}

/** Waits for deferred listener work (the service lets Supabase's own call finish first). */
const settled = () => vi.waitFor(() => undefined, { interval: 5 })

describe('signIn', () => {
  // Proves bad input never reaches the network.
  it('validates before calling Supabase', async () => {
    const { service, auth } = setup()
    await expect(
      service.signIn({ email: 'nope', password: 'x', remember: true }),
    ).rejects.toMatchObject({ kind: 'validation' })
    await expect(
      service.signIn({ email: 'a@b.co', password: '', remember: true }),
    ).rejects.toMatchObject({ kind: 'validation', message: 'Enter your password.' })
    expect(auth.signInWithPassword).not.toHaveBeenCalled()
  })

  // Proves the session is returned with the profile's role and name.
  it('returns the signed-in student from the profile', async () => {
    const { service } = setup()
    const session = await service.signIn({
      email: 'student@conote.example',
      password: 'password1',
      remember: false,
    })
    expect(session.user).toMatchObject({ role: 'student', fullName: 'Victory Eze' })
  })

  // SECURITY: proves "Remember me" is recorded before the session is written, so the first write
  // already lands in the right storage.
  it('records the remember choice before signing in', async () => {
    const { service, auth } = setup()
    auth.signInWithPassword.mockImplementationOnce(() => {
      expect(window.localStorage.getItem('fake-remember')).toBe('1')
      return Promise.resolve({
        data: { session: supabaseSession(), user: { id: '1' } },
        error: null,
      })
    })
    await service.signIn({ email: 'student@conote.example', password: 'password1', remember: true })
    expect(auth.signInWithPassword).toHaveBeenCalledOnce()
  })

  // Proves a Supabase failure becomes the message the form shows.
  it('maps a wrong password', async () => {
    const { service, auth } = setup()
    auth.signInWithPassword.mockResolvedValueOnce({
      data: {},
      error: { name: 'AuthApiError', code: 'invalid_credentials', status: 400, message: 'raw' },
    })
    await expect(
      service.signIn({ email: 'student@conote.example', password: 'wrong', remember: false }),
    ).rejects.toMatchObject({ kind: 'validation', message: 'Email or password is incorrect.' })
  })

  // SECURITY: proves an account an administrator has switched off is signed out again and
  // refused, whatever the password was.
  it.each(['inactive', 'suspended', 'pending'])('refuses a %s account', async (status) => {
    const { service, auth, profile } = setup()
    profile.answer = { data: profileRow({ status }), error: null }
    await expect(
      service.signIn({ email: 'student@conote.example', password: 'password1', remember: false }),
    ).rejects.toMatchObject({ kind: 'forbidden' })
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })
})

describe('signUp', () => {
  const input = { fullName: ' Ada Obi ', email: 'ada@example.com', password: 'password1' }

  // SECURITY: proves the weak-password and name rules hold even when the form is skipped.
  it('enforces the name and password rules', async () => {
    const { service, auth } = setup()
    await expect(service.signUp({ ...input, password: 'password' })).rejects.toMatchObject({
      kind: 'validation',
    })
    await expect(service.signUp({ ...input, fullName: 'A' })).rejects.toMatchObject({
      kind: 'validation',
    })
    expect(auth.signUp).not.toHaveBeenCalled()
  })

  // SECURITY: proves the browser never sends a role, so no one can sign up as an administrator.
  it('sends the name and the return address, and no role', async () => {
    const { service, auth } = setup()
    await service.signUp(input)
    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'ada@example.com',
      password: 'password1',
      options: { data: { full_name: 'Ada Obi' }, emailRedirectTo: 'https://app.example/login' },
    })
  })

  // Proves a backend that needs email confirmation says so instead of faking a sign-in (D76).
  it('asks for email confirmation when there is no session yet', async () => {
    const { service, auth } = setup()
    auth.signUp.mockResolvedValueOnce({ data: { session: null, user: { id: '1' } }, error: null })
    await expect(service.signUp(input)).resolves.toEqual({ status: 'confirm_email' })
  })

  // Proves a backend with confirmation switched off signs the student in.
  it('signs the student in when Supabase returns a session', async () => {
    const { service } = setup()
    const result = await service.signUp(input)
    expect(result.status).toBe('signed_in')
  })

  // Proves an address that already has an account is reported plainly.
  it('maps an existing account', async () => {
    const { service, auth } = setup()
    auth.signUp.mockResolvedValueOnce({
      data: {},
      error: { name: 'AuthApiError', code: 'user_already_exists', status: 422, message: 'raw' },
    })
    await expect(service.signUp(input)).rejects.toMatchObject({ kind: 'conflict' })
  })
})

describe('getSession', () => {
  // Proves a visitor with no stored session is signed out.
  it('returns null without a session', async () => {
    await expect(setup().service.getSession()).resolves.toBeNull()
  })

  // Proves a stored session is turned into the student.
  it('returns the student for a stored session', async () => {
    const { service, auth } = setup()
    auth.getSession.mockResolvedValueOnce({ data: { session: supabaseSession() }, error: null })
    await expect(service.getSession()).resolves.toMatchObject({ user: { role: 'student' } })
  })

  // SECURITY: proves a stored session for a suspended account counts as signed out.
  it('treats a suspended account as signed out', async () => {
    const { service, auth, profile } = setup()
    auth.getSession.mockResolvedValueOnce({ data: { session: supabaseSession() }, error: null })
    profile.answer = { data: profileRow({ status: 'suspended' }), error: null }
    await expect(service.getSession()).resolves.toBeNull()
  })
})

describe('signOut', () => {
  // SECURITY: proves nothing stays on this computer even when the server cannot be reached.
  it('clears stored sessions even if the server call fails', async () => {
    const { service, auth } = setup()
    window.localStorage.setItem(KEY, 'secret')
    window.sessionStorage.setItem(KEY, 'secret')
    auth.signOut.mockResolvedValueOnce({
      data: {},
      error: { name: 'AuthRetryableFetchError', status: 0, message: 'x' },
    })
    const listener = vi.fn()
    service.onAuthChange(listener)

    await expect(service.signOut()).rejects.toMatchObject({ kind: 'network' })

    expect(window.localStorage.getItem(KEY)).toBeNull()
    expect(window.sessionStorage.getItem(KEY)).toBeNull()
    expect(window.localStorage.getItem('fake-remember')).toBeNull()
    expect(listener).toHaveBeenCalledWith(null)
  })
})

describe('onAuthChange', () => {
  let listener: ReturnType<typeof vi.fn<(session: Session | null) => void>>
  beforeEach(() => {
    listener = vi.fn<(session: Session | null) => void>()
  })

  // Proves the service follows Supabase only while someone listens.
  it('follows Supabase only while there are listeners', () => {
    const { service, auth, unsubscribe } = setup()
    expect(auth.onAuthStateChange).not.toHaveBeenCalled()
    const stop = service.onAuthChange(listener)
    expect(auth.onAuthStateChange).toHaveBeenCalledOnce()
    stop()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  // Proves a sign-in made elsewhere (another tab, a returning Google redirect) reaches listeners
  // with the student, and a sign-out with null.
  it('reports sign-ins and sign-outs', async () => {
    const { service, emit, auth } = setup()
    auth.getSession.mockResolvedValue({ data: { session: supabaseSession() }, error: null })
    service.onAuthChange(listener)
    emit('SIGNED_IN', supabaseSession())
    await vi.waitFor(() => {
      expect(listener).toHaveBeenCalledTimes(1)
    })
    emit('SIGNED_OUT', null)
    await vi.waitFor(() => {
      expect(listener).toHaveBeenCalledTimes(2)
    })
    expect(listener.mock.calls[0]?.[0]?.user.role).toBe('student')
    expect(listener.mock.calls[1]?.[0]).toBeNull()
  })

  // Proves a change the service made itself is announced once, not again when Supabase reports it.
  it('announces its own sign-in once', async () => {
    const { service, emit, auth } = setup()
    auth.getSession.mockResolvedValue({ data: { session: supabaseSession() }, error: null })
    service.onAuthChange(listener)
    await service.signIn({
      email: 'student@conote.example',
      password: 'password1',
      remember: false,
    })
    emit('SIGNED_IN', supabaseSession())
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(listener).toHaveBeenCalledTimes(1)
  })

  // SECURITY: proves a late "signed in" report cannot bring back a student who has signed out.
  it('does not revive a session after sign-out', async () => {
    const { service, emit } = setup()
    service.onAuthChange(listener)
    await service.signOut()
    // Supabase is slow to say so; by then the session is gone.
    emit('SIGNED_IN', supabaseSession())
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(listener.mock.calls.every(([session]) => session === null)).toBe(true)
  })

  // Proves a sign-in is announced once even when Supabase's own report is handled while the
  // service is still reading the profile (the report would otherwise announce it first).
  it('announces a sign-in once when the report arrives mid-sign-in', async () => {
    const { service, emit, profile, auth } = setup()
    auth.getSession.mockResolvedValue({ data: { session: supabaseSession() }, error: null })
    service.onAuthChange(listener)
    // The first profile read (signIn's) waits; the second (the report's) answers at once, so the
    // report finishes first, as it can with a real network.
    let release: () => void = () => undefined
    profile.holds.push(
      new Promise<void>((resolve) => {
        release = resolve
      }),
    )
    const signingIn = service.signIn({
      email: 'student@conote.example',
      password: 'password1',
      remember: false,
    })
    // Let signIn start its read before the report arrives.
    await new Promise((resolve) => setTimeout(resolve, 10))
    emit('SIGNED_IN', supabaseSession())
    await new Promise((resolve) => setTimeout(resolve, 30))
    release()
    await signingIn
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(listener).toHaveBeenCalledTimes(1)
  })

  // SECURITY: proves a "signed in" report whose profile read is still running when the student
  // signs out cannot bring the student back once the read finishes.
  it('does not revive a session whose profile read outlives a sign-out', async () => {
    const { service, emit, profile, auth } = setup()
    auth.getSession.mockResolvedValue({ data: { session: supabaseSession() }, error: null })
    service.onAuthChange(listener)
    // Hold the profile read, then let Supabase report a sign-in from another tab.
    let release: () => void = () => undefined
    profile.hold = new Promise<void>((resolve) => {
      release = resolve
    })
    emit('SIGNED_IN', supabaseSession())
    await new Promise((resolve) => setTimeout(resolve, 30))
    // The student signs out while the read waits, then the read finishes.
    await service.signOut()
    release()
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(listener.mock.calls.every(([session]) => session === null)).toBe(true)
  })

  // Proves the profile is read again and announced, so a new name reaches the navigation.
  it('announces the refreshed profile', async () => {
    const { service, profile, auth } = setup()
    auth.getSession.mockResolvedValue({ data: { session: supabaseSession() }, error: null })
    service.onAuthChange(listener)
    await service.signIn({
      email: 'student@conote.example',
      password: 'password1',
      remember: false,
    })
    listener.mockClear()
    profile.answer = { data: profileRow({ full_name: 'Ada Lovelace' }), error: null }

    await service.refreshUser()

    expect(listener).toHaveBeenCalledOnce()
    expect(listener.mock.calls[0]?.[0]?.user.fullName).toBe('Ada Lovelace')
  })

  // Proves refreshing does nothing, quietly, when nobody is signed in.
  it('does nothing on refresh when signed out', async () => {
    const { service } = setup()
    service.onAuthChange(listener)

    await expect(service.refreshUser()).resolves.toBeUndefined()

    expect(listener).not.toHaveBeenCalled()
  })

  // Proves events that are not changes of who is signed in are ignored.
  it('ignores the initial report and token refreshes', async () => {
    const { service, emit } = setup()
    service.onAuthChange(listener)
    emit('INITIAL_SESSION', supabaseSession())
    emit('TOKEN_REFRESHED', supabaseSession())
    await settled()
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(listener).not.toHaveBeenCalled()
  })

  // Proves a sign-in for an account that may not sign in is reported as signed out.
  it('reports a suspended account as signed out', async () => {
    const { service, emit, profile, auth } = setup()
    profile.answer = { data: profileRow({ status: 'suspended' }), error: null }
    auth.getSession.mockResolvedValue({ data: { session: supabaseSession() }, error: null })
    service.onAuthChange(listener)
    emit('SIGNED_IN', supabaseSession())
    await vi.waitFor(() => {
      expect(listener).toHaveBeenCalledWith(null)
    })
  })
})

describe('password reset', () => {
  // Proves the request carries the page the link should open, and reveals nothing else.
  it('sends the reset email pointing at the reset page', async () => {
    const { service, auth } = setup()
    await expect(service.requestPasswordReset('ada@example.com')).resolves.toEqual({})
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('ada@example.com', {
      redirectTo: 'https://app.example/reset-password',
    })
  })

  // SECURITY: proves a missing code is refused without any network call.
  it.each([[null], ['']])('refuses the code %j without asking Supabase', async (code) => {
    const { service, auth } = setup()
    await expect(service.checkResetLink(code)).resolves.toBe(false)
    expect(auth.verifyOtp).not.toHaveBeenCalled()
  })

  // Proves a good code is accepted, and asking again does not spend it twice (the reset page
  // checks on open and again when the form is submitted).
  it('uses a reset code once however often it is checked', async () => {
    const { service, auth } = setup()
    await expect(service.checkResetLink('hash')).resolves.toBe(true)
    await expect(service.checkResetLink('hash')).resolves.toBe(true)
    expect(auth.verifyOtp).toHaveBeenCalledOnce()
    expect(auth.verifyOtp).toHaveBeenCalledWith({ type: 'recovery', token_hash: 'hash' })
  })

  // Proves used, made-up and replaced codes are all refused the same way.
  it('refuses a code Supabase rejects', async () => {
    const { service, auth } = setup()
    auth.verifyOtp.mockResolvedValueOnce({
      data: {},
      error: { name: 'AuthApiError', code: 'otp_expired', status: 403, message: 'raw' },
    })
    await expect(service.checkResetLink('old')).resolves.toBe(false)
  })

  // Proves a dropped connection is not mistaken for an expired link, and can be retried.
  it('reports a network failure and allows a retry', async () => {
    const { service, auth } = setup()
    auth.verifyOtp.mockResolvedValueOnce({
      data: {},
      error: { name: 'AuthRetryableFetchError', status: 0, message: 'x' },
    })
    await expect(service.checkResetLink('hash')).rejects.toMatchObject({ kind: 'network' })
    await expect(service.checkResetLink('hash')).resolves.toBe(true)
  })

  // SECURITY: proves a weak password is refused before the code is spent, so the student can retry.
  it('checks the password rules before touching the code', async () => {
    const { service, auth } = setup()
    await expect(service.resetPassword('hash', 'short')).rejects.toMatchObject({
      kind: 'validation',
    })
    expect(auth.verifyOtp).not.toHaveBeenCalled()
  })

  // SECURITY: proves a made-up or used code cannot change a password.
  it('refuses to reset with a code Supabase rejects', async () => {
    const { service, auth } = setup()
    auth.verifyOtp.mockResolvedValueOnce({
      data: {},
      error: { name: 'AuthApiError', code: 'otp_expired', status: 403, message: 'raw' },
    })
    await expect(service.resetPassword('old', 'password1')).rejects.toMatchObject({
      kind: 'validation',
      message: 'This reset link has expired. Request a new one.',
    })
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  // Proves the new password is saved and the temporary session ends, so the student signs in again.
  it('sets the password and ends the temporary session', async () => {
    const { service, auth } = setup()
    await service.resetPassword('hash', 'password1')
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'password1' })
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  // Proves a session that timed out while the form was open reads as an expired link.
  it('reports a timed-out reset as an expired link', async () => {
    const { service, auth } = setup()
    auth.updateUser.mockResolvedValueOnce({
      data: {},
      error: {
        name: 'AuthSessionMissingError',
        code: 'session_not_found',
        status: 401,
        message: 'x',
      },
    })
    await expect(service.resetPassword('hash', 'password1')).rejects.toMatchObject({
      kind: 'validation',
      message: 'This reset link has expired. Request a new one.',
    })
  })

  // SECURITY: proves opening a reset link is not mistaken for signing in. The temporary session
  // must not put the student into the app before they have chosen a password.
  it('does not report the temporary session as a sign-in', async () => {
    const { service, emit } = setup()
    const listener = vi.fn()
    service.onAuthChange(listener)
    await service.checkResetLink('hash')
    emit('SIGNED_IN', supabaseSession())
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('updatePassword', () => {
  // Proves the current password is required and checked against the real account.
  it('requires and verifies the current password', async () => {
    const { service, auth } = setup()
    await expect(service.updatePassword('', 'longenough1')).rejects.toMatchObject({
      kind: 'validation',
      message: 'Enter your current password.',
    })
    auth.signInWithPassword.mockResolvedValueOnce({
      data: {},
      error: { name: 'AuthApiError', code: 'invalid_credentials', status: 400, message: 'raw' },
    })
    await expect(service.updatePassword('wrong-one-1', 'longenough1')).rejects.toMatchObject({
      kind: 'validation',
      message: 'Your current password is incorrect.',
    })
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  // Proves a correct current password lets the change through.
  it('changes the password after verifying the current one', async () => {
    const { service, auth } = setup()
    await service.updatePassword('current-1', 'longenough1')
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'student@conote.example',
      password: 'current-1',
    })
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'longenough1' })
  })
})

describe('signInWithProvider', () => {
  // Proves Google sign-in sends the browser away with the right return address.
  it('starts the Google redirect', () => {
    const { service, auth } = setup()
    void service.signInWithProvider('google')
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://app.example/dashboard' },
    })
  })
})
