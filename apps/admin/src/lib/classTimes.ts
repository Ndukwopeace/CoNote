/**
 * A class's date and times: the form's local date and 24-hour times, stored as ISO instants, and
 * the wording the screens use.
 */

/** A local `date` (YYYY-MM-DD) and `time` (HH:MM) as an ISO instant. */
export function toIso(date: string, time: string): string {
  // Parse the parts so the browser's own time zone applies, never UTC.
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number)
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  return new Date(year, month - 1, day, hours, minutes).toISOString()
}

/** `n` as two digits. */
const two = (n: number) => String(n).padStart(2, '0')

/** The local date of `iso`, as YYYY-MM-DD. */
export function toDateInput(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getFullYear())}-${two(d.getMonth() + 1)}-${two(d.getDate())}`
}

/** The local time of `iso`, as HH:MM. */
export function toTimeInput(iso: string): string {
  const d = new Date(iso)
  return `${two(d.getHours())}:${two(d.getMinutes())}`
}

/** "09:00" for the local time of `iso`. */
export function formatTime(iso: string): string {
  return toTimeInput(iso)
}

/** "09:00–10:30" for a class from `startsAt` to `endsAt`. */
export function formatTimeRange(startsAt: string, endsAt: string): string {
  return `${formatTime(startsAt)}–${formatTime(endsAt)}`
}
