/**
 * health: an administrator asks how the platform is doing (admin REQUIREMENTS section 10). The
 * function really tries the database, sign-in and file storage, and says what each did. The parts
 * that are not built yet (the AI service, notifications) are left out of the report, which the
 * console shows as "unknown": nothing here is made up.
 */

// Checks the body.
import { z } from 'zod'

// The shared steps and answers.
import { adminHandler, type FunctionDeps } from './admin.ts'
import { json } from './http.ts'

/** How a part is doing. */
export type HealthState = 'operational' | 'degraded' | 'unavailable'

/** A part that answers slower than this is "degraded". */
const SLOW_MS = 1500

/** A part that has not answered after this long is "unavailable". */
const TIMEOUT_MS = 5000

/** What a check returns: the failure, if there was one. */
interface CheckResult {
  error: unknown
}

/** Runs `check` and says how the part did: refused or too slow is worse than slow. */
async function measure(check: () => PromiseLike<CheckResult>): Promise<HealthState> {
  // When the check started.
  const started = performance.now()
  // The check, or a timeout, whichever comes first. A check that throws counts as a failure.
  const result = await Promise.race([
    Promise.resolve(check()).catch((error: unknown): CheckResult => ({ error })),
    new Promise<CheckResult>((resolve) => {
      setTimeout(() => {
        resolve({ error: new Error('timeout') })
      }, TIMEOUT_MS)
    }),
  ])
  if (result.error) return 'unavailable'
  return performance.now() - started > SLOW_MS ? 'degraded' : 'operational'
}

/** The body: nothing to send. */
const bodySchema = z.object({})

/** Builds the handler. */
export function healthHandler(deps: FunctionDeps) {
  return adminHandler(deps, bodySchema, async () => {
    const { service } = deps.clients
    // The three parts that exist, checked together.
    const [database, authentication, storage] = await Promise.all([
      measure(() => service.from('platform_settings').select('id').limit(1)),
      measure(() => service.auth.admin.listUsers({ page: 1, perPage: 1 })),
      measure(() => service.storage.listBuckets()),
    ])
    return json({
      checkedAt: deps.now().toISOString(),
      components: { database, authentication, storage },
    })
  })
}
