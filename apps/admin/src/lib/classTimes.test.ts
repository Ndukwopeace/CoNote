/**
 * Tests for a class's date and time conversions.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The units under test.
import { formatTimeRange, toDateInput, toIso, toTimeInput } from './classTimes'

describe('class times', () => {
  // Proves the form's local values survive a round trip through the stored instant.
  it('round-trips a local date and time', () => {
    const iso = toIso('2026-10-20', '09:05')
    expect(toDateInput(iso)).toBe('2026-10-20')
    expect(toTimeInput(iso)).toBe('09:05')
  })

  // Proves the instant is the local time, not UTC read as local.
  it('reads the date and time in the local zone', () => {
    expect(toIso('2026-10-20', '09:05')).toBe(new Date(2026, 9, 20, 9, 5).toISOString())
  })

  // Proves the range wording.
  it('formats a range', () => {
    expect(formatTimeRange(toIso('2026-10-20', '09:00'), toIso('2026-10-20', '10:30'))).toBe(
      '09:00–10:30',
    )
  })
})
