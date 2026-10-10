/**
 * Small helpers the admin Supabase services share: making search text safe for a filter, and
 * writing times and names the way the screens expect.
 */

/** `value` as ISO text with a "Z", whatever form the database wrote it in. */
export function iso(value: string): string {
  return new Date(value).toISOString()
}

/** Compares names for sorting, ignoring case and accents. */
export function compareText(a: string, b: string) {
  return a.localeCompare(b, 'en', { sensitivity: 'base' })
}

/**
 * The search text made safe for a filter. Commas and brackets would end a condition early and
 * `%` and `_` are wildcards, so they are replaced by spaces. SECURITY: stops a search from
 * adding conditions of its own to the query.
 */
export function safeSearch(q: string | undefined): string {
  return (q ?? '').replaceAll(/[,()"'\\%_*:]/g, ' ').trim()
}
