/**
 * Checks an address typed into the note editor's link box (FR-NTE-2).
 */

/** Schemes a note link may use. */
const ALLOWED = /^(https?:|mailto:)/i
/** Anything that looks like a scheme ("word:"), e.g. "javascript:". */
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i

/**
 * The address to store, or null if it can't be a link. A bare "example.com" becomes
 * "https://example.com".
 * SECURITY: only http, https and mailto pass, so a link can't be "javascript:" (runs code when
 * clicked) or "data:" (a whole fake page). The sanitiser enforces the same rule on display.
 */
export function normalizeLink(raw: string): string | null {
  // Spaces around a pasted address are noise.
  const value = raw.trim()
  // Nothing typed.
  if (value === '') return null
  // A known safe scheme: keep it.
  if (ALLOWED.test(value)) return value
  // Any other scheme: refuse.
  if (HAS_SCHEME.test(value)) return null
  // No scheme: assume a web address.
  return `https://${value}`
}
