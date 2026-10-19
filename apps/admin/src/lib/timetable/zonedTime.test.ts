/**
 * Tests for turning a local date and time in a named time zone into a moment (D105). The demo
 * service needs this because it has no database to do it; the database uses `at time zone`.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The functions under test.
import { isValidTimeZone, localToIso } from './zonedTime'

describe('localToIso', () => {
  // Proves Douala, which is one hour ahead of UTC all year, is read correctly.
  it('reads a time in Douala as one hour earlier in UTC', () => {
    expect(localToIso('2026-10-20T08:00', 'Africa/Douala')).toBe('2026-10-20T07:00:00.000Z')
  })

  // Proves a zone with daylight saving uses the right offset in summer and in winter.
  it('follows daylight saving', () => {
    expect(localToIso('2026-07-01T09:00', 'America/New_York')).toBe('2026-07-01T13:00:00.000Z')
    expect(localToIso('2026-01-15T09:00', 'America/New_York')).toBe('2026-01-15T14:00:00.000Z')
  })

  // Proves a time near a clock change is still right on each side of it.
  it('is right either side of a clock change', () => {
    // Paris moved forward on 29 March 2026: 01:00 UTC became 03:00 local.
    expect(localToIso('2026-03-29T01:30', 'Europe/Paris')).toBe('2026-03-29T00:30:00.000Z')
    expect(localToIso('2026-03-29T04:00', 'Europe/Paris')).toBe('2026-03-29T02:00:00.000Z')
  })

  // Proves UTC itself is left as it is.
  it('leaves UTC alone', () => {
    expect(localToIso('2026-10-20T08:00', 'UTC')).toBe('2026-10-20T08:00:00.000Z')
  })

  // Proves a day boundary is crossed correctly: midnight in Douala is 23:00 the day before in UTC.
  it('crosses the day boundary', () => {
    expect(localToIso('2026-10-20T00:30', 'Africa/Douala')).toBe('2026-10-19T23:30:00.000Z')
  })
})

describe('isValidTimeZone', () => {
  // Proves real zone names are accepted, including ones that are aliases of another.
  it('accepts real zone names', () => {
    expect(isValidTimeZone('Africa/Douala')).toBe(true)
    expect(isValidTimeZone('UTC')).toBe(true)
  })

  // Proves anything else is refused rather than thrown at.
  it('refuses a name that is not a zone', () => {
    expect(isValidTimeZone('Mars/Base')).toBe(false)
    expect(isValidTimeZone('')).toBe(false)
  })
})
