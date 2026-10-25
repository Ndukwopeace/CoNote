/**
 * A failed save or publish, said in words (teacher REQUIREMENTS section 9). A draft that changed
 * under the teacher offers Reload; any other failure shows the portal's standard wording. Used by
 * the reading view and the form, so both word a conflict the same way.
 */

// The shared error type.
import type { AppError } from '@conote/core/errors'
// Standard wording for failures.
import { errorMessage } from '@conote/portal'
// Buttons and the message box.
import { Button } from '@conote/ui/button'
import { FormMessage } from '@conote/ui/forms/FormMessage'

/** The message for a draft that changed under the teacher. */
export const STALE_MESSAGE = 'This draft changed. Reload to see the latest.'

/** The failure, with Reload when the draft changed. `onReload` is asked to load the latest. */
export function DraftProblem({
  problem,
  onReload,
}: Readonly<{ problem: AppError; onReload: () => void }>) {
  return (
    <FormMessage tone="error">
      {problem.kind === 'conflict' ? (
        <span className="flex flex-wrap items-center gap-3">
          {STALE_MESSAGE}
          <Button type="button" variant="outline" size="sm" onClick={onReload}>
            Reload
          </Button>
        </span>
      ) : (
        errorMessage(problem)
      )}
    </FormMessage>
  )
}
