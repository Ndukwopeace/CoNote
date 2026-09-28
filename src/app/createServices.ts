import { assertNever } from '@/lib/assertNever'
import type { AppEnv } from '@/lib/env'
import { createMockServices } from '@/services/mock'
import { createSupabaseServices } from '@/services/supabase'
import type { Services } from '@/services/types'

/** The factory that picks the data source. The only file allowed to import implementations. */
export function createServices(env: AppEnv): Services {
  switch (env.dataSource) {
    case 'mock':
      return createMockServices()
    case 'supabase':
      return createSupabaseServices()
    default:
      return assertNever(env)
  }
}
