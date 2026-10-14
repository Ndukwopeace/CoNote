/**
 * Finishes a Google sign-in when the student comes back from Google (the /auth/callback page):
 * swaps the code in the address for a session, or says what went wrong.
 */

// Local state and the effect that runs the exchange.
import { useEffect, useState } from 'react'

// Normalises anything thrown into an AppError.
import { toAppError } from '@conote/core/errors'
// Reports failures to developers.
import { reportError } from '@conote/core/reportError'

// Student-facing wording for errors.
import { errorMessage } from '@/lib/errorMessages'
// The injected auth service. Used directly because it is a stable object.
import { useServices } from '@/services/useServices'

/** Where the sign-in stands. Success has no state of its own: the signed-in redirect takes over. */
export type ProviderSignInState =
  // The code is being swapped for a session.
  | { status: 'working' }
  // It did not work; `message` says why, in words for the student.
  | { status: 'failed'; message: string }

/** Shown when the student closed Google's window or pressed "Cancel". */
const CANCELLED =
  'You cancelled the Google sign-in. Go back and choose Continue with Google to try again.'
/** Shown when Google reports another problem. Google's own text is never shown. */
const GOOGLE_FAILED = 'Google could not sign you in. Please go back and try again.'
/** Shown when the address has no code, for example because it was typed or cut short. */
const NO_CODE =
  'This address is missing the sign-in code from Google. Please go back and try again.'

/**
 * Exchanges already started, by code. Google's code works once, so a second render of the page
 * (React's development mode renders twice) must join the first exchange, never start another.
 */
const exchanges = new Map<string, Promise<unknown>>()

/** Finishes the sign-in for `code`, or explains the `providerError` Google sent instead. */
export function useProviderSignIn(
  code: string | null,
  providerError: string | null,
): ProviderSignInState {
  // The auth service.
  const { auth } = useServices()
  // The failure of the exchange, tagged with the code it is about, so a new code starts clean.
  const [failure, setFailure] = useState<{ code: string; message: string } | null>(null)

  // Run the exchange when there is a code and Google reported no problem.
  useEffect(() => {
    // Nothing to exchange.
    if (providerError !== null || code === null || code === '') return
    // Ignore a late answer after the page has closed or the code has changed.
    let active = true
    // Join an exchange already running for this code, or start it.
    let exchange = exchanges.get(code)
    if (!exchange) {
      exchange = auth.completeProviderSignIn(code)
      exchanges.set(code, exchange)
    }
    exchange.catch((error: unknown) => {
      // Tell developers.
      reportError(error, { where: 'useProviderSignIn' })
      // Tell the student, in safe wording.
      if (active) setFailure({ code, message: errorMessage(toAppError(error)) })
    })
    return () => {
      active = false
    }
  }, [auth, code, providerError])

  // Google said no (the student cancelled, or Google had a problem).
  if (providerError !== null) {
    return {
      status: 'failed',
      message: providerError === 'access_denied' ? CANCELLED : GOOGLE_FAILED,
    }
  }
  // An address with no code can never work.
  if (code === null || code === '') return { status: 'failed', message: NO_CODE }
  // The exchange failed for this code.
  if (failure?.code === code) return { status: 'failed', message: failure.message }
  // Still working.
  return { status: 'working' }
}
