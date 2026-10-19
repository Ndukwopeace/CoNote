/**
 * Runs the shared ProgrammeService contract against a real Supabase stack, so the Supabase service
 * answers exactly as the demo service does. It is skipped unless VITE_SUPABASE_TEST_* variables
 * point at a stack, so `npm test` never touches the network. CI starts a local stack and runs it as
 * a step of the "Supabase contract tests" job, because loading a platform empties the stack's
 * accounts and courses first. NEVER point it at a hosted project.
 */

// Vitest building blocks.
import { beforeAll, describe } from 'vitest'

// The shared contract every ProgrammeService must meet.
import { describeProgrammeServiceContract } from '../contracts/programmeService.contract'

// The harness that loads a platform and translates IDs.
import { CONFIGURED, Harness } from './integrationSupport'
// The implementation under test.
import { createSupabaseProgrammeService } from './supabaseProgrammeService'

describe.skipIf(!CONFIGURED)('Supabase programme service', () => {
  // Built when the suite starts, because a skipped suite still runs this body once.
  let harness: Harness
  beforeAll(() => {
    harness = new Harness()
  })

  describeProgrammeServiceContract('Supabase', (data, _now, actorId) =>
    harness.wrap(data, actorId, (client) => createSupabaseProgrammeService({ client })),
  )
})
