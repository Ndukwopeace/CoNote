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
