/**
 * Stands in for a service whose Supabase version is not built yet. Every call fails with a clear
 * message, so a half-connected deploy shows an error where the data should be instead of
 * silently showing demo data (admin REQUIREMENTS section 23, "nothing fake").
 */

// The error type every service throws.
import { AppError } from '@conote/core/errors'

/** Builds a service object whose every method rejects with a "not connected yet" error. */
// T exists only so the caller's service type is the result; the proxy has no use for it.
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function notBuilt<T extends object>(name: string): T {
  return new Proxy({} as T, {
    // Any property read gives a function that fails the way a real call would: asynchronously.
    get: () => () =>
      Promise.reject(new AppError('unknown', `${name} is not connected to the database yet.`)),
  })
}
