/**
 * Rules for class sessions (REQUIREMENTS.md FR-DSH-3, FR-CLS-5, FR-CLS-6). A session's
 * live/upcoming/completed status is always worked out from the clock, never stored.
 */

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
