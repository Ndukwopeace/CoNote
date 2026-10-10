/**
 * The admin AlertService on Supabase (milestone B2.8, D87): the problems worth an administrator's
 * attention, counted by a database function that checks the caller. Only kinds with something to
 * report are returned, most urgent first.
 */

// The client type, and zod to check what comes back.
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

// Reads and checks rows.
import { readRows } from '@conote/supabase/rows'

// The alert kinds, in display order.
import { ALERT_KINDS, type PlatformAlert } from '@/types/dashboard'

// The interface this implementation must satisfy.
import type { AlertService } from '../types'

// SECURITY: each shape is checked on arrival, so a kind the app does not know is refused.
const alertRow = z.object({
  kind: z.enum(ALERT_KINDS),
  count: z.number(),
  days: z.number().nullable(),
})

/** What the service needs. */
interface SupabaseAlertOptions {
  // The one client the console uses.
  client: SupabaseClient
  // The clock: the moment failures are measured back from. Tests set it; the app uses the real one.
  now?: () => Date
}

/** Builds the Supabase AlertService. */
export function createSupabaseAlertService({
  client,
  now = () => new Date(),
}: SupabaseAlertOptions): AlertService {
  return {
    async listAlerts() {
      // Every kind with its count.
      const rows = await readRows(
        client.rpc('admin_alerts', { p_now: now().toISOString() }),
        alertRow,
      )
      // Only the kinds with something to report, most urgent first.
      return ALERT_KINDS.flatMap((kind): PlatformAlert[] => {
        const row = rows.find((candidate) => candidate.kind === kind)
        if (!row || row.count <= 0) return []
        // Waiting summaries carry the limit from Settings that they passed.
        return row.days === null
          ? [{ kind, count: row.count }]
          : [{ kind, count: row.count, days: row.days }]
      })
    },
  }
}
