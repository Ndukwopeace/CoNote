/**
 * When a failed data request is tried again (ENGINEERING_STANDARDS.md section 8).
 */

// Converts anything thrown into an AppError, so the kind can be read.
import { toAppError, type AppErrorKind } from '@conote/core/errors'

/** Failures that give the same answer on a second try, so retrying only delays the message. */
const FINAL_KINDS: ReadonlySet<AppErrorKind> = new Set([
  'not_found',
  'forbidden',
  'unauthorized',
  'validation',
  'conflict',
])

/**
 * True when TanStack Query should try again. `failureCount` is how many attempts have already
 * failed after the first (0 on the first failure). Passing problems get one retry.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  // A final answer is shown straight away.
  if (FINAL_KINDS.has(toAppError(error).kind)) return false
  // Anything else gets a single retry.
  return failureCount < 1
}
