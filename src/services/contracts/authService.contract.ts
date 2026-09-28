/**
 * The contract every AuthService must meet. The mock runs it today; the Supabase implementation
 * will run the same file, which is what makes switching data sources safe
 * (ENGINEERING_STANDARDS.md 2.5).
 */

// Vitest's test building blocks; `vi.fn` records calls to a fake function.
import { describe, expect, it, vi } from 'vitest'

// The error type a validation failure must be.
import { AppError } from '@/lib/errors'
// The session type, used to type the fake listener.
import type { Session } from '@/types/auth'

// The interface under test.
import type { AuthService } from '../types'

/** What an implementation's test file passes in. */
interface AuthContractOptions {
  /** Builds a fresh service with no signed-in user. */
  create: () => AuthService
  /** Credentials the implementation accepts. */
  validCredentials: { email: string; password: string }
}

/**
 * Behaviour every AuthService implementation must share (ENGINEERING_STANDARDS.md 2.5).
 * The mock runs this now; the Supabase implementation runs it in the backend stage.
 */
export function runAuthServiceContract(name: string, options: AuthContractOptions) {
  // Unpack the factory and credentials.
  const { create, validCredentials } = options

  // Group the tests under the implementation's name in the report.
  describe(`AuthService contract: ${name}`, () => {
    // Proves a new visitor is signed out; otherwise the guards would let strangers in.
    it('starts with no session', async () => {
      // A fresh service must report no session.
      await expect(create().getSession()).resolves.toBeNull()
    })

    // Proves sign-in works and always produces a student.
    it('signs in with valid credentials and returns the user', async () => {
      // Arrange: a fresh service.
      const auth = create()

      // Act: sign in.
      const session = await auth.signIn({ ...validCredentials, remember: true })

      // Assert: the session belongs to the email used...
      expect(session.user.email).toBe(validCredentials.email)
      // ...and to a student, the only role this portal serves.
      expect(session.user.role).toBe('student')
    })

    // Proves the session persists, so a page reload doesn't sign the student out.
    it('keeps the session after sign-in', async () => {
      // Arrange: sign in.
      const auth = create()
      await auth.signIn({ ...validCredentials, remember: true })

      // Assert: asking again still finds a session.
      await expect(auth.getSession()).resolves.not.toBeNull()
    })

    // Proves bad input becomes a validation error the form can show.
    it('rejects an invalid email with a validation error', async () => {
      // Arrange: a fresh service.
      const auth = create()

      // Act: try a malformed email (kept as a promise so it can be checked twice).
      const attempt = auth.signIn({ email: 'not-an-email', password: 'x', remember: false })

      // Assert: it fails with the app's own error type...
      await expect(attempt).rejects.toBeInstanceOf(AppError)
      // ...of kind "validation", so the message is safe to display.
      await expect(attempt).rejects.toMatchObject({ kind: 'validation' })
    })

    // Proves sign-out really ends the session (important on shared computers).
    it('clears the session on sign-out', async () => {
      // Arrange: signed in.
      const auth = create()
      await auth.signIn({ ...validCredentials, remember: true })

      // Act: sign out.
      await auth.signOut()

      // Assert: no session remains.
      await expect(auth.getSession()).resolves.toBeNull()
    })

    // Proves the app is told about changes; the AuthProvider depends on this to update screens.
    it('notifies listeners on sign-in and sign-out', async () => {
      // Arrange: a fresh service and a recording listener.
      const auth = create()
      const listener = vi.fn<(session: Session | null) => void>()
      auth.onAuthChange(listener)

      // Act: sign in, then out.
      await auth.signIn({ ...validCredentials, remember: false })
      await auth.signOut()

      // Assert: first call carried the new session, second call carried null.
      const [afterSignIn, afterSignOut] = listener.mock.calls
      expect(afterSignIn?.[0]?.user.email).toBe(validCredentials.email)
      expect(afterSignOut?.[0]).toBeNull()
    })

    // Proves unsubscribing works, so unmounted components don't keep receiving updates.
    it('stops notifying a listener after it unsubscribes', async () => {
      // Arrange: subscribe, keeping the unsubscribe function.
      const auth = create()
      const listener = vi.fn<(session: Session | null) => void>()
      const unsubscribe = auth.onAuthChange(listener)

      // Act: unsubscribe, then cause a change.
      unsubscribe()
      await auth.signIn({ ...validCredentials, remember: false })

      // Assert: the listener heard nothing.
      expect(listener).not.toHaveBeenCalled()
    })

    // Proves a reset request resolves without an error for any well-formed email.
    it('accepts a reset request for any well-formed email', async () => {
      // An address with no account must still succeed (no account enumeration).
      await expect(create().requestPasswordReset('nobody@example.com')).resolves.toBeTypeOf(
        'object',
      )
    })

    // SECURITY: proves a missing or made-up reset code is refused, so the reset page can't be
    // used without a real link from the email.
    it.each([[null], [''], ['made-up-code']])('refuses the reset code %j', async (code) => {
      await expect(create().checkResetLink(code)).resolves.toBe(false)
    })

    // Proves weak new passwords are refused by the service, not only by the form.
    it('rejects a new password that breaks the password rules', async () => {
      await expect(create().updatePassword('short')).rejects.toMatchObject({ kind: 'validation' })
    })

    // Proves sign-up creates a student with the given name.
    it('creates a student account on sign-up', async () => {
      // Arrange: a fresh service.
      const auth = create()

      // Act: sign up.
      const session = await auth.signUp({
        fullName: 'Ada Obi',
        email: 'ada@example.com',
        password: 'password1',
      })

      // Assert: the name is kept and the role is student.
      expect(session.user).toMatchObject({ fullName: 'Ada Obi', role: 'student' })
    })
  })
}
