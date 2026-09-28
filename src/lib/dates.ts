/**
 * Date wording for the portal: the greeting, class dates and times, and relative times.
 * Written by hand rather than with Intl, so the text is identical on every device and in tests.
 */

/** Short weekday names, Sunday first (Date.getDay order). */
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
/** Short month names, January first (Date.getMonth order). */
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

/** "Good morning" from 5 AM, "Good afternoon" from noon, "Good evening" from 5 PM (FR-DSH-1). */
export function greetingFor(now: Date): string {
  // The local hour, 0–23.
  const hour = now.getHours()
  // 5:00–11:59.
  if (hour >= 5 && hour < 12) return 'Good morning'
  // 12:00–16:59.
  if (hour >= 12 && hour < 17) return 'Good afternoon'
  // Evening and the small hours.
  return 'Good evening'
}

/** "28 Sep" for a date. */
function dayAndMonth(date: Date): string {
  // Day of the month, then the short month name.
  return `${date.getDate()} ${MONTHS[date.getMonth()] ?? ''}`
}

/** "Mon 28 Sep" for the day a class starts, in local time. */
export function formatClassDate(startsAt: string): string {
  // The start as a local date.
  const date = new Date(startsAt)
  // Weekday, then day and month.
  return `${WEEKDAYS[date.getDay()] ?? ''} ${dayAndMonth(date)}`
}

/** "9 AM" or "11:30 AM": a 12-hour clock, with minutes only when they aren't zero. */
function clockTime(date: Date): string {
  // 0–23 → 12, 1–11, 12, 1–11.
  const hour = date.getHours() % 12 || 12
  // Minutes, shown only when needed.
  const minutes = date.getMinutes()
  // AM before noon, PM from noon.
  const period = date.getHours() < 12 ? 'AM' : 'PM'
  // "9 AM" or "9:05 AM".
  return minutes === 0
    ? `${hour} ${period}`
    : `${hour}:${String(minutes).padStart(2, '0')} ${period}`
}

/** "9 AM – 11:30 AM" for a class, in local time. */
export function formatClassTime(startsAt: string, endsAt: string): string {
  // Start and end on the 12-hour clock, joined by an en dash.
  return `${clockTime(new Date(startsAt))} – ${clockTime(new Date(endsAt))}`
}

/** Milliseconds in a minute, an hour and a day. */
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * "Just now", "5 min ago", "3 hours ago", "Yesterday", "4 days ago", then the date
 * ("20 Sep") from a week back (FR-DSH-4).
 */
export function formatRelativeTime(iso: string, now: Date): string {
  // How long ago; a time in the future (clock skew) counts as now.
  const elapsed = Math.max(0, now.getTime() - Date.parse(iso))
  // Under a minute.
  if (elapsed < MINUTE) return 'Just now'
  // Under an hour.
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`
  // Under a day.
  if (elapsed < DAY) {
    const hours = Math.floor(elapsed / HOUR)
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  }
  // Whole days ago.
  const days = Math.floor(elapsed / DAY)
  // One day.
  if (days === 1) return 'Yesterday'
  // Up to a week.
  if (days < 7) return `${days} days ago`
  // Older: the date itself.
  return dayAndMonth(new Date(iso))
}
