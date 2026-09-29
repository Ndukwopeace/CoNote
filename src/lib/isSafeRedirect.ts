/**
 * Checks the `?redirect=` value the sign-in page receives before the app follows it.
 * Used by RedirectIfSignedIn after a student signs in (ENGINEERING_STANDARDS.md 6.2).
 */

// The route table, so the fallback destination is not a hard-coded string.
import { ROUTES } from './routes'

/**
 * True when the text contains an invisible control character (tab, newline, NUL, DEL…).
 * SECURITY: browsers silently strip tabs and newlines from URLs, so "/\t/evil.com" turns into
 * "//evil.com" and leaves the site. Rejecting control characters closes that trick.
 */
function hasControlCharacter(value: string) {
  // Look at each character one by one.
  for (const char of value) {
    // Get the character's code point so it can be compared against the control range.
    // `for…of` yields whole characters, so there is always a first code point.
    const code = char.codePointAt(0) ?? 0
    // Codes below 0x20 are control characters; 0x7f is DEL. Either one means "unsafe".
    if (code < 0x20 || code === 0x7f) return true
  }
  // No control character found.
  return false
}

/**
 * True when a path starts like "//host" or "/\host".
 * SECURITY: browsers read both as "go to another website" (a protocol-relative URL), so they
 * are the classic way to smuggle an outside address into a redirect that looks internal.
 */
function looksProtocolRelative(path: string) {
  // "//" is protocol-relative by definition; "/\" is treated the same way by most browsers.
  return path.startsWith('//') || path.startsWith('/\\')
}

/**
 * True only for a relative path that stays on `origin`.
 * SECURITY: blocks open redirects. Without it, an attacker could send a student a genuine
 * CoNote sign-in link that forwards them to a look-alike site right after they log in, where
 * they would be asked for their password again.
 */
export function isSafeRedirect(path: string | null | undefined, origin: string): path is string {
  // SECURITY: only paths starting with "/" are allowed. This rejects "https://evil.com",
  // "javascript:alert(1)", "data:…" and empty values in one check.
  if (!path?.startsWith('/')) return false
  // SECURITY: reject "//evil.com", "/\evil.com" and paths hiding control characters.
  if (looksProtocolRelative(path) || hasControlCharacter(path)) return false

  // Holds the path after percent-decoding, declared here so the try block can fill it.
  let decoded: string
  try {
    // SECURITY: decode "%2F%2Fevil.com" into "//evil.com" so encoded tricks are checked too.
    decoded = decodeURIComponent(path)
  } catch {
    // A malformed escape such as "%E0%A4%A" cannot be decoded; treat it as unsafe.
    return false
  }
  // SECURITY: run the same two checks on the decoded form.
  if (looksProtocolRelative(decoded) || hasControlCharacter(decoded)) return false

  try {
    // SECURITY: final check with the browser's own URL parser. If resolving the path against
    // our origin lands anywhere else, it is not a safe redirect.
    return new URL(path, origin).origin === origin
  } catch {
    // Anything the URL parser rejects is unsafe.
    return false
  }
}

/** The path to go to after sign-in: the requested one if safe, otherwise the dashboard. */
export function safeRedirectTarget(path: string | null | undefined, origin: string) {
  // SECURITY: an unsafe or missing path never gets followed; the student lands on the dashboard.
  return isSafeRedirect(path, origin) ? path : ROUTES.dashboard
}
