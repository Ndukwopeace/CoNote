/**
 * What a page shows when its data failed to load: the not-found panel for a missing record,
 * otherwise a short message with a Retry button (REQUIREMENTS.md section 11).
 */

// Type for the not-found content.
import type { ReactNode } from 'react'

// The shared failure panel.
import { ErrorPanel } from '@conote/ui/common/ErrorPanel'
// Student-facing wording for each error kind.
import { errorMessage } from '@/lib/errorMessages'
// The error type.
import type { AppError } from '@conote/core/errors'

/** What the error panel needs. */
interface LoadErrorProps {
  // The failure.
  error: AppError
  // Loads again.
  onRetry: () => void
  // Shown instead when the record doesn't exist; omitted where "not found" can't happen.
  notFound?: ReactNode
}

/** The error panel for a failed load. */
export function LoadError({ error, onRetry, notFound }: Readonly<LoadErrorProps>) {
  // A missing record isn't a failure to retry; it gets its own panel.
  if (error.kind === 'not_found' && notFound) return notFound

  // SECURITY: errorMessage() gives fixed wording per kind, so internal details in the raw error
  // (stack traces, SQL, server paths) never reach the screen.
  return <ErrorPanel message={errorMessage(error)} onRetry={onRetry} />
}
