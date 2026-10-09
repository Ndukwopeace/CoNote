/**
 * Picks the service implementation for the configured data source. The only module allowed to
 * import service implementations (ENGINEERING_STANDARDS.md 3.1).
 */

// Exhaustiveness helper.
import { assertNever } from '@conote/core/assertNever'

// The configuration type.
import type { AppEnv } from '@/lib/env'
// The demo implementation.
import { createMockServices } from '@/services/mock'
// The Supabase implementation (a placeholder until the backend stage).
import { createSupabaseServices } from '@/services/supabase'
// Service types.
import type { Services } from '@/services/types'

/** The services for `env.dataSource`. */
export function createServices(env: AppEnv): Services {
  switch (env.dataSource) {
    // Seeded demo data.
    case 'mock':
      return createMockServices()
    // The shared backend.
    case 'supabase':
      return createSupabaseServices()
    // A new data source must be handled here before the code compiles.
    default:
      return assertNever(env)
  }
}
