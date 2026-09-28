import { AppError } from '@/lib/errors'

import type { Services } from '../types'

/** Placeholder until the backend stage. Fails fast so a misconfigured deploy is obvious. */
export function createSupabaseServices(): Services {
  throw new AppError(
    'unknown',
    'The Supabase data source is not built yet. Set VITE_DATA_SOURCE=mock.',
  )
}
