/**
 * Tests for deciding whether a course has a class going on right now (D120).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The unit under test.
import { isInSession } from './inSession'

/** A class from 09:00 to 11:00 UTC on 28 October 2026. */
const MORNING = { startsAt: '2026-10-28T09:00:00Z', endsAt: '2026-10-28T11:00:00Z' }
/** A class from 14:00 to 16:00 the same day. */
const AFTERNOON = { startsAt: '2026-10-28T14:00:00Z', endsAt: '2026-10-28T16:00:00Z' }

describe('isInSession', () => {
  // Proves a class that is going on counts.
  it('is true while a class is going on', () => {
    expect(isInSession([MORNING], new Date('2026-10-28T10:00:00Z'))).toBe(true)
  })

  // Proves the start is included and the end is not, so back-to-back classes never overlap.
  it('includes the start and excludes the end', () => {
    expect(isInSession([MORNING], new Date('2026-10-28T09:00:00Z'))).toBe(true)
    expect(isInSession([MORNING], new Date('2026-10-28T11:00:00Z'))).toBe(false)
  })

  // Proves a class that has not started, or has finished, does not count: no "Upcoming" or
  // "Completed" is ever shown (D120).
  it('is false before and after a class', () => {
    expect(isInSession([MORNING], new Date('2026-10-28T08:59:00Z'))).toBe(false)
    expect(isInSession([MORNING], new Date('2026-10-28T11:01:00Z'))).toBe(false)
  })

  // Proves any one class is enough, and the gap between classes is not "in session".
  it('looks at every class', () => {
    const classes = [MORNING, AFTERNOON]
    expect(isInSession(classes, new Date('2026-10-28T15:00:00Z'))).toBe(true)
    expect(isInSession(classes, new Date('2026-10-28T12:30:00Z'))).toBe(false)
  })

  // Proves a course with no classes is never in session.
  it('is false with no classes', () => {
    expect(isInSession([], new Date('2026-10-28T10:00:00Z'))).toBe(false)
  })

  // Proves unreadable times are skipped, not treated as always on.
  it('ignores a class with a time it cannot read', () => {
    expect(
      isInSession([{ startsAt: 'soon', endsAt: 'later' }], new Date('2026-10-28T10:00:00Z')),
    ).toBe(false)
  })
})
