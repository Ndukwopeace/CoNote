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
// Service types.
import type { Services } from '@/services/types'

/**
 * The services for `env.dataSource`. Asynchronous because the Supabase code is loaded only when
 * that data source is chosen, so the demo does not download a library it never uses.
 */
export async function createServices(env: AppEnv): Promise<Services> {
  switch (env.dataSource) {
    // Seeded demo data.
    case 'mock':
      return createMockServices()
    // The shared backend.
    case 'supabase': {
      // Loaded on demand: the Supabase library is large.
      const { createSupabaseServices } = await import('@/services/supabase')
      return createSupabaseServices(env)
    }
    // A new data source must be handled here before the code compiles.
    default:
      return assertNever(env)
  }
}
