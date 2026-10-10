/**
 * The admin HealthService on Supabase (milestone B2.8, D87): the platform's health, from the
 * `health` Edge Function, which really tries the database, sign-in and file storage. Parts the
 * function leaves out (the AI service and notifications, until they exist) show as "unknown".
 */

// The client type, and zod to check what comes back.
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

// The error type every service throws.
import { AppError } from '@conote/core/errors'

// The parts of the platform the report may name.
import { HEALTH_COMPONENTS } from '@/types/dashboard'

// The interface this implementation must satisfy.
import type { HealthService } from '../types'

// Calling the Edge Functions.
import { invokeThrough, unwrap, type InvokeFunction } from './functionCall'

// SECURITY: the report is checked on arrival: only known parts and known states get through.
const reportSchema = z.object({
  checkedAt: z.string(),
  components: z.partialRecord(
    z.enum(HEALTH_COMPONENTS),
    z.enum(['operational', 'degraded', 'unavailable', 'unknown']),
  ),
})

/** What the service needs. */
interface SupabaseHealthOptions {
  // The one client the console uses.
  client: SupabaseClient
  // How a function is called. Tests pass their own; the app goes through the client.
  invoke?: InvokeFunction
}

/** Builds the Supabase HealthService. */
export function createSupabaseHealthService({
  client,
  invoke = invokeThrough(client),
}: SupabaseHealthOptions): HealthService {
  return {
    async getHealth() {
      // The function checks the caller, tries each part and answers.
      const report = reportSchema.safeParse(unwrap(await invoke('health', {})))
      if (!report.success)
        throw new AppError('unknown', 'Unexpected error', { cause: report.error })
      return report.data
    },
  }
}
