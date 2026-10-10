/**
 * Tests for the health function: that it really tries each part, and what it says when one fails,
 * is slow, or is not reported.
 */

// Vitest building blocks.
import { afterEach, describe, expect, it, vi } from 'vitest'

// The unit under test.
import { healthHandler } from './health.ts'
import { NOW, bodyOf, post, route, setupFunction } from '../testSupport.ts'

/** A handler over a platform where every part answers, unless the test says otherwise. */
function build(routes = {}) {
  const made = setupFunction({
    answer: route({ 'platform_settings:select': { data: [], error: null }, ...routes }),
  })
  return { ...made, handler: healthHandler(made.deps) }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('health', () => {
  // Proves a healthy platform reports the three parts that exist, stamped with the time.
  it('reports the parts it can check, and leaves out the ones that do not exist yet', async () => {
    const { handler } = build()
    const response = await handler(post({}))
    expect(response.status).toBe(200)
    await expect(bodyOf(response)).resolves.toEqual({
      checkedAt: NOW.toISOString(),
      components: {
        database: 'operational',
        authentication: 'operational',
        storage: 'operational',
      },
    })
  })

  // Proves a part that refuses is reported unavailable, and the others are unaffected.
  it('reports a part that fails as unavailable', async () => {
    const { handler, listBuckets } = build({
      'platform_settings:select': { data: null, error: { code: 'XX000' } },
    })
    listBuckets.mockResolvedValueOnce({ data: null, error: { message: 'down' } })
    await expect(bodyOf(await handler(post({})))).resolves.toMatchObject({
      components: {
        database: 'unavailable',
        authentication: 'operational',
        storage: 'unavailable',
      },
    })
  })

  // Proves a part that throws counts as unavailable too.
  it('reports a part that throws as unavailable', async () => {
    const { handler, listUsers } = build()
    listUsers.mockRejectedValueOnce(new Error('boom'))
    await expect(bodyOf(await handler(post({})))).resolves.toMatchObject({
      components: { authentication: 'unavailable' },
    })
  })

  // Proves a slow answer is "degraded", and no answer at all is "unavailable".
  it('reports a slow part as degraded and a silent one as unavailable', async () => {
    vi.useFakeTimers()
    const { handler, listUsers, listBuckets } = build()
    listUsers.mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(() => {
            resolve({ data: {}, error: null })
          }, 2000),
        ),
    )
    listBuckets.mockImplementationOnce(() => new Promise(() => undefined))
    const pending = handler(post({}))
    await vi.advanceTimersByTimeAsync(6000)
    await expect(bodyOf(await pending)).resolves.toMatchObject({
      components: { database: 'operational', authentication: 'degraded', storage: 'unavailable' },
    })
  })

  // SECURITY: proves only an active administrator may ask.
  it('turns away anyone who is not an active administrator', async () => {
    const made = setupFunction({
      answer: route({}, { data: { role: 'teacher', status: 'active' }, error: null }),
    })
    expect((await healthHandler(made.deps)(post({}))).status).toBe(403)
  })
})
