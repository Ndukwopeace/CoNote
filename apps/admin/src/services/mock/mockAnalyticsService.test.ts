/**
 * Tests for the demo AnalyticsService: the shared contract, plus the demo's
 * simulated network delay.
 */

// Vitest building blocks.
import { afterEach, describe, expect, it, vi } from 'vitest'

// An empty platform.
import { emptyPlatformData } from '../platformData'
// The shared rules.
import { describeAnalyticsServiceContract } from '../contracts/analyticsService.contract'

// The unit under test.
import { createMockAnalyticsService } from './mockAnalyticsService'

describeAnalyticsServiceContract('mock', (data, now) =>
  createMockAnalyticsService({ data, now: () => now, latencyMs: 0 }),
)

describe('mock Analytics service', () => {
  // Restore the real timers after each test.
  afterEach(() => {
    vi.useRealTimers()
  })

  // Proves the demo waits like a network call, so loading states show in the app.
  it('answers only after the simulated delay', async () => {
    // Arrange: a 300 ms delay on a fake clock.
    vi.useFakeTimers()
    const service = createMockAnalyticsService({
      data: emptyPlatformData(),
      now: () => new Date(),
      latencyMs: 300,
    })
    // Records when the answer arrives.
    let answered = false
    void service.getOverview().then(() => {
      answered = true
    })

    // Act and assert: nothing after 299 ms, the answer at 300.
    await vi.advanceTimersByTimeAsync(299)
    expect(answered).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(answered).toBe(true)
  })
})
