/**
 * Auth service variations for page tests: one that never answers (to see loading states) and
 * one that always fails (to see error states).
 */

// Builds a normal instant demo service to start from.
import { createTestServices } from './renderWithRouter'
// The app's error type.
import { AppError } from '@/lib/errors'
// The interface being varied.
import type { AuthService } from '@/services/types'

/** A promise that never settles, so a test can look at the "in flight" state. */
function never<T>() {
  // The executor ignores its callbacks, so nothing ever resolves it.
  return new Promise<T>(() => undefined)
}

/** The demo auth service with `overrides` applied. */
export function authWith(overrides: Partial<AuthService>): AuthService {
  // Start from the working demo service and replace only what the test names.
  return { ...createTestServices().auth, ...overrides }
}

/** An auth service whose requests never finish. */
export function hangingAuth(): AuthService {
  return authWith({
    // Every request a form can make hangs.
    signIn: never,
    signUp: never,
    signInWithProvider: never,
    requestPasswordReset: never,
    resetPassword: never,
    updatePassword: never,
  })
}

/** An auth service whose requests all fail as if the network were down. */
export function offlineAuth(): AuthService {
  // The same failure for every request.
  const fail = () => Promise.reject(new AppError('network', 'offline'))
  return authWith({
    signIn: fail,
    signUp: fail,
    signInWithProvider: fail,
    requestPasswordReset: fail,
    checkResetLink: fail,
    resetPassword: fail,
    updatePassword: fail,
  })
}
