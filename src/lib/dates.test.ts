/**
 * Tests for the date wording: the dashboard greeting, class times and relative times.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The functions under test.
import { formatClassDate, formatClassTime, formatRelativeTime, greetingFor } from './dates'

describe('greetingFor', () => {
  // Proves the greeting follows the local hour (FR-DSH-1): [hour, greeting].
  it.each([
    [5, 'Good morning'],
    [11, 'Good morning'],
    [12, 'Good afternoon'],
    [16, 'Good afternoon'],
    [17, 'Good evening'],
    [23, 'Good evening'],
    [2, 'Good evening'],
  ])('at %i:00 says "%s"', (hour, expected) => {
    expect(greetingFor(new Date(2026, 8, 28, hour, 0))).toBe(expected)
  })
})

describe('formatClassDate and formatClassTime', () => {
  // A class from 9:00 to 11:30 on Monday 28 September 2026, local time.
  const start = new Date(2026, 8, 28, 9, 0).toISOString()
  const end = new Date(2026, 8, 28, 11, 30).toISOString()

  // Proves the day is written the same way on every device.
  it('writes the day as "Mon 28 Sep"', () => {
    expect(formatClassDate(start)).toBe('Mon 28 Sep')
  })

  // Proves times use a 12-hour clock, with minutes only when they aren't zero.
  it('writes the time range as "9 AM – 11:30 AM"', () => {
    expect(formatClassTime(start, end)).toBe('9 AM – 11:30 AM')
  })

  // Proves noon and midnight read naturally.
  it('writes 12 PM and 12 AM', () => {
    const noon = new Date(2026, 8, 28, 12, 0).toISOString()
    const midnight = new Date(2026, 8, 29, 0, 0).toISOString()
    expect(formatClassTime(noon, midnight)).toBe('12 PM – 12 AM')
  })
})

describe('formatRelativeTime', () => {
  // The reference "now".
  const now = new Date(2026, 8, 28, 10, 0)
  /** The time `minutes` before now, as ISO text. */
  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString()

  // Proves each band of the wording (FR-DSH-4): [minutes ago, text].
  it.each([
    [0, 'Just now'],
    [1, '1 min ago'],
    [45, '45 min ago'],
    [60, '1 hour ago'],
    [5 * 60, '5 hours ago'],
    [24 * 60, 'Yesterday'],
    [3 * 24 * 60, '3 days ago'],
    [6 * 24 * 60, '6 days ago'],
    [8 * 24 * 60, '20 Sep'],
  ])('%i minutes ago → "%s"', (minutes, expected) => {
    expect(formatRelativeTime(ago(minutes), now)).toBe(expected)
  })

  // Proves a time slightly in the future (clock skew) doesn't say "-1 min ago".
  it('treats a time in the future as just now', () => {
    expect(formatRelativeTime(new Date(now.getTime() + 30_000).toISOString(), now)).toBe('Just now')
  })
})
