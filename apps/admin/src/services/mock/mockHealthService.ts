/**
 * The demo HealthService (admin REQUIREMENTS section 10). Every part reports "operational" unless
 * the demo override in local storage says otherwise, so tests and demos can show each state.
 * The real service will call the `health` Edge Function; nothing here is shown as real.
 */

// Shape checks for the stored override.
import { z } from 'zod'

// The parts of the platform, and the report shape.
import { HEALTH_COMPONENTS, type HealthReport } from '@/types/dashboard'

// The interface implemented here.
import type { HealthService } from '../types'

// Fake network delay.
import { simulateLatency } from './latency'
// The demo data's storage prefix.
import { DEMO_DATA_PREFIX } from './mockAuthService'

/**
 * Where the override lives: JSON such as {"storage":"degraded"}. "unknown" leaves a part out of
 * the report, as a health check that couldn't reach it would.
 */
export const HEALTH_OVERRIDE_KEY = `${DEMO_DATA_PREFIX}health`

/** What a stored override must look like. */
const overrideSchema = z.partialRecord(
  z.enum(HEALTH_COMPONENTS),
  z.enum(['operational', 'degraded', 'unavailable', 'unknown']),
)

/** What the demo service needs. */
interface MockHealthOptions {
  // Where the override is read from.
  demoStore: Storage
  now: () => Date
  latencyMs: number
}

/** The stored override, or none when it is missing or malformed. */
function readOverride(store: Storage) {
  // Nothing stored.
  const raw = store.getItem(HEALTH_OVERRIDE_KEY)
  if (raw === null) return {}
  // SECURITY: storage can be edited by hand, so its contents are checked before use.
  try {
    const parsed = overrideSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : {}
  } catch {
    // Not JSON.
    return {}
  }
}

/** Builds the demo HealthService. */
export function createMockHealthService({
  demoStore,
  now,
  latencyMs,
}: MockHealthOptions): HealthService {
  return {
    async getHealth() {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // Read the override on every check, so a change shows on the next refresh.
      const override = readOverride(demoStore)
      // Each part's state; "unknown" parts are left out of the report.
      const components: HealthReport['components'] = {}
      for (const component of HEALTH_COMPONENTS) {
        const state = override[component] ?? 'operational'
        if (state !== 'unknown') components[component] = state
      }
      // The report, stamped with the time of the check.
      return { checkedAt: now().toISOString(), components }
    },
  }
}
