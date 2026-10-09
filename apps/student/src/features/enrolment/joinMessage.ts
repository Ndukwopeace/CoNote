/**
 * The words for a request to join that went wrong.
 */

// Normalises anything thrown into an AppError.
import { toAppError } from '@conote/core/errors'
// Student-facing wording for each error kind.
import { errorMessage } from '@/lib/errorMessages'

/**
 * What to tell the student. A refused request (validation or conflict) says why in the service's
 * own words, which are written for people; anything else gets the standard wording.
 * SECURITY: an unknown error's raw message is never shown (errorMessage).
 */
export function joinMessage(error: unknown): string {
  const appError = toAppError(error)
  return appError.kind === 'validation' || appError.kind === 'conflict'
    ? appError.message
    : errorMessage(appError)
}
