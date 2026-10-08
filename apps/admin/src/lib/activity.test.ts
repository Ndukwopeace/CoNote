/**
 * Tests for turning event times into one count per local day (admin REQUIREMENTS section 10).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The units under test.
import { dailyCounts, localDateKey } from './activity'

/** A local time on 8 October 2026 (months count from 0). */
function oct(day: number, hour = 12) {
  return new Date(2026, 9, day, hour)
}

describe('localDateKey', () => {
  // Proves the key is the local calendar day, zero-padded.
  it('formats the local date as YYYY-MM-DD', () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
})

describe('dailyCounts', () => {
  // Proves the series has one point per day, oldest first, ending today.
  it('returns one point per day ending today', () => {
    // Act.
    const points = dailyCounts([], oct(8), 7)

    // Assert.
    expect(points.map((point) => point.date)).toEqual([
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
    ])
    expect(points.every((point) => point.count === 0)).toBe(true)
  })

  // Proves events are counted on their local day, early and late in the day alike.
  it('counts events on their local day', () => {
    // Arrange: two events today, one early yesterday.
    const times = [oct(8, 0), oct(8, 23), oct(7, 1)].map((date) => date.toISOString())

    // Act.
    const points = dailyCounts(times, oct(8), 3)

    // Assert.
    expect(points).toEqual([
      { date: '2026-10-06', count: 0 },
      { date: '2026-10-07', count: 1 },
      { date: '2026-10-08', count: 2 },
    ])
  })

  // Proves events before the range, or in the future, are left out.
  it('ignores events outside the range', () => {
    // Arrange: one before the range, one tomorrow.
    const times = [oct(1), oct(9)].map((date) => date.toISOString())

    // Act.
    const points = dailyCounts(times, oct(8), 7)

    // Assert.
    expect(points.reduce((sum, point) => sum + point.count, 0)).toBe(0)
  })

  // Proves the range crosses month ends correctly.
  it('crosses month boundaries', () => {
    // Act.
    const points = dailyCounts([], new Date(2026, 2, 1, 9), 3)

    // Assert.
    expect(points.map((point) => point.date)).toEqual(['2026-02-27', '2026-02-28', '2026-03-01'])
  })
})
