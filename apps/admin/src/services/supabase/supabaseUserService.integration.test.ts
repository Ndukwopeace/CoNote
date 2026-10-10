/**
 * Runs the shared UserService contract against a real Supabase stack, with the Edge Functions'
 * handlers run in-process (the Deno runtime is not part of the CI stack), so the Supabase service
 * answers exactly as the demo service does and the functions' logic meets real Auth and a real
 * database. It is skipped unless VITE_SUPABASE_TEST_* variables point at a stack, so `npm test`
 * never touches the network. CI runs it after the other suites, because loading a platform empties
 * the stack's accounts and courses. NEVER point it at a hosted project.
 */

// Vitest building blocks.
import { beforeAll, describe } from 'vitest'

// Runs the Edge Functions' handlers in-process.
import { createFunctionBridge } from '@conote/testing/functionsBridge'

// The shared contract every UserService must meet.
import { describeUserServiceContract } from '../contracts/userService.contract'

// The harness that loads a platform and translates IDs.
import { ANON_KEY, CONFIGURED, Harness, SERVICE_KEY, URL } from './integrationSupport'
// The implementation under test.
import { createSupabaseUserService } from './supabaseUserService'

describe.skipIf(!CONFIGURED)('Supabase user service', () => {
  // Built when the suite starts, because a skipped suite still runs this body once. Every test
  // starts from new accounts, so what one does to an account cannot reach the next.
  let harness: Harness
  beforeAll(() => {
    harness = new Harness({ freshAccounts: true })
  })

  describeUserServiceContract('Supabase', (data, now, actorId) =>
    harness.wrap(data, actorId, (client) =>
      createSupabaseUserService({
        client,
        // The functions run with the administrator's own token, as the console would send it.
        invoke: createFunctionBridge({
          url: URL ?? '',
          anonKey: ANON_KEY ?? '',
          serviceKey: SERVICE_KEY ?? '',
          now: () => now,
          token: async () => (await client.auth.getSession()).data.session?.access_token ?? null,
        }),
      }),
    ),
  )
})
