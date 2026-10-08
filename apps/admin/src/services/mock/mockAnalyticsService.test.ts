/**
 * Tests for the demo AnalyticsService: the shared contract.
 */

// The shared rules.
import { describeAnalyticsServiceContract } from '../contracts/analyticsService.contract'

// The unit under test.
import { createMockAnalyticsService } from './mockAnalyticsService'

describeAnalyticsServiceContract('mock', (data, now) =>
  createMockAnalyticsService({ data, now: () => now, latencyMs: 0 }),
)
