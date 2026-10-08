/**
 * The panel a data view shows when it failed to load: one sentence and a "Try again" button.
 * Each app supplies its own wording.
 */

// Warning icon.
import { AlertTriangle } from 'lucide-react'

// Standard button.
import { Button } from '../components/button'

/** What the panel shows. */
interface ErrorPanelProps {
  // What went wrong, in words for the reader. Never a raw error message.
  message: string
  // Loads again.
  onRetry: () => void
}

/** A bordered row: icon, message, and the retry button. */
export function ErrorPanel({ message, onRetry }: Readonly<ErrorPanelProps>) {
  return (
    // role="alert" so screen readers announce the failure as soon as it appears.
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-xl border border-error-soft bg-card p-6 sm:flex-row sm:items-center"
    >
      {/* Decorative icon. */}
      <AlertTriangle aria-hidden="true" className="size-5 shrink-0 text-error-strong" />
      {/* The message. */}
      <p className="flex-1 text-sm">{message}</p>
      {/* Try again. */}
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}
