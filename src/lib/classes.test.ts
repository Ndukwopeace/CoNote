/**
 * Tests for the class rules: live/upcoming/completed from the clock, grouping for /classes,
 * the dashboard's next three, and Previous/Next links (FR-DSH-3, FR-CLS-5, FR-CLS-6).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// A factory for class sessions.
import { makeClass } from '@/test/factories'

// The rules under test.
import { adjacentClasses, getClassStatus, groupClassesByDay, upcomingClasses } from './classes'

// A fixed "now": Monday 28 September 2026, 10:00 local time.
const now = new Date(2026, 8, 28, 10, 0)

/** A session from `start` to `end`, both local times on the given day offset from `now`. */
function at(
  dayOffset: number,
  startHour: number,
  endHour: number,
  id = `c${dayOffset}${startHour}`,
) {
  // Build start and end on the same local day.
  const start = new Date(2026, 8, 28 + dayOffset, startHour, 0)
  const end = new Date(2026, 8, 28 + dayOffset, endHour, 0)
  // A session with those times.
  return makeClass({ id, startsAt: start.toISOString(), endsAt: end.toISOString() })
}

describe('getClassStatus', () => {
  // Proves the three states and their edges: live from the start up to (not including) the end.
  it.each([
    ['before it starts', at(0, 11, 12), 'upcoming'],
    ['at the start time', at(0, 10, 12), 'live'],
    ['during the class', at(0, 9, 11), 'live'],
    ['at the end time', at(0, 8, 10), 'completed'],
    ['after it ends', at(-1, 9, 11), 'completed'],
  ])('is %s → %s', (_label, session, expected) => {
    expect(getClassStatus(session, now)).toBe(expected)
  })
})

describe('groupClassesByDay', () => {
  // Proves sessions land in Today, Upcoming and Past by local calendar day, each sorted.
  it('groups by local day and sorts each group', () => {
    // Arrange: a spread of sessions, deliberately out of order.
    const sessions = [
      at(2, 9, 10, 'in-two-days'),
      at(0, 15, 16, 'later-today'),
      at(-3, 9, 10, 'three-days-ago'),
      at(0, 8, 9, 'earlier-today'),
      at(1, 9, 10, 'tomorrow'),
      at(-1, 9, 10, 'yesterday'),
    ]

    // Act.
    const groups = groupClassesByDay(sessions, now)

    // Assert: today and upcoming soonest first; past most recent first.
    expect(groups.today.map((s) => s.id)).toEqual(['earlier-today', 'later-today'])
    expect(groups.upcoming.map((s) => s.id)).toEqual(['tomorrow', 'in-two-days'])
    expect(groups.past.map((s) => s.id)).toEqual(['yesterday', 'three-days-ago'])
  })

  // Proves a session just after midnight belongs to that day, not the one before.
  it('uses local midnight as the boundary', () => {
    // Act: one session at 00:30 tomorrow.
    const groups = groupClassesByDay([at(1, 0, 1, 'just-after-midnight')], now)

    // Assert.
    expect(groups.upcoming).toHaveLength(1)
    expect(groups.today).toHaveLength(0)
  })
})

describe('upcomingClasses', () => {
  // Proves the dashboard shows the live class first, then the next ones, never finished ones.
  it('returns the live and upcoming sessions, soonest first, up to the limit', () => {
    // Arrange.
    const sessions = [
      at(3, 9, 10, 'd3'),
      at(-1, 9, 10, 'past'),
      at(0, 9, 11, 'live'),
      at(1, 9, 10, 'd1'),
      at(2, 9, 10, 'd2'),
    ]

    // Act.
    const next = upcomingClasses(sessions, now, 3)

    // Assert.
    expect(next.map((s) => s.id)).toEqual(['live', 'd1', 'd2'])
  })
})

describe('adjacentClasses', () => {
  // A course's classes, deliberately out of order.
  const sessions = [
    makeClass({ id: 'c3', number: 3 }),
    makeClass({ id: 'c1', number: 1 }),
    makeClass({ id: 'c2', number: 2 }),
  ]

  // Proves Previous and Next follow the class numbers (FR-CLS-5).
  it('finds the previous and next class by number', () => {
    const { previous, next } = adjacentClasses(sessions, 'c2')
    expect(previous?.id).toBe('c1')
    expect(next?.id).toBe('c3')
  })

  // Proves each link is hidden at the ends of the list.
  it('has no previous for the first class and no next for the last', () => {
    expect(adjacentClasses(sessions, 'c1').previous).toBeUndefined()
    expect(adjacentClasses(sessions, 'c3').next).toBeUndefined()
  })

  // Proves an unknown class gets no links rather than wrong ones.
  it('returns nothing for an unknown class', () => {
    expect(adjacentClasses(sessions, 'nope')).toEqual({})
  })
})
