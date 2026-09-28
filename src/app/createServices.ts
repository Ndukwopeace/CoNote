/**
 * The service factory: the single place that decides which data source the app uses.
 */

// Makes the switch exhaustive; a new data source can't be forgotten here.
import { assertNever } from '@/lib/assertNever'
// The checked environment type.
import type { AppEnv } from '@/lib/env'
// The demo implementation.
import { createMockServices } from '@/services/mock'
// The Supabase implementation (placeholder until the backend stage).
import { createSupabaseServices } from '@/services/supabase'
// The shape both implementations return.
import type { Services } from '@/services/types'

/** The factory that picks the data source. The only file allowed to import implementations. */
export function createServices(env: AppEnv): Services {
  // Choose by the configured data source.
  switch (env.dataSource) {
    // Demo data in the browser.
    case 'mock':
      return createMockServices()
    // The real backend.
    case 'supabase':
      return createSupabaseServices()
    // Unreachable today; fails the build if a new data source is added without a case.
    default:
      return assertNever(env)
  }
}
