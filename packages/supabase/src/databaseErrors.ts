/**
 * Reads the code and message of a refused database call, whether it is still the raw answer or
 * has already become an AppError (which keeps the raw answer as its cause). The services use them
 * to give a form a specific message for a rule the database held.
 */

// The error type every service throws.
import { AppError } from '@conote/core/errors'

/** True for a plain object, so its fields can be read safely. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** The raw answer inside `error`. */
function raw(error: unknown): unknown {
  return error instanceof AppError ? error.cause : error
}

/** The Postgres or PostgREST code, such as "23505", or undefined when there is none. */
export function databaseCode(error: unknown): string | undefined {
  const inner = raw(error)
  return isRecord(inner) && typeof inner.code === 'string' ? inner.code : undefined
}

/** The message the database raised, such as "course archived", or "" when there is none. */
export function databaseMessage(error: unknown): string {
  const inner = raw(error)
  return isRecord(inner) && typeof inner.message === 'string' ? inner.message : ''
}
