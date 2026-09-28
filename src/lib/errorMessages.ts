/**
 * Student-facing wording for each kind of error. Kept in one place so every screen explains
 * problems the same way.
 */

// Makes the switch below fail the type check if a new error kind is added without wording.
import { assertNever } from './assertNever'
// The error type whose `kind` decides the message.
import type { AppError } from './errors'

/** Student-facing wording for each error kind: what happened and what to do next. */
export function errorMessage(error: AppError): string {
  // Pick the wording by kind.
  switch (error.kind) {
    // Connection problem: tell the student what to check.
    case 'network':
      return "We couldn't reach CoNote. Check your connection and try again."
    // Session gone: tell them to sign in.
    case 'unauthorized':
      return 'Your session has ended. Please sign in again.'
    // No permission: point them to their teacher.
    case 'forbidden':
      return "You don't have access to this. If you think you should, ask your teacher."
    // Missing item: suggest why.
    case 'not_found':
      return "We couldn't find that. It may have been moved or deleted."
    // Validation messages are written for students by the service, so they are shown as-is.
    case 'validation':
      return error.message
    // Edited elsewhere: reloading shows the latest version.
    case 'conflict':
      return 'This changed somewhere else. Reload the page and try again.'
    // SECURITY: unexpected errors never show their raw message, which could leak internal
    // details; the student gets a generic line instead.
    case 'unknown':
      return 'Something went wrong on our side. Please try again.'
    // Unreachable today; stops the build if a new kind is added without a message.
    default:
      return assertNever(error.kind)
  }
}
