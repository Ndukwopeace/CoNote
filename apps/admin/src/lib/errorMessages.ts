/**
 * Administrator-facing wording for each kind of error, kept in one place so every console screen
 * explains problems the same way. (The student app has its own wording for students.)
 */

// Exhaustiveness helper.
import { assertNever } from '@conote/core/assertNever'
// The shared error type.
import type { AppError } from '@conote/core/errors'

/** What happened and what to do next, for each error kind. */
export function errorMessage(error: AppError): string {
  switch (error.kind) {
    // The request never reached CoNote.
    case 'network':
      return "We couldn't reach CoNote. Check your connection and try again."
    // The session ended.
    case 'unauthorized':
      return 'Your session has ended. Please sign in again.'
    // Signed in, but not allowed.
    case 'forbidden':
      return "You don't have access to this. Ask another administrator if you need it."
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
