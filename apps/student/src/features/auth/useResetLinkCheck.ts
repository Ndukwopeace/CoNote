/**
 * Checks a password reset link's code when the reset page opens (FR-AUTH-5), with loading,
 * expired and error states and a retry.
 */

// Local state, the effect that runs the check, and a stable retry function.
import { useCallback, useEffect, useState } from 'react'

// Student-facing wording for errors.
import { errorMessage } from '@/lib/errorMessages'
// Normalises anything thrown into an AppError.
import { toAppError } from '@conote/core/errors'
// Reports failures to developers.
import { reportError } from '@conote/core/reportError'

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
  /**
   * The latest answer, tagged with the code it is about. An answer for a different code counts
   * as "checking", so when the address changes to a new code the old link's form disappears
   * at once instead of staying usable while the new code is checked.
   */
  const [answer, setAnswer] = useState<{ code: string | null; state: ResetLinkState } | null>(null)
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
        if (active) setAnswer({ code, state: { status: valid ? 'valid' : 'expired' } })
      })
      .catch((error: unknown) => {
        // Tell developers.
        reportError(error, { where: 'useResetLinkCheck' })
        // Tell the student, in safe wording, and offer a retry.
        if (active) {
          setAnswer({ code, state: { status: 'error', message: errorMessage(toAppError(error)) } })
        }
      })
    // Clean-up: forget this attempt.
    return () => {
      active = false
    }
  }, [auth, code, attempt])

  /** Checks again after an error. */
  const retry = useCallback(() => {
    // Back to the loading state...
    setAnswer(null)
    // ...and run the effect again.
    setAttempt((current) => current + 1)
  }, [])

  // SECURITY: only an answer about the current code counts; anything else is still checking,
  // so no field shows for a code that hasn't been checked (FR-AUTH-5).
  const state: ResetLinkState =
    answer !== null && answer.code === code ? answer.state : { status: 'checking' }
  // The state and the retry.
  return { state, retry }
}
