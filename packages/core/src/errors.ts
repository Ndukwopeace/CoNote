/**
 * CoNote's single error type. Services turn every failure into an AppError, so screens only
 * handle a short, known list of cases (ENGINEERING_STANDARDS.md section 5).
 */

/** The kinds of failure the UI knows how to explain. */
export type AppErrorKind =
  // No connection, or the server could not be reached.
  | 'network'
  // The session has expired or never existed.
  | 'unauthorized'
  // Signed in, but not allowed to see this.
  | 'forbidden'
  // The course, class, note or summary does not exist.
  | 'not_found'
  // The input was rejected; the message is safe to show as-is.
  | 'validation'
  // Someone else changed the same thing first.
  | 'conflict'
  // Anything unexpected.
  | 'unknown'

/** The only error type services throw (ENGINEERING_STANDARDS.md section 5). */
export class AppError extends Error {
  // Which of the known cases this is; the UI chooses its wording from this.
  readonly kind: AppErrorKind

  // `cause` keeps the original error for debugging without showing it to users.
  constructor(kind: AppErrorKind, message: string, options?: { cause?: unknown }) {
    // Let the built-in Error store the message and cause.
    super(message, options)
    // A clear name in stack traces and logs.
    this.name = 'AppError'
    // Remember the kind.
    this.kind = kind
  }
}

/**
 * Converts anything that was thrown into an AppError.
 * SECURITY: raw errors can contain internal details (stack traces, SQL, server paths). Wrapping
 * them means only a safe, generic message can reach the screen, while `cause` keeps the detail
 * for developers.
 */
export function toAppError(error: unknown): AppError {
  // Already an AppError: pass it through untouched.
  if (error instanceof AppError) return error
  // Browsers report a failed fetch as a TypeError mentioning "fetch" or "network".
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
    // Treat it as a connection problem so the user is told to check their connection.
    return new AppError('network', 'Network request failed', { cause: error })
  }
  // Everything else is "unknown", with a generic message.
  return new AppError('unknown', 'Unexpected error', { cause: error })
}
