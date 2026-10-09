/**
 * Tests for the demo ReviewService: the shared contract, plus the demo's own behaviour.
 */

// Vitest building blocks.
import { afterEach, describe, expect, it, vi } from 'vitest'

// The shared rules.
import { describeReviewServiceContract } from '../contracts/reviewService.contract'
// Records to build a platform from.
import { classRecord, courseRecord, emptyPlatformData, summaryRecord } from '../platformData'

// The unit under test.
import { createMockReviewService } from './mockReviewService'

describeReviewServiceContract('mock', (data, actorId, now) =>
  createMockReviewService({ data, actorId: () => actorId, now: () => now, latencyMs: 0 }),
)

/** A platform with one summary in review. */
function reviewable() {
  return emptyPlatformData({
    courses: [courseRecord({ id: 'c1', teacherId: 't1' })],
    classes: [classRecord({ id: 'k1', courseId: 'c1' })],
    summaries: [
      summaryRecord({
        id: 's1',
        classId: 'k1',
        status: 'in_review',
        inReviewSince: '2026-10-07T12:00:00.000Z',
        draft: { overview: 'AI.', keyConcepts: [], confusionAreas: [], keyTopics: [] },
      }),
    ],
  })
}

describe('mock Review service', () => {
  // Restore the real timers after each test.
  afterEach(() => {
    vi.useRealTimers()
  })

  // Proves every change is reported, so the demo can save it, and a refused change is not.
  it('reports each successful change and no refused one', async () => {
    const onChange = vi.fn()
    const service = createMockReviewService({
      data: reviewable(),
      actorId: () => 't1',
      now: () => new Date(),
      latencyMs: 0,
      onChange,
    })
    const draft = { overview: 'Edited.', keyConcepts: [], confusionAreas: [], keyTopics: [] }

    // A refused save changes nothing.
    await expect(service.saveDraft('s1', { ...draft, overview: '' }, 1)).rejects.toThrow()
    expect(onChange).not.toHaveBeenCalled()
    // Saving and publishing each report once.
    await service.saveDraft('s1', draft, 1)
    expect(onChange).toHaveBeenCalledTimes(1)
    await service.approveAndPublish('s1', draft, 2)
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  // Proves the demo waits like a network call, so loading states show in the app.
  it('answers only after the simulated delay', async () => {
    // Arrange: a 300 ms delay on a fake clock.
    vi.useFakeTimers()
    const service = createMockReviewService({
      data: reviewable(),
      actorId: () => 't1',
      now: () => new Date(),
      latencyMs: 300,
    })
    // Records when the answer arrives.
    let answered = false
    void service.listReviewQueue().then(() => {
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
