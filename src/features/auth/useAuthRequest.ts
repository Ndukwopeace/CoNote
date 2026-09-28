/**
 * Shared busy and error handling for the sign-in, sign-up and password forms (FR-AUTH-6).
 */

// State for the flags, and a stable callback.
import { useCallback, useState } from 'react'

// Student-facing wording for errors.
import { errorMessage } from '@/lib/errorMessages'
// Normalises anything thrown into an AppError.
import { toAppError } from '@/lib/errors'

/** The outcome of one request: its value, or a failure already shown to the student. */
export type AuthRequestResult<T> = { ok: true; value: T } | { ok: false }

/** Runs auth requests one at a time, tracking whether one is in flight and the last error. */
export function useAuthRequest() {
  // The message for the alert above the form, or null.
  const [error, setError] = useState<string | null>(null)
  // True while a request is in flight; forms disable their buttons with it.
  const [isPending, setIsPending] = useState(false)

  /** Runs `action`, showing its failure as a safe message instead of throwing. */
  const run = useCallback(async <T>(action: () => Promise<T>): Promise<AuthRequestResult<T>> => {
    // A new attempt clears the old message.
    setError(null)
    // Disable the buttons so the request can't be sent twice.
    setIsPending(true)
    try {
      // Wait for the service.
      const value = await action()
      // Hand the result back to the page.
      return { ok: true, value }
    } catch (caught) {
      // SECURITY: only the student-facing wording is shown, never a raw error, which could leak
      // internal details. Sign-in errors never say whether the email or the password was wrong,
      // so the form can't be used to discover accounts.
      setError(errorMessage(toAppError(caught)))
      // The page knows it failed; the message is already on screen.
      return { ok: false }
    } finally {
      // Re-enable the form either way.
      setIsPending(false)
    }
  }, [])

  // The flags and the runner.
  return { error, isPending, run }
}
