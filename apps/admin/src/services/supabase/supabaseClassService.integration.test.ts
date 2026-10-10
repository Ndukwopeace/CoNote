/**
 * Runs the shared ClassService contract against a real Supabase stack, so the Supabase service
 * answers exactly as the demo service does. It is skipped unless VITE_SUPABASE_TEST_* variables
 * point at a stack, so `npm test` never touches the network. CI starts a local stack and runs it
 * after the other suites, because loading a platform empties the stack's accounts and courses.
 * NEVER point it at a hosted project.
 */

// Vitest building blocks.
import { beforeAll, describe } from 'vitest'

// The shared contract every ClassService must meet.
import { describeClassServiceContract } from '../contracts/classService.contract'

// The harness that loads a platform and translates IDs.
import { CONFIGURED, Harness } from './integrationSupport'
// The implementation under test.
import { createSupabaseClassService } from './supabaseClassService'

describe.skipIf(!CONFIGURED)('Supabase class service', () => {
  // Built when the suite starts, because a skipped suite still runs this body once.
  let harness: Harness
  beforeAll(() => {
    harness = new Harness()
  })

  describeClassServiceContract('Supabase', (data, now, actorId) =>
    harness.wrap(data, actorId, (client) => createSupabaseClassService({ client, now: () => now })),
  )
})
