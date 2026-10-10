/**
 * Reads rows from a finished Supabase query and checks their shape. Every student table service
 * reads through here, so a refusal always becomes an AppError and a row of the wrong shape never
 * reaches a screen.
 */

// Checks each row's shape.
import type { z } from 'zod'

// Turns database failures into the app's error type.
import { fromSupabaseError } from './errors'

/** What a finished query answers with. */
interface Answer {
  data: unknown
  error: unknown
}

/** Checks `value` against `schema`, turning a mismatch into an AppError. */
function check<T>(schema: z.ZodType<T>, value: unknown): T {
  // SECURITY: rows are not trusted blindly. An unknown status or a missing field is a server
  // problem; it is refused here instead of reaching a screen.
  const parsed = schema.safeParse(value)
  if (!parsed.success) {
    // The message is generic; the details stay in `cause` for the error report.
    throw fromSupabaseError({ message: 'Malformed row', cause: parsed.error })
  }
  return parsed.data
}

/** Waits for a query that returns many rows. A refusal throws an AppError. */
export async function readRows<T>(query: PromiseLike<Answer>, schema: z.ZodType<T>): Promise<T[]> {
  const { data, error } = await query
  // A refused or failed query becomes an AppError (forbidden, network, ...).
  if (error) throw fromSupabaseError(error)
  // No rows can arrive as null.
  if (data === null) return []
  // Check every row.
  return check(schema.array(), data)
}

/** Waits for a query that returns at most one row (`maybeSingle`); null when there is none. */
export async function readOne<T>(
  query: PromiseLike<Answer>,
  schema: z.ZodType<T>,
): Promise<T | null> {
  const { data, error } = await query
  if (error) throw fromSupabaseError(error)
  // No row is not an error here; the caller decides what "none" means.
  if (data === null) return null
  return check(schema, data)
}
