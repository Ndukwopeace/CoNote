/**
 * Which of the four course accent colours a course uses (REQUIREMENTS.md 6.1).
 */

/** One of the accent tokens --accent-1 to --accent-4. */
export type CourseAccent = 1 | 2 | 3 | 4

/**
 * A stable accent for a course, from a small hash of its ID, so its colour never changes.
 * The hash is the sum of the character codes: simple, and it gives the four demo courses four
 * different colours.
 */
export function courseAccent(courseId: string): CourseAccent {
  // Running total of character codes.
  let hash = 0
  // Add each character's code.
  for (const char of courseId) hash += char.charCodeAt(0)
  // Map onto 1–4. The cast is safe: the remainder is 0–3.
  return ((hash % 4) + 1) as CourseAccent
}
