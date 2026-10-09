/**
 * The rules every AuthService must follow, run against each implementation (ENGINEERING_STANDARDS.md
 * 2.5). The demo service runs them now; the Supabase service will run the same suite.
 */

// Shared error type.
import { AppError } from '@conote/core/errors'
// Vitest building blocks.
import { describe, expect, it, vi } from 'vitest'

// The interface under test, and the reset request shape.
import type { AuthService, PasswordResetRequest } from './types'

/** What a contract run needs: a fresh service, a valid staff account, and the reset code. */
export interface AuthContractSetup {
  createService: () => AuthService
  account: { email: string; password: string; fullName: string; role: string }
  /** The code from a reset request (the demo returns a link; a real backend would email it). */
  resetCodeFrom: (request: PasswordResetRequest) => string
}

/** A new password that meets the staff rules (12+ characters, a letter and a number). */
const NEW_PASSWORD = 'new-password-2026'

/** Registers the AuthService contract suite under `name`. */
export function describeAuthServiceContract(name: string, setup: AuthContractSetup) {
  describe(`AuthService contract: ${name}`, () => {
    // Proves a new visitor starts signed out.
    it('starts with no session', async () => {
      await expect(setup.createService().getSession()).resolves.toBeNull()
    })

    // Proves a correct sign-in returns, and keeps, a session.
    it('signs in an account and remembers the session', async () => {
      const service = setup.createService()
      const session = await service.signIn({
        email: setup.account.email,
        password: setup.account.password,
      })
      expect(session.user).toMatchObject({
        email: setup.account.email,
        fullName: setup.account.fullName,
        role: setup.account.role,
      })
      await expect(service.getSession()).resolves.toEqual(session)
    })

    // Proves sign-in ignores letter case and stray spaces in the email, as people type it.
    it('accepts the email in any letter case and with surrounding spaces', async () => {
      const session = await setup.createService().signIn({
        email: `  ${setup.account.email.toUpperCase()} `,
        password: setup.account.password,
      })
      expect(session.user.email).toBe(setup.account.email)
    })

    // SECURITY: a wrong password and an unknown email fail the same way, so the sign-in form can't
    // be used to find out which emails have accounts (account enumeration).
    it('rejects a wrong password and an unknown email with the same message', async () => {
      const service = setup.createService()
      const wrongPassword = service.signIn({ email: setup.account.email, password: 'not-it-1' })
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
      await service.signIn({ email: setup.account.email, password: setup.account.password })
      await service.signOut()
      await expect(service.getSession()).resolves.toBeNull()
    })

    // SECURITY: the answer is the same whether or not the email has an account, so the form can't
    // be used to find out who has one (account enumeration).
    it('accepts a reset request for any well-formed email', async () => {
      const service = setup.createService()
      await expect(service.requestPasswordReset(setup.account.email)).resolves.toBeTypeOf('object')
      await expect(service.requestPasswordReset('nobody@example.com')).resolves.toBeTypeOf('object')
    })

    // Proves a malformed email is refused before anything is sent.
    it('refuses a reset request for a malformed email', async () => {
      await expect(
        setup.createService().requestPasswordReset('not-an-email'),
      ).rejects.toMatchObject({ kind: 'validation' })
    })

    // SECURITY: a missing or made-up code never opens the reset form.
    it.each([null, '', 'made-up-code'])('refuses the reset link %j', async (code) => {
      await expect(setup.createService().checkResetLink(code)).resolves.toBe(false)
    })

    // Proves the whole reset: the link works once, the new password signs in, the old one doesn't.
    it('resets the password once with a valid link', async () => {
      const service = setup.createService()
      const code = setup.resetCodeFrom(await service.requestPasswordReset(setup.account.email))
      await expect(service.checkResetLink(code)).resolves.toBe(true)
      await service.resetPassword(code, NEW_PASSWORD)
      // SECURITY: the code is spent, so the same link can't change the password again.
      await expect(service.checkResetLink(code)).resolves.toBe(false)
      await expect(service.resetPassword(code, 'another-pass-2026')).rejects.toMatchObject({
        kind: 'validation',
        message: 'This reset link has expired. Request a new one.',
      })
      // The old password stops working; the new one works.
      await expect(
        service.signIn({ email: setup.account.email, password: setup.account.password }),
      ).rejects.toMatchObject({ kind: 'validation' })
      await expect(
        service.signIn({ email: setup.account.email, password: NEW_PASSWORD }),
      ).resolves.toMatchObject({ user: { role: setup.account.role } })
    })

    // SECURITY: a weak password is refused by the service too, not only by the form, and the
    // link stays usable so the user can try again.
    it('refuses a weak new password without spending the link', async () => {
      const service = setup.createService()
      const code = setup.resetCodeFrom(await service.requestPasswordReset(setup.account.email))
      await expect(service.resetPassword(code, 'short1')).rejects.toMatchObject({
        kind: 'validation',
      })
      await expect(service.checkResetLink(code)).resolves.toBe(true)
    })

    // SECURITY: only the newest link works, so an older email can't be used after a new request.
    it('replaces an older link with a newer one', async () => {
      const service = setup.createService()
      const older = setup.resetCodeFrom(await service.requestPasswordReset(setup.account.email))
      const newer = setup.resetCodeFrom(await service.requestPasswordReset(setup.account.email))
      await expect(service.checkResetLink(older)).resolves.toBe(false)
      await expect(service.checkResetLink(newer)).resolves.toBe(true)
    })

    // Proves listeners hear about sign-in and sign-out, and stop hearing once unsubscribed.
    it('notifies listeners until they unsubscribe', async () => {
      const service = setup.createService()
      const listener = vi.fn()
      const stop = service.onAuthChange(listener)
      const session = await service.signIn({
        email: setup.account.email,
        password: setup.account.password,
      })
      expect(listener).toHaveBeenLastCalledWith(session)
      await service.signOut()
      expect(listener).toHaveBeenLastCalledWith(null)
      stop()
      await service.signIn({ email: setup.account.email, password: setup.account.password })
      expect(listener).toHaveBeenCalledTimes(2)
    })
  })
}
