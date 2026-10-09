/**
 * Tests for the demo TeachingService: the shared contract, plus the demo's simulated delay.
 */

// Vitest building blocks.
import { afterEach, describe, expect, it, vi } from 'vitest'

// The shared rules.
import { describeTeachingServiceContract } from '../contracts/teachingService.contract'
// An empty platform.
import { emptyPlatformData } from '../platformData'

// The unit under test.
import { createMockTeachingService } from './mockTeachingService'

describeTeachingServiceContract('mock', (data, actorId) =>
  createMockTeachingService({ data, actorId: () => actorId, latencyMs: 0 }),
)

describe('mock Teaching service', () => {
  // Restore the real timers after each test.
  afterEach(() => {
    vi.useRealTimers()
  })

  // Proves the demo waits like a network call, so loading states show in the app.
  it('answers only after the simulated delay', async () => {
    // Arrange: a 300 ms delay on a fake clock.
    vi.useFakeTimers()
    const service = createMockTeachingService({
      data: emptyPlatformData(),
      actorId: () => 't1',
      latencyMs: 300,
    })
    // Records when the answer arrives.
    let answered = false
    void service.listMyCourses().then(() => {
      answered = true
    })

    // Act: 299 ms is not enough.
    await vi.advanceTimersByTimeAsync(299)
    expect(answered).toBe(false)
    // Act: 300 ms is.
    await vi.advanceTimersByTimeAsync(1)
    // Assert.
    expect(answered).toBe(true)
  })
})
