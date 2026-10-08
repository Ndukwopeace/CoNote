/**
 * Tests for the demo AlertService: the shared contract.
 */

// The shared rules.
import { describeAlertServiceContract } from '../contracts/alertService.contract'

// The unit under test.
import { createMockAlertService } from './mockAlertService'

describeAlertServiceContract('mock', (data, now) =>
  createMockAlertService({ data, now: () => now, latencyMs: 0 }),
)
