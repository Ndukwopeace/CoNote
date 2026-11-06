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

  // Proves the report counts only the notes written inside the period, and each writer once.
  it('counts the notes of the period and the students who wrote them', async () => {
    const note = (id: string, studentId: string, createdAt: string) => ({
      id,
      classId: 'k1',
      studentId,
      title: null,
      contentHtml: '<p>x</p>',
      createdAt,
    })
    const data = emptyPlatformData({
      notes: [
        note('n1', 's1', '2026-10-06T10:00:00.000Z'),
        note('n2', 's1', '2026-10-07T10:00:00.000Z'),
        note('n3', 's2', '2026-10-07T11:00:00.000Z'),
        // Before the period: counts for nobody.
        note('n4', 's3', '2026-09-01T10:00:00.000Z'),
      ],
    })
    const service = createMockAnalyticsService({
      data,
      now: () => new Date('2026-10-08T12:00:00Z'),
      latencyMs: 0,
    })

    const report = await service.getReport({
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-10-09T00:00:00.000Z',
    })

    expect(report.academic.notesCreated).toBe(3)
    expect(report.participation.studentsWhoWrote).toBe(2)
  })
})
