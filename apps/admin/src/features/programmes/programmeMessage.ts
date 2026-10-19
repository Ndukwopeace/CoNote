/**
 * The words for a programme change that went wrong (D106): a refusal the service wrote for people
 * ("This request has already been decided.") is shown as it is; anything else gets the console's
 * standard wording.
 */

// Normalises anything thrown into an AppError.
import { toAppError } from '@conote/core/errors'
// Administrator-facing wording for each error kind.
import { errorMessage } from '@/lib/errorMessages'

/**
 * What to tell the administrator.
 * SECURITY: an unknown error's raw message is never shown (errorMessage).
 */
export function programmeMessage(error: unknown): string {
  const appError = toAppError(error)
  const own =
    appError.kind === 'validation' || appError.kind === 'conflict' || appError.kind === 'not_found'
  return own ? appError.message : errorMessage(appError)
}
