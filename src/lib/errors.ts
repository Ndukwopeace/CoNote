export type AppErrorKind =
  'network' | 'unauthorized' | 'forbidden' | 'not_found' | 'validation' | 'conflict' | 'unknown'

/** The only error type services throw (ENGINEERING_STANDARDS.md section 5). */
export class AppError extends Error {
  readonly kind: AppErrorKind

  constructor(kind: AppErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'AppError'
    this.kind = kind
  }
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
    return new AppError('network', 'Network request failed', { cause: error })
  }
  return new AppError('unknown', 'Unexpected error', { cause: error })
}
