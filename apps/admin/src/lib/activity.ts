/**
 * Turns event times into one count per local calendar day, for the activity chart (admin
 * REQUIREMENTS section 10). Days follow the administrator's own clock.
 */

// The chart's point shape.
import type { ActivityPoint } from '@/types/dashboard'

/** The local calendar day of `date`, as YYYY-MM-DD. */
export function localDateKey(date: Date): string {
  // Two-digit month and day, so keys sort as text.
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/**
 * One point per day for the `days` days ending today (oldest first), counting the ISO `times`
 * that fall on each. Times outside those days are ignored; days with nothing count 0.
 */
export function dailyCounts(times: readonly string[], now: Date, days: number): ActivityPoint[] {
  // Every day in the range, starting at zero. A Map keeps them in order.
  const counts = new Map<string, number>()
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    // Built from the calendar date, so month ends and clock changes are handled by Date.
    counts.set(localDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset)), 0)
  }
  // Add each event to its day; days outside the range aren't in the map and are skipped.
  for (const time of times) {
    const key = localDateKey(new Date(time))
    const current = counts.get(key)
    if (current !== undefined) counts.set(key, current + 1)
  }
  // The points, oldest first.
  return Array.from(counts, ([date, count]) => ({ date, count }))
}
