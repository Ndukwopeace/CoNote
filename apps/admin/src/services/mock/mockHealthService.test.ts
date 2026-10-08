/**
 * Tests for the demo HealthService: the shared contract, plus the demo's override, which lets
 * tests and demos set each part's state (admin REQUIREMENTS section 10).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The shared rules.
import { describeHealthServiceContract } from '../contracts/healthService.contract'

// The unit under test.
import { createMockHealthService, HEALTH_OVERRIDE_KEY } from './mockHealthService'

/** The contract's clock. */
const NOW = new Date('2026-10-08T12:00:00Z')

/** A demo service over local storage, with no delay. */
function createService() {
  return createMockHealthService({
    demoStore: window.localStorage,
    now: () => NOW,
    latencyMs: 0,
  })
}

describeHealthServiceContract('mock', createService)

describe('mock HealthService', () => {
  // Proves every part reports operational until told otherwise.
  it('reports every part operational by default', async () => {
    // Act.
    const report = await createService().getHealth()

    // Assert.
    expect(report).toEqual({
      checkedAt: NOW.toISOString(),
      components: {
        database: 'operational',
        authentication: 'operational',
        ai_service: 'operational',
        storage: 'operational',
        notifications: 'operational',
      },
    })
  })

  // Proves the stored override changes states, and "unknown" leaves a part out of the report.
  it('applies the stored override', async () => {
    // Arrange.
    window.localStorage.setItem(
      HEALTH_OVERRIDE_KEY,
      JSON.stringify({ ai_service: 'degraded', storage: 'unavailable', notifications: 'unknown' }),
    )

    // Act.
    const { components } = await createService().getHealth()

    // Assert.
    expect(components).toEqual({
      database: 'operational',
      authentication: 'operational',
      ai_service: 'degraded',
      storage: 'unavailable',
    })
  })

  // Proves a malformed override is ignored rather than breaking the dashboard.
  it.each(['not json', JSON.stringify({ database: 'on fire' }), JSON.stringify(['degraded'])])(
    'ignores a malformed override: %s',
    async (stored) => {
      // Arrange.
      window.localStorage.setItem(HEALTH_OVERRIDE_KEY, stored)

      // Act.
      const { components } = await createService().getHealth()

      // Assert: the defaults.
      expect(components.database).toBe('operational')
    },
  )
})
