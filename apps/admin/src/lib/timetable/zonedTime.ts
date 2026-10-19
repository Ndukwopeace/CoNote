/**
 * Local times in a named time zone (D105). The demo service has no database, so it works out for
 * itself which moment "2026-10-20T08:00 in Africa/Douala" is, using the browser's own zone data.
 * The real database does the same with `at time zone`.
 */

/** How many minutes ahead of UTC `zone` is at the moment `utcMs`. */
function offsetMinutes(utcMs: number, zone: string): number {
  // The wall-clock parts of that moment in the zone.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs))
  const part = (type: string) => Number(parts.find((candidate) => candidate.type === type)?.value)
  // Read those parts as if they were UTC; the difference from the real moment is the offset.
  const wall = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
  )
  return (wall - utcMs) / 60_000
}

/** Whether `zone` is a time zone name the browser knows (aliases such as Africa/Douala included). */
export function isValidTimeZone(zone: string): boolean {
  if (zone === '') return false
  try {
    // The constructor throws for a name it does not know.
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
    return true
  } catch {
    return false
  }
}

/**
 * The moment (as ISO text in UTC) at which the clock in `zone` reads `local`, which is
 * "YYYY-MM-DDTHH:MM". The offset is looked up twice, so a time near a clock change is still right.
 */
export function localToIso(local: string, zone: string): string {
  // The local time read as if it were UTC.
  const asUtc = new Date(`${local}:00.000Z`).getTime()
  // A first guess with the offset at that moment, then the offset at the guess.
  const guess = asUtc - offsetMinutes(asUtc, zone) * 60_000
  return new Date(asUtc - offsetMinutes(guess, zone) * 60_000).toISOString()
}
