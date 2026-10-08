/**
 * What a data view shows when it failed to load: "Unable to load {thing}." and a "Try again"
 * button (admin REQUIREMENTS section 22). The raw error is never shown; the query cache has
 * already reported it.
 */

// The shared failure panel.
import { ErrorPanel } from '@conote/ui/common/ErrorPanel'

/** What failed, and how to try again. */
interface ErrorStateProps {
  // What was being loaded, e.g. "alerts".
  thing: string
  // Loads again.
  onRetry: () => void
}

/** The console's load-failure panel. */
export function ErrorState({ thing, onRetry }: Readonly<ErrorStateProps>) {
  // SECURITY: fixed wording, so internal details in the raw error never reach the screen.
  return <ErrorPanel message={`Unable to load ${thing}.`} onRetry={onRetry} />
}
