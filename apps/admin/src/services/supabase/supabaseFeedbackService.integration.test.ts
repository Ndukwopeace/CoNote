/**
 * Runs the shared AdminFeedbackService contract against a real Supabase stack, so feedback is sent,
 * listed and sorted exactly as the demo does it. Skipped unless VITE_SUPABASE_TEST_* variables point
 * at a stack. NEVER point it at a hosted project.
 */

// Vitest building blocks.
import { beforeAll, describe } from 'vitest'

// The shared contract every AdminFeedbackService must meet.
import { describeFeedbackServiceContract } from '../contracts/feedbackService.contract'
// The records a test starts from.
import { emptyPlatformData } from '../platformData'

// The harness that loads a platform and translates IDs.
import { CONFIGURED, HARNESS_ADMIN, Harness, withAdmin } from './integrationSupport'
// The implementation under test.
import { createSupabaseAdminFeedbackService } from './supabaseFeedbackService'

describe.skipIf(!CONFIGURED)('Supabase feedback service', () => {
  // Built when the suite starts, because a skipped suite still runs this body once.
  let harness: Harness
  beforeAll(() => {
    harness = new Harness({ freshAccounts: true })
  })

  describeFeedbackServiceContract(
    'Supabase',
    (data) =>
      harness.wrap(withAdmin(data), HARNESS_ADMIN.id, (client) =>
        createSupabaseAdminFeedbackService({ client }),
      ),
    () => emptyPlatformData(),
  )
})
