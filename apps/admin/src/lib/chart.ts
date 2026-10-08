/**
 * The activity chart's scale and labels: round axis values, and readable dates.
 */

/** The axis: its top value and the gridline values from 0 up to it. */
export interface Scale {
  top: number
  ticks: number[]
}

/** The smallest axis top, so a quiet day doesn't look like a cliff. */
const MIN_TOP = 4

/** The first of 1, 2, 5 and 10 at or above `normalized` (a number from 1 to 10). */
function stepFactor(normalized: number): number {
  return [1, 2, 5].find((factor) => normalized <= factor) ?? 10
}

/**
 * A round axis for values up to `max`: about five steps of 1, 2 or 5 times a power of ten,
 * ending at the first step at or above `max`.
 */
export function niceScale(max: number): Scale {
  // Never smaller than the minimum.
  const value = Math.max(max, MIN_TOP)
  // A rough step for about five intervals, and its power of ten.
  const rough = value / 5
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const normalized = rough / magnitude
  // Round the step up to 1, 2, 5 or 10 times the power of ten; never below 1, as counts are whole.
  const step = Math.max(1, stepFactor(normalized) * magnitude)
  // The first step at or above the value.
  const top = Math.ceil(value / step) * step
  // Every step from 0 to the top.
  const ticks = Array.from({ length: top / step + 1 }, (_, index) => index * step)
  return { top, ticks }
}

/** The local date for a YYYY-MM-DD key (not UTC, which can shift it by a day). */
function fromKey(key: string): Date {
  // Split into numbers; months count from 0.
  const [year = 0, month = 1, day = 1] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** "7 Oct": for the axis. */
export function shortDayLabel(key: string): string {
  return fromKey(key).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/**
 * "Wed 7 Oct": for the tooltip and the table. Built from two parts because browsers disagree on
 * the comma after the weekday when it is formatted in one go.
 */
export function dayLabel(key: string): string {
  // The short weekday name.
  const weekday = fromKey(key).toLocaleDateString('en-GB', { weekday: 'short' })
  return `${weekday} ${shortDayLabel(key)}`
}
