/**
 * The text of the unread badge on the top-bar bell (REQUIREMENTS.md section 8).
 */

/** Largest number the badge shows before switching to "9+". */
const MAX_BADGE_COUNT = 9

/**
 * The badge text for `count` unread notifications: null for none, the number up to 9, then
 * "9+". Anything that isn't a positive count shows no badge.
 */
export function formatUnreadCount(count: number): string | null {
  // Whole notifications only; a fractional value from a bad response is rounded down.
  const whole = Math.floor(count)
  // Nothing unread (or nonsense such as a negative number): no badge.
  if (!(whole > 0)) return null
  // Keep the badge small; the exact number is still read out by screen readers.
  return whole > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : String(whole)
}
