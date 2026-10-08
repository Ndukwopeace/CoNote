/**
 * The dashboard greeting: "Good morning / afternoon / evening, {first name}" (admin REQUIREMENTS
 * section 10).
 */

/** The greeting for the time of day on the administrator's clock. */
export function greeting(now: Date): string {
  // The local hour, 0 to 23.
  const hour = now.getHours()
  // 5:00 to 11:59.
  if (hour >= 5 && hour < 12) return 'Good morning'
  // 12:00 to 17:59.
  if (hour >= 12 && hour < 18) return 'Good afternoon'
  // Evening and night.
  return 'Good evening'
}

/** The first word of a full name, or "" for a blank one. */
export function firstName(fullName: string): string {
  // Split on any run of spaces after trimming, so stray spaces don't matter.
  return fullName.trim().split(/\s+/)[0] ?? ''
}
