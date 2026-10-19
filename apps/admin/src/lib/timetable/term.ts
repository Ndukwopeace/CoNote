/**
 * The trimester's dates (D105): checking what an administrator types, and spreading a course's
 * weekly slots over the term as dated classes. Dates are plain "YYYY-MM-DD" text and are worked
 * out in UTC, so the computer's own time zone can never move a class to another day.
 */

// The shapes read and produced.
import type { PlannedSession, PlannedSlot } from './types'

/** The first and last day of the term, and days with no classes (holidays, breaks). */
export interface TermDates {
  start: string
  end: string
  // Valid dates, as "YYYY-MM-DD".
  skip: readonly string[]
}

/** The length of a day, in milliseconds. */
const DAY = 24 * 60 * 60 * 1000
/** The longest term accepted: a longer one is almost certainly a typing slip. */
const MAX_DAYS = 366
/** The longest a class title may be (the database's limit). */
const MAX_TITLE = 150
/** "2026-10-13". */
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** A date's moment (midnight UTC), or null when the text is not a date on the calendar. */
function toMoment(date: string): number | null {
  const match = DATE.exec(date)
  if (!match) return null
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const moment = Date.UTC(year, month - 1, day)
  const check = new Date(moment)
  // "2026-11-31" would roll over to December; the parts must come back unchanged.
  return check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day
    ? moment
    : null
}

/** A moment as "YYYY-MM-DD". */
function toDate(moment: number): string {
  // The ISO form starts with the date.
  return new Date(moment).toISOString().slice(0, 10)
}

/** A moment's weekday, 1 for Monday to 7 for Sunday. */
function weekdayOf(moment: number): number {
  // JavaScript counts Sunday as 0.
  return new Date(moment).getUTCDay() || 7
}

/** What is wrong with the term's dates, in words for the form, or null when they are fine. */
export function validateTerm(term: TermDates): string | null {
  const start = toMoment(term.start)
  const end = toMoment(term.end)
  if (start === null) return "Enter the term's start date as YYYY-MM-DD."
  if (end === null) return "Enter the term's end date as YYYY-MM-DD."
  if (end < start) return 'The end date must be after the start date.'
  if ((end - start) / DAY > MAX_DAYS) return "The term can't be longer than a year."
  return null
}

/** Reads dates separated by commas, spaces or lines. Gives them sorted and once each, and says what was not a date. */
export function parseDateList(text: string): { dates: string[]; invalid: string[] } {
  const dates = new Set<string>()
  const invalid: string[] = []
  for (const word of text.split(/[\s,;]+/).filter((part) => part !== '')) {
    if (toMoment(word) === null) invalid.push(word)
    else dates.add(word)
  }
  return { dates: [...dates].sort(), invalid }
}

/**
 * The dated classes for a course's weekly slots: one for each matching day from the start to the
 * end of the term, inclusive, except skipped dates. A class is titled "Week N", counting weeks from
 * the Monday of the term's first week, so a term that starts on a Tuesday has its first week short.
 * A slot written under another title than the course's (a code the school reuses) adds it.
 */
export function expandSessions(
  slots: readonly PlannedSlot[],
  term: TermDates,
  courseTitle: string,
): PlannedSession[] {
  const first = toMoment(term.start)
  const last = toMoment(term.end)
  // An unusable term makes no classes; validateTerm tells the person why.
  if (first === null || last === null || last < first) return []
  const skip = new Set(term.skip)
  // The Monday of the first week is where week 1 begins.
  const week1 = first - (weekdayOf(first) - 1) * DAY
  const sessions: PlannedSession[] = []
  for (let moment = first; moment <= last; moment += DAY) {
    const date = toDate(moment)
    if (skip.has(date)) continue
    const week = `Week ${String(Math.floor((moment - week1) / (7 * DAY)) + 1)}`
    for (const slot of slots) {
      if (slot.weekday !== weekdayOf(moment)) continue
      // A slot written under another title (a reused code) says so in its class's title.
      const title =
        slot.title === courseTitle ? week : `${week} · ${slot.title}`.slice(0, MAX_TITLE)
      sessions.push({ start: `${date}T${slot.start}`, end: `${date}T${slot.end}`, title })
    }
  }
  // Date order, whichever slot a class came from.
  return sessions.sort((a, b) => a.start.localeCompare(b.start))
}
