/**
 * The rules every HealthService must follow (ENGINEERING_STANDARDS.md 2.5), run against each
 * implementation.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The parts of the platform a report may name.
import { HEALTH_COMPONENTS } from '@/types/dashboard'

// The interface under test.
import type { HealthService } from '../types'

/** The states a report may use. "unknown" is the page's word for a part left out. */
const REPORTED_STATES = ['operational', 'degraded', 'unavailable']

/** Registers the HealthService contract suite under `name`. */
export function describeHealthServiceContract(name: string, create: () => HealthService) {
  describe(`HealthService contract: ${name}`, () => {
    // Proves the report says when it was taken.
    it('stamps the report with the time of the check', async () => {
      // Act.
      const report = await create().getHealth()

      // Assert: a real date.
      expect(Number.isNaN(Date.parse(report.checkedAt))).toBe(false)
    })

    // Proves the report only names known parts and known states.
    it('reports only known parts and states', async () => {
      // Act.
      const report = await create().getHealth()

      // Assert.
      for (const [component, state] of Object.entries(report.components)) {
        expect(HEALTH_COMPONENTS).toContain(component)
        expect(REPORTED_STATES).toContain(state)
      }
    })
  })
}
