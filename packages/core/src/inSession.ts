/**
 * Whether a course has a class going on right now (D120). The screens show "Ongoing" for a course
 * only then, and show nothing otherwise, so no "Upcoming" or "Completed" can go out of date.
 */

/** The start and end of one class, as ISO 8601 text. */
export interface ClassWindow {
  startsAt: string
  endsAt: string
}

/**
 * True when `now` falls inside any of the classes: at or after its start, and before its end, so
 * two classes back to back are never both going on. A class whose times cannot be read is skipped.
 */
export function isInSession(classes: readonly ClassWindow[], now: Date): boolean {
  // The moment to test, as a number.
  const at = now.getTime()
  return classes.some((window) => {
    // Unreadable text gives NaN, and every comparison with NaN is false, so the class is skipped.
    const start = Date.parse(window.startsAt)
    const end = Date.parse(window.endsAt)
    return start <= at && at < end
  })
}
