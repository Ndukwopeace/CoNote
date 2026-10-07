/**
 * What a page shows when its data failed to load: the not-found panel for a missing record,
 * otherwise a short message with a Retry button (REQUIREMENTS.md section 11).
 */

// Warning icon.
import { AlertTriangle } from 'lucide-react'
// Type for the not-found content.
import type { ReactNode } from 'react'

// Standard button.
import { Button } from '@conote/ui/button'
// Student-facing wording for each error kind.
import { errorMessage } from '@/lib/errorMessages'
// The error type.
import type { AppError } from '@/lib/errors'

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

  return (
    // role="alert" so screen readers announce the failure as soon as it appears.
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-xl border border-error-soft bg-card p-6 sm:flex-row sm:items-center"
    >
      {/* Decorative icon. */}
      <AlertTriangle aria-hidden="true" className="size-5 shrink-0 text-error-strong" />
      {/* SECURITY: errorMessage() gives fixed wording per kind, so internal details in the raw
          error (stack traces, SQL, server paths) never reach the screen. */}
      <p className="flex-1 text-sm">{errorMessage(error)}</p>
      {/* Try again. */}
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}
