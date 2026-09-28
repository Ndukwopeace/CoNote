/** Resolves after `ms` milliseconds so the demo shows real loading states. */
export function simulateLatency(ms: number) {
  return ms > 0 ? new Promise<void>((resolve) => setTimeout(resolve, ms)) : Promise.resolve()
}
