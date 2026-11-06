/**
 * Tests for the Analytics rules (D124): the period, the share of students and the order of the
 * class table.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The unit under test.
import { formatDuration, periodOf, quietestFirst, sharePercent } from './analytics'
// The row shape.
import type { ClassParticipation } from '@/types/analytics'

/** A class row with the numbers a test cares about. */
function row(id: string, writers: number, enrolled: number, startsAt: string): ClassParticipation {
  return {
    classId: id,
    classNumber: 1,
    classTitle: id,
    startsAt,
    courseId: 'c',
    courseCode: 'C',
    notes: writers,
    writers,
    enrolled,
  }
}

describe('periodOf', () => {
  // Proves the period ends at the start of tomorrow, so everything written today is inside it.
  it('ends tomorrow at midnight and starts whole days earlier', () => {
    const now = new Date(2026, 9, 8, 15, 30)

    const period = periodOf(30, now)

    expect(new Date(period.to).getTime()).toBe(new Date(2026, 9, 9).getTime())
    expect(Date.parse(period.to) - Date.parse(period.from)).toBe(30 * 86_400_000)
  })
})

describe('sharePercent', () => {
  // Proves the share is a whole percent, empty when nobody was expected, and capped at 100.
  it('rounds, has no value without a whole, and never passes 100', () => {
    expect(sharePercent(1, 3)).toBe(33)
    expect(sharePercent(2, 3)).toBe(67)
    expect(sharePercent(0, 0)).toBeNull()
    expect(sharePercent(5, 4)).toBe(100)
  })
})

describe('quietestFirst', () => {
  // Proves the lowest share comes first, ties go to the newest class, classes with nobody
  // enrolled come last, and the input is left alone.
  it('orders by share, then newest, with empty courses last', () => {
    const rows = [
      row('half-old', 1, 2, '2026-10-01T09:00:00Z'),
      row('none', 0, 4, '2026-10-02T09:00:00Z'),
      row('half-new', 1, 2, '2026-10-05T09:00:00Z'),
      row('nobody', 0, 0, '2026-10-06T09:00:00Z'),
    ]

    expect(quietestFirst(rows).map((item) => item.classId)).toEqual([
      'none',
      'half-new',
      'half-old',
      'nobody',
    ])
    expect(rows[0]?.classId).toBe('half-old')
  })
})

describe('formatDuration', () => {
  // Proves seconds, minutes with seconds, and a dash when there is no average.
  it('reads seconds, minutes and no value', () => {
    expect(formatDuration(null)).toBe('–')
    expect(formatDuration(44.6)).toBe('45 s')
    expect(formatDuration(90)).toBe('1 min 30 s')
  })
})
