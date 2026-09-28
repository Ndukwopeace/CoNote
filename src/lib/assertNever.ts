/**
 * Helper for exhaustive switch statements.
 */

/** Makes a switch exhaustive: adding a new union member fails the type check here. */
export function assertNever(value: never): never {
  // Only reachable if the types were bypassed; fail loudly instead of continuing silently.
  throw new Error(`Unhandled value: ${String(value)}`)
}
