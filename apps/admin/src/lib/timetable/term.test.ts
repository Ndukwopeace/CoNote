/**
 * Tests for the trimester's dates (D105): checking what an administrator types, and turning a
 * course's weekly slots into dated classes with a "Week N" title.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The functions under test.
import { expandSessions, parseDateList, validateTerm } from './term'
// The slot shape.
import type { PlannedSlot } from './types'

// 13 October 2026 is a Tuesday; 22 December 2026 is a Tuesday too.
const TERM = { start: '2026-10-13', end: '2026-12-22', skip: [] as string[] }

describe('validateTerm', () => {
  // Proves a normal term passes.
  it('accepts a start before an end', () => {
    expect(validateTerm(TERM)).toBeNull()
  })

  // Proves missing or malformed dates are refused with a message.
  it('refuses a missing or malformed date', () => {
    expect(validateTerm({ ...TERM, start: '' })).toMatch(/start/i)
    expect(validateTerm({ ...TERM, end: '22/12/2026' })).toMatch(/end/i)
  })

  // Proves a date that does not exist (31 November) is refused, not rolled over.
  it('refuses a date that is not on the calendar', () => {
    expect(validateTerm({ ...TERM, end: '2026-11-31' })).toMatch(/end/i)
  })

  // Proves an end before the start is refused.
  it('refuses an end before the start', () => {
    expect(validateTerm({ ...TERM, end: '2026-10-01' })).toMatch(/after/i)
  })

  // Proves a term of more than a year is refused: it is almost certainly a typo.
  it('refuses a term longer than a year', () => {
    expect(validateTerm({ ...TERM, end: '2028-01-01' })).toMatch(/year/i)
  })
})

describe('parseDateList', () => {
  // Proves dates may be separated by commas, spaces or lines, and come out sorted and unique.
  it('reads dates split by commas, spaces and lines', () => {
    expect(parseDateList('2026-11-02, 2026-10-30\n2026-11-02  2026-12-01')).toEqual({
      dates: ['2026-10-30', '2026-11-02', '2026-12-01'],
      invalid: [],
    })
  })

  // Proves something that is not a date is reported back, not dropped.
  it('reports what is not a date', () => {
    expect(parseDateList('2026-11-02, soon, 2026-13-40')).toEqual({
      dates: ['2026-11-02'],
      invalid: ['soon', '2026-13-40'],
    })
  })

  // Proves an empty box means no dates.
  it('reads nothing as no dates', () => {
    expect(parseDateList('  ')).toEqual({ dates: [], invalid: [] })
  })
})

describe('expandSessions', () => {
  // A Tuesday morning class and a Monday afternoon class.
  const slots: PlannedSlot[] = [
    { weekday: 1, start: '13:00', end: '15:00', title: 'Calculus I' },
    { weekday: 2, start: '08:00', end: '12:00', title: 'Calculus I' },
  ]

  // Proves the first Tuesday is the term's first day and is "Week 1".
  it('starts on the first matching day of the term', () => {
    const sessions = expandSessions(slots, TERM, 'Calculus I')

    expect(sessions[0]).toEqual({
      start: '2026-10-13T08:00',
      end: '2026-10-13T12:00',
      title: 'Week 1',
    })
  })

  // Proves a Monday before the term's start (12 October) is not created.
  it('leaves out days before the start', () => {
    const sessions = expandSessions(slots, TERM, 'Calculus I')

    expect(sessions.map((session) => session.start)).not.toContain('2026-10-12T13:00')
    expect(sessions[1]).toEqual({
      start: '2026-10-19T13:00',
      end: '2026-10-19T15:00',
      title: 'Week 2',
    })
  })

  // Proves the last day of the term is included.
  it('includes the last day of the term', () => {
    const sessions = expandSessions(slots, TERM, 'Calculus I')

    expect(sessions.at(-1)).toEqual({
      start: '2026-12-22T08:00',
      end: '2026-12-22T12:00',
      title: 'Week 11',
    })
  })

  // Proves the count: Mondays 19 Oct to 21 Dec (10) plus Tuesdays 13 Oct to 22 Dec (11).
  it('makes one class per matching day', () => {
    expect(expandSessions(slots, TERM, 'Calculus I')).toHaveLength(21)
  })

  // Proves classes come out in date order, whichever slot they came from.
  it('orders classes by date', () => {
    const starts = expandSessions(slots, TERM, 'Calculus I').map((session) => session.start)

    expect(starts).toEqual([...starts].sort())
  })

  // Proves dates to skip (a holiday, a break) get no class.
  it('leaves out skipped dates', () => {
    const sessions = expandSessions(slots, { ...TERM, skip: ['2026-10-20'] }, 'Calculus I')

    expect(sessions).toHaveLength(20)
    expect(sessions.map((session) => session.start)).not.toContain('2026-10-20T08:00')
  })

  // Proves no slots means no classes.
  it('makes nothing from no slots', () => {
    expect(expandSessions([], TERM, 'Calculus I')).toEqual([])
  })

  // Proves the week number counts weeks from the Monday of the term's first week.
  it('numbers weeks from the Monday of the first week', () => {
    const sessions = expandSessions(
      [{ weekday: 5, start: '08:00', end: '10:00', title: 'Calculus I' }],
      TERM,
      'Calculus I',
    )

    // Friday 16 October is still in week 1, Friday 23 October in week 2.
    expect(sessions.slice(0, 2).map((session) => session.title)).toEqual(['Week 1', 'Week 2'])
  })

  // Proves a slot written under another title than the course's names its class after it.
  it("adds a slot's own title when it differs from the course's", () => {
    const sessions = expandSessions(
      [{ weekday: 2, start: '13:00', end: '17:00', title: 'Project Work-In-Progress Review' }],
      TERM,
      'Capstone Project Scoping',
    )

    expect(sessions[0]?.title).toBe('Week 1 · Project Work-In-Progress Review')
  })

  // Proves a very long title cannot make a class title longer than the database allows (150).
  it('keeps a class title within 150 characters', () => {
    const sessions = expandSessions(
      [{ weekday: 2, start: '13:00', end: '17:00', title: 'x'.repeat(300) }],
      TERM,
      'Other',
    )

    expect(sessions[0]?.title.length).toBeLessThanOrEqual(150)
  })
})
