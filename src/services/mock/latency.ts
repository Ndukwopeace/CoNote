/**
 * Fake network delay for the demo services.
 */

/** Resolves after `ms` milliseconds so the demo shows real loading states. */
export function simulateLatency(ms: number) {
  // Tests pass 0 and resolve straight away; the app waits the given time.
  return ms > 0 ? new Promise<void>((resolve) => setTimeout(resolve, ms)) : Promise.resolve()
}
