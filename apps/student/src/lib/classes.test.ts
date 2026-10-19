/**
 * Tests for the class rules: live/upcoming/completed from the clock, grouping for /classes,
 * the dashboard's next three, and Previous/Next links (FR-DSH-3, FR-CLS-5, FR-CLS-6).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// A factory for class sessions.
import { makeClass } from '@/test/factories'

// The rules under test.
import {
  adjacentClasses,
  defaultNoteClass,
  getClassStatus,
  groupClassesByDay,
  hasClassStarted,
  isOpenForNotes,
  classesByDay,
  classesToChoose,
  upcomingClasses,
} from './classes'

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

describe('defaultNoteClass', () => {
  // Proves the class that is on now wins, even when an earlier one has also ended today.
  it('picks the class that is on now', () => {
    const sessions = [at(0, 7, 8, 'earlier'), at(0, 9, 11, 'now'), at(0, 14, 15, 'later')]
    expect(defaultNoteClass(sessions, now)?.id).toBe('now')
  })

  // Proves a student writing up after class gets the one that just ended, not a future one.
  it('picks the latest class that has started today, once it is over', () => {
    const sessions = [at(0, 6, 7, 'older'), at(0, 8, 9, 'just-ended'), at(1, 9, 11, 'tomorrow')]
    expect(defaultNoteClass(sessions, now)?.id).toBe('just-ended')
  })

  // Proves a class from the last two days can still be guessed, and an older one is not (D108).
  it('picks nothing when the latest class is older than two days', () => {
    expect(defaultNoteClass([at(-2, 9, 11, 'two-days-ago')], now)?.id).toBe('two-days-ago')
    expect(defaultNoteClass([at(-3, 15, 17, 'three-days-ago')], now)).toBeUndefined()
  })

  // Proves nothing is picked when no class has started, or there are none.
  it('picks nothing when no class has started yet', () => {
    expect(defaultNoteClass([at(0, 11, 12), at(1, 9, 10)], now)).toBeUndefined()
    expect(defaultNoteClass([], now)).toBeUndefined()
  })
})

describe('hasClassStarted', () => {
  // Proves a class can be written about from the minute it starts, and not a second before.
  it('is true from the start time on and false before it', () => {
    const session = at(0, 10, 11)
    expect(hasClassStarted(session, new Date(2026, 8, 28, 9, 59, 59))).toBe(false)
    expect(hasClassStarted(session, now)).toBe(true)
    expect(hasClassStarted(session, new Date(2026, 8, 28, 12, 0))).toBe(true)
  })
})

describe('isOpenForNotes', () => {
  // Proves a class is open from its start time on, for today and the two days before (D108).
  it('is true for a class that has started today or in the last two days', () => {
    expect(isOpenForNotes(at(0, 10, 11), now)).toBe(true)
    expect(isOpenForNotes(at(0, 8, 9), now)).toBe(true)
    expect(isOpenForNotes(at(-1, 9, 11), now)).toBe(true)
    expect(isOpenForNotes(at(-2, 0, 1), now)).toBe(true)
  })

  // Proves a class that has not started, or is older than two days, is not open.
  it('is false before the start and after the window', () => {
    expect(isOpenForNotes(at(0, 10, 11), new Date(2026, 8, 28, 9, 59))).toBe(false)
    expect(isOpenForNotes(at(1, 9, 11), now)).toBe(false)
    expect(isOpenForNotes(at(-3, 23, 24), now)).toBe(false)
  })

  // Proves the days are local ones: a class at 23:30 two days ago is still open at 23:45, and
  // not five minutes into the next day.
  it('uses local calendar days', () => {
    const lateClass = at(-2, 23, 24, 'late')
    expect(isOpenForNotes(lateClass, new Date(2026, 8, 28, 23, 45))).toBe(true)
    expect(isOpenForNotes(lateClass, new Date(2026, 8, 29, 0, 5))).toBe(false)
  })
})

describe('classesToChoose', () => {
  // Proves the class sheet lists today and the two days before (D108): the classes that have
  // started come first, latest first, then today's that are still to come, soonest first. Older
  // days and later days are left out.
  it('lists the last three days, started classes first, and leaves out the rest', () => {
    const sessions = [
      at(2, 9, 10, 'in-two-days'),
      at(-3, 9, 10, 'three-days-ago'),
      at(-2, 9, 10, 'two-days-ago'),
      at(0, 9, 11, 'now'),
      at(0, 7, 8, 'this-morning'),
      at(1, 9, 10, 'tomorrow'),
      at(-1, 9, 10, 'yesterday'),
      at(0, 15, 16, 'this-evening'),
      at(0, 11, 12, 'later-today'),
    ]
    expect(classesToChoose(sessions, now).map((s) => s.id)).toEqual([
      'now',
      'this-morning',
      'yesterday',
      'two-days-ago',
      'later-today',
      'this-evening',
    ])
    expect(classesToChoose([], now)).toEqual([])
  })
})

describe('classesByDay', () => {
  // Proves the choosable classes are grouped by day, newest day first and labelled "Today",
  // "Yesterday", then the date for two days back (D108), each group keeping its own order.
  it('groups the classes under Today, Yesterday and the date', () => {
    const sessions = [
      at(-2, 9, 10, 'two-days-ago'),
      at(0, 15, 16, 'this-evening'),
      at(-1, 9, 10, 'yesterday-morning'),
      at(0, 9, 11, 'now'),
      at(-1, 14, 15, 'yesterday-afternoon'),
      at(-3, 9, 10, 'too-old'),
    ]
    const days = classesByDay(sessions, now)

    expect(days.map((d) => d.label)).toEqual(['Today', 'Yesterday', 'Sat 26 Sep'])
    expect(days.map((d) => d.classes.map((s) => s.id))).toEqual([
      ['now', 'this-evening'],
      ['yesterday-afternoon', 'yesterday-morning'],
      ['two-days-ago'],
    ])
  })

  // Proves a day with no classes gets no heading, and no classes gives no groups.
  it('leaves out days with no classes', () => {
    expect(classesByDay([at(-2, 9, 10)], now).map((d) => d.label)).toEqual(['Sat 26 Sep'])
    expect(classesByDay([], now)).toEqual([])
  })
})
