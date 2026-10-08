/**
 * Runs a sign-in, reset or similar request for a form: tracks whether it is running, and turns a
 * failure into wording that is safe to show.
 */

// Local state.
import { useCallback, useState } from 'react'

// Normalises anything thrown into an AppError.
import { toAppError } from '@conote/core/errors'
// Error reporting.
import { reportError } from '@conote/core/reportError'

// Administrator-facing wording.
import { errorMessage } from '@/lib/errorMessages'

/** What `run` hands back: the value, or a failure already shown as `error`. */
type Outcome<T> = { ok: true; value: T } | { ok: false }

/** Request state for one form. */
export function useAuthRequest() {
  // The message from the last failure, or null.
  const [error, setError] = useState<string | null>(null)
  // True while a request runs, so the button can't be pressed twice.
  const [isPending, setIsPending] = useState(false)

  // Runs `request`, keeping the state above up to date.
  const run = useCallback(async <T>(request: () => Promise<T>): Promise<Outcome<T>> => {
    setIsPending(true)
    setError(null)
    try {
      const value = await request()
      return { ok: true, value }
    } catch (error_) {
      // SECURITY: only the safe wording reaches the screen; the details go to the reporter.
      reportError(error_, { where: 'useAuthRequest' })
      setError(errorMessage(toAppError(error_)))
      return { ok: false }
    } finally {
      setIsPending(false)
    }
  }, [])

  return { error, isPending, run }
}
