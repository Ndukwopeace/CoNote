/**
 * Calling an Edge Function and turning its answer back into the error a screen already handles.
 * The functions answer `{ error: { kind, message } }` with an HTTP status for a refusal (see
 * supabase/functions/_shared/http.ts), and a small JSON object for success.
 */

// The client type, and the error the SDK raises for a non-2xx answer.
import { FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

// The error type every service throws.
import { AppError, toAppError } from '@conote/core/errors'

/** What a function answered: the HTTP status and the JSON body. */
export interface FunctionResult {
  status: number
  body: unknown
}

/** Calls the function `name` with `body`. Tests pass their own; the app uses `invokeThrough`. */
export type InvokeFunction = (
  name: string,
  body: Record<string, unknown>,
) => Promise<FunctionResult>

// SECURITY: an answer is not trusted blindly. Only the known kinds become an AppError of that
// kind; anything else is an unknown failure with a generic message.
const refusalSchema = z.object({
  error: z.object({
    kind: z.enum(['unauthorized', 'forbidden', 'validation', 'not_found', 'conflict', 'unknown']),
    message: z.string(),
  }),
})

/** The caller that goes through the Supabase client, which sends the person's own sign-in. */
export function invokeThrough(client: SupabaseClient): InvokeFunction {
  return async (name, body) => {
    const answer = await client.functions.invoke(name, { body })
    const error: unknown = answer.error
    // The SDK types a successful answer as `any`; it is checked by whoever reads it.
    const data: unknown = answer.data
    if (!error) return { status: 200, body: data }
    // A refusal from the function: keep its status and its JSON.
    if (error instanceof FunctionsHttpError) {
      const response = error.context as Response
      const refusal: unknown = await response.json().catch(() => null)
      return { status: response.status, body: refusal }
    }
    // The function could not be reached.
    throw new AppError('network', 'Network request failed', { cause: error })
  }
}

/** The body of a successful answer, or the AppError a refusal stands for. */
export function unwrap(result: FunctionResult): unknown {
  if (result.status >= 200 && result.status < 300) return result.body
  const refusal = refusalSchema.safeParse(result.body)
  if (refusal.success) throw new AppError(refusal.data.error.kind, refusal.data.error.message)
  throw toAppError(new Error(`Function failed with status ${String(result.status)}`))
}
