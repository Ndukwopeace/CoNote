/**
 * Tests for the activity chart's scale and labels.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The units under test.
import { dayLabel, niceScale, shortDayLabel } from './chart'

describe('niceScale', () => {
  // Proves the top of the axis is a round number at or above the highest value.
  it.each([
    [0, 4, [0, 1, 2, 3, 4]],
    [3, 4, [0, 1, 2, 3, 4]],
    [7, 8, [0, 2, 4, 6, 8]],
    [41, 50, [0, 10, 20, 30, 40, 50]],
    [180, 200, [0, 50, 100, 150, 200]],
    [1234, 1500, [0, 500, 1000, 1500]],
  ])('scales a maximum of %i to %i', (max, top, ticks) => {
    expect(niceScale(max)).toEqual({ top, ticks })
  })
})

describe('day labels', () => {
  // Proves the long label names the weekday, the day and the month.
  it('formats the long label', () => {
    expect(dayLabel('2026-10-07')).toBe('Wed 7 Oct')
  })

  // Proves the short label drops the weekday, for the axis.
  it('formats the short label', () => {
    expect(shortDayLabel('2026-10-07')).toBe('7 Oct')
  })
})
