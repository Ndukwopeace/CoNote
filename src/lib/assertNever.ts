/** Makes a switch exhaustive: adding a new union member fails the type check here. */
export function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${String(value)}`)
}
