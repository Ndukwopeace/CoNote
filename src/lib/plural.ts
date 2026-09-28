/**
 * Counted nouns for labels such as "48 students" and "1 note".
 */

/** `count` followed by `singular` for 1, otherwise `plural` (by default `singular` + "s"). */
export function countOf(count: number, singular: string, plural = `${singular}s`): string {
  // One takes the singular; zero and everything else take the plural, as in English.
  return `${String(count)} ${count === 1 ? singular : plural}`
}
