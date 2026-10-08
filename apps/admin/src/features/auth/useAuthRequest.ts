/**
 * Runs a sign-in, reset or similar request for a form: tracks whether it is running, and turns a
 * failure into wording that is safe to show.
 */

// Local state.
import { useCallback, useState } from 'react'

// Normalises anything thrown into an AppError, and the kinds it can be.
import { toAppError, type AppErrorKind } from '@conote/core/errors'
// Error reporting.
import { reportError } from '@conote/core/reportError'

// Administrator-facing wording.
import { errorMessage } from '@/lib/errorMessages'

/** No special wording: one shared object, so `run` stays the same function between renders. */
const NO_MESSAGES: Partial<Record<AppErrorKind, string>> = {}

/** What `run` hands back: the value, or a failure already shown as `error`. */
type Outcome<T> = { ok: true; value: T } | { ok: false }

/**
 * Request state for one form. `messages` gives the form its own wording for some error kinds,
 * such as "This account is not active" on sign-in; every other kind uses the standard wording.
 */
export function useAuthRequest(messages: Partial<Record<AppErrorKind, string>> = NO_MESSAGES) {
  // The message from the last failure, or null.
  const [error, setError] = useState<string | null>(null)
  // True while a request runs, so the button can't be pressed twice.
  const [isPending, setIsPending] = useState(false)

  // Runs `request`, keeping the state above up to date.
  const run = useCallback(
    async <T>(request: () => Promise<T>): Promise<Outcome<T>> => {
      setIsPending(true)
      setError(null)
      try {
        const value = await request()
        return { ok: true, value }
      } catch (error_) {
        // SECURITY: only the safe wording reaches the screen; the details go to the reporter.
        reportError(error_, { where: 'useAuthRequest' })
        const appError = toAppError(error_)
        setError(messages[appError.kind] ?? errorMessage(appError))
        return { ok: false }
      } finally {
        setIsPending(false)
      }
      // Callers pass a constant, so this changes only if a form swaps its wording.
    },
    [messages],
  )

  return { error, isPending, run }
}
