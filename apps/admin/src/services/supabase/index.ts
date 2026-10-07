/**
 * The Supabase implementation, built in the shared backend stage. Until then it refuses to start.
 */

// The shared error type.
import { AppError } from '@conote/core/errors'

// The shape the real implementation will return.
import type { Services } from '../types'

/** Placeholder until the backend stage. Fails fast so a misconfigured deploy is obvious. */
export function createSupabaseServices(): Services {
  // Stop immediately with instructions, rather than showing a half-working console.
  throw new AppError(
    'unknown',
    'The Supabase data source is not built yet. Set VITE_DATA_SOURCE=mock.',
  )
}
