/**
 * Small rules the Analytics page and the demo service share (D124): which period "last 30 days"
 * means, what share of students wrote, and which classes to show first.
 */

// The period types.
import type { AnalyticsDays, AnalyticsPeriod, ClassParticipation } from '@/types/analytics'

/** One day in milliseconds. */
const DAY_MS = 86_400_000

/**
 * The last `days` days, ending at the end of today on the administrator's clock: today is included,
 * so a note written this minute is inside the period.
 */
export function periodOf(days: AnalyticsDays, now: Date): AnalyticsPeriod {
  // Midnight at the start of tomorrow is the (excluded) end.
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  // The start is `days` whole days earlier.
  const start = new Date(end.getTime() - days * DAY_MS)
  return { from: start.toISOString(), to: end.toISOString() }
}

/** Whole percent of `part` in `whole`, or null when there is no whole to take a share of. */
export function sharePercent(part: number, whole: number): number | null {
  if (whole <= 0) return null
  // Never above 100: a student who left the course may still have written.
  return Math.min(100, Math.round((part / whole) * 100))
}

/**
 * The classes with the lowest share of students writing first (a class with nobody enrolled last),
 * then the newest. The input is not changed.
 */
export function quietestFirst(rows: readonly ClassParticipation[]): ClassParticipation[] {
  // A class with nobody enrolled has no share; it sorts after those that do.
  const key = (row: ClassParticipation) => sharePercent(row.writers, row.enrolled) ?? 101
  return [...rows].sort(
    (a, b) => key(a) - key(b) || Date.parse(b.startsAt) - Date.parse(a.startsAt),
  )
}

/** "1 min 30 s", "45 s", or a dash when no job succeeded. */
export function formatDuration(seconds: number | null): string {
  // No successful job, no average.
  if (seconds === null) return '–'
  // Whole seconds are enough here.
  const total = Math.round(seconds)
  // Under a minute: seconds only.
  if (total < 60) return `${String(total)} s`
  // Otherwise minutes and seconds.
  return `${String(Math.floor(total / 60))} min ${String(total % 60)} s`
}
