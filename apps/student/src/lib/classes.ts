/**
 * Rules for class sessions (REQUIREMENTS.md FR-DSH-3, FR-CLS-5, FR-CLS-6). A session's
 * live/upcoming/completed status is always worked out from the clock, never stored.
 */

// How a day's date is written.
import { formatClassDate } from '@/lib/dates'
// The session shape.
import type { ClassSession } from '@/types/domain'

/** Where a session is relative to now. */
export type ClassStatus = 'upcoming' | 'live' | 'completed'

/** Live from the start time up to (but not including) the end time. */
export function getClassStatus(session: ClassSession, now: Date): ClassStatus {
  // Milliseconds for easy comparison.
  const time = now.getTime()
  // Not started yet.
  if (time < Date.parse(session.startsAt)) return 'upcoming'
  // Started and not yet over.
  if (time < Date.parse(session.endsAt)) return 'live'
  // Over.
  return 'completed'
}

/** Soonest first. */
function byStartAscending(a: ClassSession, b: ClassSession) {
  return Date.parse(a.startsAt) - Date.parse(b.startsAt)
}

/** The sessions for /classes, split by local calendar day (FR-CLS-6). */
export interface ClassGroups {
  // Starting today, soonest first.
  today: ClassSession[]
  // Starting after today, soonest first.
  upcoming: ClassSession[]
  // Starting before today, most recent first.
  past: ClassSession[]
}

/** Splits sessions into Today, Upcoming and Past by the day they start, in local time. */
export function groupClassesByDay(sessions: readonly ClassSession[], now: Date): ClassGroups {
  // Local midnight at the start of today and of tomorrow.
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime()
  // Everything soonest first, so each group comes out sorted.
  const sorted = [...sessions].sort(byStartAscending)
  // Each session's start, in milliseconds.
  const start = (session: ClassSession) => Date.parse(session.startsAt)
  return {
    // From midnight today up to midnight tonight.
    today: sorted.filter((s) => start(s) >= startOfToday && start(s) < startOfTomorrow),
    // From midnight tonight on.
    upcoming: sorted.filter((s) => start(s) >= startOfTomorrow),
    // Before midnight this morning, most recent first.
    past: sorted.filter((s) => start(s) < startOfToday).reverse(),
  }
}

/** The dashboard's next sessions: live ones first, then upcoming, soonest first (FR-DSH-3). */
export function upcomingClasses(
  sessions: readonly ClassSession[],
  now: Date,
  limit: number,
): ClassSession[] {
  return (
    sessions
      // Finished sessions are not "coming up".
      .filter((session) => getClassStatus(session, now) !== 'completed')
      // A live session started earliest, so sorting by start puts it first.
      .sort(byStartAscending)
      // Only the first few.
      .slice(0, limit)
  )
}

/** The classes either side of `classId` in the course, by class number (FR-CLS-5). */
export function adjacentClasses(
  sessions: readonly ClassSession[],
  classId: string,
): { previous?: ClassSession; next?: ClassSession } {
  // Course order is by class number, whatever order the list arrived in.
  const ordered = [...sessions].sort((a, b) => a.number - b.number)
  // Where the current class sits.
  const index = ordered.findIndex((session) => session.id === classId)
  // Unknown class: no links, rather than links to the wrong place.
  if (index === -1) return {}
  // The neighbours; undefined at the ends, which hides the link.
  const previous = ordered[index - 1]
  const next = ordered[index + 1]
  // Only include the ones that exist (the strict optional-property rule requires this).
  return { ...(previous ? { previous } : {}), ...(next ? { next } : {}) }
}

/**
 * Whether a class has started, which is when a student may write about it: a class still to come
 * is not offered, and the services refuse it too (D107).
 */
export function hasClassStarted(session: ClassSession, now: Date): boolean {
  // The start itself counts: a class is open for notes the minute it begins.
  return Date.parse(session.startsAt) <= now.getTime()
}

/** How many days before today a class can still be chosen (D108). */
const RECENT_DAYS = 2

/** Local midnight at the start of the first day a class can be chosen from (two days back). */
function windowStart(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - RECENT_DAYS).getTime()
}

/** Local midnight at the end of today. */
function windowEnd(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime()
}

/** Whether the class starts today or in the two days before, in local time. */
function isInWindow(session: ClassSession, now: Date): boolean {
  // The class's start, in milliseconds.
  const start = Date.parse(session.startsAt)
  // From two days back up to the end of today.
  return start >= windowStart(now) && start < windowEnd(now)
}

/**
 * Whether a student may choose the class on Home and in the note form (D108): it has started, and
 * it started today or in the two days before, by the student's own calendar. Older classes and
 * classes still to come are not offered.
 */
export function isOpenForNotes(session: ClassSession, now: Date): boolean {
  // Started, and recent enough.
  return hasClassStarted(session, now) && isInWindow(session, now)
}

/**
 * The class a new note is most likely for: the latest class that is open for notes, so the one on
 * now, or the one that just ended. None open, and nothing is guessed.
 */
export function defaultNoteClass(
  sessions: readonly ClassSession[],
  now: Date,
): ClassSession | undefined {
  return (
    sessions
      // Open for notes.
      .filter((session) => isOpenForNotes(session, now))
      // Latest start first.
      .sort((a, b) => byStartAscending(b, a))[0]
  )
}

/**
 * The classes the class sheet and the navigation list, for the student to choose from (D108):
 * today and the two days before. The ones that have started come first, latest first, then
 * today's that are still to come, soonest first. Older days and later days are left out. A class
 * that has not started is listed but cannot be chosen (`isOpenForNotes`).
 */
export function classesToChoose(sessions: readonly ClassSession[], now: Date): ClassSession[] {
  // The last three days, whether or not the class has started.
  const recent = sessions.filter((session) => isInWindow(session, now))
  // Those that have started, latest first, then those still to come, soonest first.
  const started = recent.filter((session) => hasClassStarted(session, now))
  const coming = recent.filter((session) => !hasClassStarted(session, now))
  return [...started.sort((a, b) => byStartAscending(b, a)), ...coming.sort(byStartAscending)]
}

/** One day's classes in the class sheet and the navigation (D108). */
export interface ClassDay {
  // "Today", "Yesterday", or the date ("Sat 26 Sep") for the day before that.
  label: string
  // The day's classes, in the order `classesToChoose` gives.
  classes: ClassSession[]
}

/**
 * The choosable classes grouped by day, today first: "Today", "Yesterday", then the date. A day
 * with no classes has no group.
 */
export function classesByDay(sessions: readonly ClassSession[], now: Date): ClassDay[] {
  // Local midnight today, to count whole days back from.
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  // The day a class starts on, as local midnight.
  const dayOf = (session: ClassSession) => {
    const start = new Date(session.startsAt)
    return new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()
  }
  // The label for a day's first class: how many days back it is.
  const label = (session: ClassSession) => {
    // Whole days between that day and today (rounded: a daylight-saving day is not 24 hours).
    const back = Math.round((startOfToday - dayOf(session)) / (24 * 60 * 60 * 1000))
    if (back <= 0) return 'Today'
    if (back === 1) return 'Yesterday'
    return formatClassDate(session.startsAt)
  }
  // Newest day first, each day's classes in `classesToChoose` order.
  const days = new Map<number, ClassDay>()
  for (const session of classesToChoose(sessions, now)) {
    const key = dayOf(session)
    const day = days.get(key) ?? { label: label(session), classes: [] }
    day.classes.push(session)
    days.set(key, day)
  }
  return [...days.entries()].sort((a, b) => b[0] - a[0]).map(([, day]) => day)
}
