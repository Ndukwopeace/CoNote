/**
 * The console's date wording, the same on every screen.
 */

/** "8 Oct 2026" for `iso` on the local calendar, or `fallback` when there is no date. */
export function formatDate(iso: string | null, fallback = '—'): string {
  // No date: the caller's word for it, e.g. "Never".
  if (iso === null) return fallback
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** "A", "A and B", "A, B and C": `items` as a short sentence part. */
export function joinWords(items: readonly string[]): string {
  // Nothing, or one: as it is.
  if (items.length <= 1) return items[0] ?? ''
  // Two or more: commas, then "and" before the last.
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1) ?? ''}`
}
