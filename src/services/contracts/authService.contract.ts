import { describe, expect, it, vi } from 'vitest'

import { AppError } from '@/lib/errors'
import type { Session } from '@/types/auth'

import type { AuthService } from '../types'

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
  const { create, validCredentials } = options

  describe(`AuthService contract: ${name}`, () => {
    it('starts with no session', async () => {
      await expect(create().getSession()).resolves.toBeNull()
    })

    it('signs in with valid credentials and returns the user', async () => {
      const auth = create()

      const session = await auth.signIn({ ...validCredentials, remember: true })

      expect(session.user.email).toBe(validCredentials.email)
      expect(session.user.role).toBe('student')
    })

    it('keeps the session after sign-in', async () => {
      const auth = create()
      await auth.signIn({ ...validCredentials, remember: true })

      await expect(auth.getSession()).resolves.not.toBeNull()
    })

    it('rejects an invalid email with a validation error', async () => {
      const auth = create()

      const attempt = auth.signIn({ email: 'not-an-email', password: 'x', remember: false })

      await expect(attempt).rejects.toBeInstanceOf(AppError)
      await expect(attempt).rejects.toMatchObject({ kind: 'validation' })
    })

    it('clears the session on sign-out', async () => {
      const auth = create()
      await auth.signIn({ ...validCredentials, remember: true })

      await auth.signOut()

      await expect(auth.getSession()).resolves.toBeNull()
    })

    it('notifies listeners on sign-in and sign-out', async () => {
      const auth = create()
      const listener = vi.fn<(session: Session | null) => void>()
      auth.onAuthChange(listener)

      await auth.signIn({ ...validCredentials, remember: false })
      await auth.signOut()

      const [afterSignIn, afterSignOut] = listener.mock.calls
      expect(afterSignIn?.[0]?.user.email).toBe(validCredentials.email)
      expect(afterSignOut?.[0]).toBeNull()
    })

    it('stops notifying a listener after it unsubscribes', async () => {
      const auth = create()
      const listener = vi.fn<(session: Session | null) => void>()
      const unsubscribe = auth.onAuthChange(listener)

      unsubscribe()
      await auth.signIn({ ...validCredentials, remember: false })

      expect(listener).not.toHaveBeenCalled()
    })

    it('creates a student account on sign-up', async () => {
      const auth = create()

      const session = await auth.signUp({
        fullName: 'Ada Obi',
        email: 'ada@example.com',
        password: 'password1',
      })

      expect(session.user).toMatchObject({ fullName: 'Ada Obi', role: 'student' })
    })
  })
}
