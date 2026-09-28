type Logger = (...args: unknown[]) => void

export type ErrorReporter = (error: unknown, context?: Record<string, unknown>) => void

/**
 * Builds the single error-reporting function (ENGINEERING_STANDARDS.md section 5).
 * Development logs to the console. Production is silent until an error tracker is connected.
 */
export function createErrorReporter({ isDev, log }: { isDev: boolean; log: Logger }) {
  const report: ErrorReporter = (error, context) => {
    if (isDev) log('[CoNote]', error, context)
  }
  return report
}

export const reportError = createErrorReporter({
  isDev: import.meta.env.DEV,
  // eslint-disable-next-line no-console -- the reporter is the one allowed console sink
  log: console.error,
})
