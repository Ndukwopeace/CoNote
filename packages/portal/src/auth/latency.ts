/**
 * Fake network delay for the demo services.
 */

/** Resolves after `ms` milliseconds, so the demo shows real loading states. */
export function simulateLatency(ms: number) {
  // No timer at all when there is no delay, which keeps tests fast.
  return ms > 0 ? new Promise<void>((resolve) => setTimeout(resolve, ms)) : Promise.resolve()
}
