/**
 * Staff-facing wording for each kind of error, kept in one place so every screen of a portal
 * speaks the same way (ENGINEERING_STANDARDS.md 5). The raw message of an unknown error is never
 * shown.
 */

// The shared error type.
import type { AppError } from '@conote/core/errors'
// Exhaustiveness helper.
import { assertNever } from '@conote/core/assertNever'

/** The default wording for an error with no access. */
export const DEFAULT_FORBIDDEN =
  "You don't have access to this. Ask an administrator if you need it."

/** Builds a portal's `errorMessage`, with its own wording for "no access". */
export function createErrorMessage(forbidden: string = DEFAULT_FORBIDDEN) {
  /** What happened and what to do next, for each error kind. */
  return function errorMessage(error: AppError): string {
    switch (error.kind) {
      // The request never reached CoNote.
      case 'network':
        return "We couldn't reach CoNote. Check your connection and try again."
      // The session ended.
      case 'unauthorized':
        return 'Your session has ended. Please sign in again.'
      // Signed in, but not allowed.
      case 'forbidden':
        return forbidden
      // Gone or never existed.
      case 'not_found':
        return "We couldn't find that. It may have been moved or deleted."
      // Validation messages are written for people and safe to show as they are.
      case 'validation':
        return error.message
      // Someone else changed it first.
      case 'conflict':
        return 'This changed somewhere else. Reload the page and try again.'
      // SECURITY: never the raw message, which may contain internal details.
      case 'unknown':
        return 'Something went wrong on our side. Please try again.'
      // A new kind must be worded here before the code compiles.
      default:
        return assertNever(error.kind)
    }
  }
}

/** The default wording. A portal with its own "no access" line builds its own. */
export const errorMessage = createErrorMessage()
