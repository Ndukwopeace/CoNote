/**
 * Wraps a service call for use as a TanStack Query function.
 */

// Converts anything thrown into an AppError.
import { toAppError } from '@/lib/errors'

/**
 * Runs `load` and turns any failure into an AppError, which is the error type the query cache
 * promises pages (see types/react-query.d.ts).
 */
export async function appQuery<T>(load: () => Promise<T>): Promise<T> {
  try {
    // The service's answer, unchanged.
    return await load()
  } catch (error) {
    // SECURITY: raw errors may carry internal details; the AppError keeps them in `cause` only.
    throw toAppError(error)
  }
}
