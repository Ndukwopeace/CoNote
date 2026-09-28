/**
 * Checks a password reset link's code when the reset page opens (FR-AUTH-5), with loading,
 * expired and error states and a retry.
 */

// Local state, the effect that runs the check, and a stable retry function.
import { useCallback, useEffect, useState } from 'react'

// Student-facing wording for errors.
import { errorMessage } from '@/lib/errorMessages'
// Normalises anything thrown into an AppError.
import { toAppError } from '@/lib/errors'
// Reports failures to developers.
import { reportError } from '@/lib/reportError'

// The injected auth service. Used directly because it is a stable object, whereas the auth
// context's functions are rebuilt on every sign-in change and would re-run the check.
import { useServices } from '@/services/useServices'

/** Where the check stands. Exactly one state at a time. */
export type ResetLinkState =
  // Waiting for the service.
  | { status: 'checking' }
  // The code works; show the form.
  | { status: 'valid' }
  // Missing, made up, used or replaced by a newer link.
  | { status: 'expired' }
  // The check itself failed (e.g. offline); the link may still be fine.
  | { status: 'error'; message: string }

/** Checks `code` and returns the state plus a function to try again after an error. */
export function useResetLinkCheck(code: string | null) {
  // The auth service.
  const { auth } = useServices()
  // Starts in "checking", so neither the form nor the expired message flashes first.
  const [state, setState] = useState<ResetLinkState>({ status: 'checking' })
  // Bumped by retry() to run the effect again.
  const [attempt, setAttempt] = useState(0)

  // Runs the check on open, when the code changes, and on each retry.
  useEffect(() => {
    // Ignores a late answer after the page has closed or the code has changed.
    let active = true
    // Ask the service.
    auth
      .checkResetLink(code)
      .then((valid) => {
        // Show the form or the expired message.
        if (active) setState({ status: valid ? 'valid' : 'expired' })
      })
      .catch((error: unknown) => {
        // Tell developers.
        reportError(error, { where: 'useResetLinkCheck' })
        // Tell the student, in safe wording, and offer a retry.
        if (active) setState({ status: 'error', message: errorMessage(toAppError(error)) })
      })
    // Clean-up: forget this attempt.
    return () => {
      active = false
    }
  }, [auth, code, attempt])

  /** Checks again after an error. */
  const retry = useCallback(() => {
    // Back to the loading state...
    setState({ status: 'checking' })
    // ...and run the effect again.
    setAttempt((current) => current + 1)
  }, [])

  // The state and the retry.
  return { state, retry }
}
