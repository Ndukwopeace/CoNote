/**
 * Runs the shared HealthService contract against a real Supabase stack, with the `health`
 * function's handler run in-process (the Deno runtime is not part of the CI stack). It is skipped
 * unless VITE_SUPABASE_TEST_* variables point at a stack, so `npm test` never touches the network.
 * NEVER point it at a hosted project.
 */

// Vitest building blocks.
import { beforeAll, describe } from 'vitest'

// Runs the Edge Functions' handlers in-process.
import { createFunctionBridge } from '@conote/testing/functionsBridge'

// The shared contract every HealthService must meet.
import { describeHealthServiceContract } from '../contracts/healthService.contract'

// The platform with only the administrator.
import { emptyPlatformData } from '../platformData'
// The harness that loads a platform and translates IDs.
import {
  ANON_KEY,
  CONFIGURED,
  HARNESS_ADMIN,
  Harness,
  SERVICE_KEY,
  URL,
  withAdmin,
} from './integrationSupport'
// The implementation under test.
import { createSupabaseHealthService } from './supabaseHealthService'

describe.skipIf(!CONFIGURED)('Supabase health service', () => {
  // Built when the suite starts, because a skipped suite still runs this body once.
  let harness: Harness
  beforeAll(() => {
    harness = new Harness({ freshAccounts: true })
  })

  describeHealthServiceContract('Supabase', () =>
    harness.wrap(withAdmin(emptyPlatformData()), HARNESS_ADMIN.id, (client) =>
      createSupabaseHealthService({
        client,
        invoke: createFunctionBridge({
          url: URL ?? '',
          anonKey: ANON_KEY ?? '',
          serviceKey: SERVICE_KEY ?? '',
          now: () => new Date(),
          token: async () => (await client.auth.getSession()).data.session?.access_token ?? null,
        }),
      }),
    ),
  )
})
