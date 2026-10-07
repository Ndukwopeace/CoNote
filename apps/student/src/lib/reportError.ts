/**
 * The one place errors are reported. Today it logs in development only; later it can send to an
 * error tracker without changing any code that calls it (ENGINEERING_STANDARDS.md section 5).
 */

/** Any function that accepts log arguments, e.g. console.error. Injected so tests can check it. */
type Logger = (...args: unknown[]) => void

/** The shape of the reporting function: the error plus optional context such as where it happened. */
export type ErrorReporter = (error: unknown, context?: Record<string, unknown>) => void

/**
 * Builds the single error-reporting function (ENGINEERING_STANDARDS.md section 5).
 * Development logs to the console. Production is silent until an error tracker is connected.
 */
export function createErrorReporter({ isDev, log }: { isDev: boolean; log: Logger }) {
  // The function the rest of the app calls.
  const report: ErrorReporter = (error, context) => {
    // SECURITY: log only in development. Production consoles can be read by anyone at the
    // device, and errors may carry student details.
    if (isDev) log('[CoNote]', error, context)
  }
  // Hand the configured reporter back.
  return report
}

// The app-wide reporter, wired to the real console and Vite's development flag.
export const reportError = createErrorReporter({
  // True during `npm run dev` and tests; false in production builds.
  isDev: import.meta.env.DEV,
  // eslint-disable-next-line no-console -- the reporter is the one allowed console sink
  log: console.error,
})
