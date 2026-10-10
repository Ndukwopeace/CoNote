/**
 * Runs the shared AnalyticsService contract against a real Supabase stack, so the dashboard's
 * counts and chart come out exactly as the demo's do. It is skipped unless VITE_SUPABASE_TEST_*
 * variables point at a stack, so `npm test` never touches the network. CI runs it after the other
 * suites, because loading a platform empties the stack's accounts and courses. NEVER point it at
 * a hosted project.
 */

// Vitest building blocks.
import { beforeAll, describe } from 'vitest'

// The shared contract every AnalyticsService must meet.
import { describeAnalyticsServiceContract } from '../contracts/analyticsService.contract'

// The harness that loads a platform and translates IDs.
import { CONFIGURED, HARNESS_ADMIN, Harness, withAdmin } from './integrationSupport'
// The implementation under test.
import { createSupabaseAnalyticsService } from './supabaseAnalyticsService'

describe.skipIf(!CONFIGURED)('Supabase analytics service', () => {
  // Built when the suite starts, because a skipped suite still runs this body once. Every test
  // starts from new accounts, so the counts of one cannot reach the next.
  let harness: Harness
  beforeAll(() => {
    harness = new Harness({ freshAccounts: true })
  })

  describeAnalyticsServiceContract('Supabase', (data, now) =>
    harness.wrap(withAdmin(data), HARNESS_ADMIN.id, (client) =>
      createSupabaseAnalyticsService({ client, now: () => now }),
    ),
  )
})
