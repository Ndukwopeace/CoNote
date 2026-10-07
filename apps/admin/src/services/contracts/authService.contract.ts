/**
 * The rules every AuthService must follow, run against each implementation (ENGINEERING_STANDARDS.md
 * 2.5). The demo service runs them now; the Supabase service will run the same suite.
 */

// Shared error type.
import { AppError } from '@conote/core/errors'
// Vitest building blocks.
import { describe, expect, it, vi } from 'vitest'

// The interface under test.
import type { AuthService } from '../types'

/** What a contract run needs: a fresh service and a valid admin account for it. */
export interface AuthContractSetup {
  createService: () => AuthService
  admin: { email: string; password: string; fullName: string }
}

/** Registers the AuthService contract suite under `name`. */
export function describeAuthServiceContract(name: string, setup: AuthContractSetup) {
  describe(`AuthService contract: ${name}`, () => {
    // Proves a new visitor starts signed out.
    it('starts with no session', async () => {
      await expect(setup.createService().getSession()).resolves.toBeNull()
    })

    // Proves a correct admin sign-in returns, and keeps, an admin session.
    it('signs in an admin and remembers the session', async () => {
      const service = setup.createService()
      const session = await service.signIn({
        email: setup.admin.email,
        password: setup.admin.password,
      })
      expect(session.user).toMatchObject({
        email: setup.admin.email,
        fullName: setup.admin.fullName,
        role: 'admin',
      })
      await expect(service.getSession()).resolves.toEqual(session)
    })

    // Proves sign-in ignores letter case and stray spaces in the email, as people type it.
    it('accepts the email in any letter case and with surrounding spaces', async () => {
      const session = await setup.createService().signIn({
        email: `  ${setup.admin.email.toUpperCase()} `,
        password: setup.admin.password,
      })
      expect(session.user.email).toBe(setup.admin.email)
    })

    // SECURITY: a wrong password and an unknown email fail the same way, so the sign-in form can't
    // be used to find out which emails have accounts (account enumeration).
    it('rejects a wrong password and an unknown email with the same message', async () => {
      const service = setup.createService()
      const wrongPassword = service.signIn({ email: setup.admin.email, password: 'not-it-1' })
      const unknownEmail = service.signIn({ email: 'nobody@example.com', password: 'not-it-1' })
      const errors = await Promise.all([
        wrongPassword.catch((error: unknown) => error),
        unknownEmail.catch((error: unknown) => error),
      ])
      for (const error of errors) {
        expect(error).toBeInstanceOf(AppError)
        expect(error).toMatchObject({ kind: 'validation', message: 'Incorrect email or password.' })
      }
      await expect(service.getSession()).resolves.toBeNull()
    })

    // Proves signing out forgets the session.
    it('signs out', async () => {
      const service = setup.createService()
      await service.signIn({ email: setup.admin.email, password: setup.admin.password })
      await service.signOut()
      await expect(service.getSession()).resolves.toBeNull()
    })

    // Proves listeners hear about sign-in and sign-out, and stop hearing once unsubscribed.
    it('notifies listeners until they unsubscribe', async () => {
      const service = setup.createService()
      const listener = vi.fn()
      const stop = service.onAuthChange(listener)
      const session = await service.signIn({
        email: setup.admin.email,
        password: setup.admin.password,
      })
      expect(listener).toHaveBeenLastCalledWith(session)
      await service.signOut()
      expect(listener).toHaveBeenLastCalledWith(null)
      stop()
      await service.signIn({ email: setup.admin.email, password: setup.admin.password })
      expect(listener).toHaveBeenCalledTimes(2)
    })
  })
}
