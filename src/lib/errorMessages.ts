import { assertNever } from './assertNever'
import type { AppError } from './errors'

/** Student-facing wording for each error kind: what happened and what to do next. */
export function errorMessage(error: AppError): string {
  switch (error.kind) {
    case 'network':
      return "We couldn't reach CoNote. Check your connection and try again."
    case 'unauthorized':
      return 'Your session has ended. Please sign in again.'
    case 'forbidden':
      return "You don't have access to this. If you think you should, ask your teacher."
    case 'not_found':
      return "We couldn't find that. It may have been moved or deleted."
    case 'validation':
      return error.message
    case 'conflict':
      return 'This changed somewhere else. Reload the page and try again.'
    case 'unknown':
      return 'Something went wrong on our side. Please try again.'
    default:
      return assertNever(error.kind)
  }
}
