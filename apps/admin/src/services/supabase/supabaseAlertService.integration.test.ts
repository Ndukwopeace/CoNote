/**
 * Runs the shared AlertService contract against a real Supabase stack, so the dashboard's alerts
 * are counted exactly as the demo's are. It is skipped unless VITE_SUPABASE_TEST_* variables point
 * at a stack, so `npm test` never touches the network. CI runs it after the other suites, because
 * loading a platform empties the stack's accounts and courses. NEVER point it at a hosted project.
 */

// Vitest building blocks.
import { beforeAll, describe } from 'vitest'

// The shared contract every AlertService must meet.
import { describeAlertServiceContract } from '../contracts/alertService.contract'

// The harness that loads a platform and translates IDs.
import { CONFIGURED, HARNESS_ADMIN, Harness, withAdmin } from './integrationSupport'
// The implementation under test.
import { createSupabaseAlertService } from './supabaseAlertService'

describe.skipIf(!CONFIGURED)('Supabase alert service', () => {
  // Built when the suite starts, because a skipped suite still runs this body once. Every test
  // starts from new accounts, so the problems of one cannot reach the next.
  let harness: Harness
  beforeAll(() => {
    harness = new Harness({ freshAccounts: true })
  })

  describeAlertServiceContract('Supabase', (data, now) =>
    harness.wrap(withAdmin(data), HARNESS_ADMIN.id, (client) =>
      createSupabaseAlertService({ client, now: () => now }),
    ),
  )
})
