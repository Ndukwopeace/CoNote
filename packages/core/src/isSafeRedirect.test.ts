/**
 * Tests for the open-redirect guard. Every attack shape listed in ENGINEERING_STANDARDS.md 6.2
 * has a case here.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The functions under test.
import { isSafeRedirect, safeRedirectTarget } from './isSafeRedirect'

// A fixed origin, so results don't depend on where the tests run.
const ORIGIN = 'https://conote.app'
// Each app passes its own home page as the fallback; any path will do here.
const HOME = '/home'

describe('isSafeRedirect', () => {
  // Proves normal in-app paths still work, including query strings and fragments.
  it.each(['/dashboard', '/notes/42', '/courses/c1?tab=classes', '/notes#top'])(
    'accepts the same-origin path %s',
    (path) => {
      expect(isSafeRedirect(path, ORIGIN)).toBe(true)
    },
  )

  // SECURITY: proves each known way of escaping to another site is refused.
  it.each([
    // Browsers read "//host" as "go to host".
    ['protocol-relative URL', '//evil.com'],
    // Same, with a path that looks internal.
    ['protocol-relative URL with path', '//evil.com/dashboard'],
    // Browsers treat "\" like "/".
    ['backslash trick', '/\\evil.com'],
    // A full outside address.
    ['absolute URL', 'https://evil.com'],
    // Even our own full address is refused: only relative paths are accepted.
    ['same-origin absolute URL', 'https://conote.app/dashboard'],
    // Would run code.
    ['javascript URL', 'javascript:alert(1)'],
    // Would load a whole fake page.
    ['data URL', 'data:text/html,<script>alert(1)</script>'],
    // Not a path at all.
    ['relative path without a leading slash', 'dashboard'],
    // "//" hidden with percent-encoding.
    ['encoded protocol-relative URL', '/%2F%2Fevil.com'],
    // "\" hidden with percent-encoding.
    ['encoded backslash', '/%5Cevil.com'],
    // Browsers strip the tab, leaving "//evil.com".
    ['tab inside protocol-relative URL', '/\t/evil.com'],
    // Nothing to follow.
    ['empty string', ''],
  ])('rejects a %s', (_label, path) => {
    expect(isSafeRedirect(path, ORIGIN)).toBe(false)
  })

  // Proves a missing ?redirect= parameter is handled.
  it('rejects null and undefined', () => {
    expect(isSafeRedirect(null, ORIGIN)).toBe(false)
    expect(isSafeRedirect(undefined, ORIGIN)).toBe(false)
  })
})

describe('safeRedirectTarget', () => {
  // A safe path is followed as-is.
  it('returns the path when it is safe', () => {
    expect(safeRedirectTarget('/notes/42', ORIGIN, HOME)).toBe('/notes/42')
  })

  // SECURITY: an unsafe path is replaced, never followed.
  it("falls back to the app's home page when the path is unsafe", () => {
    expect(safeRedirectTarget('//evil.com', ORIGIN, HOME)).toBe(HOME)
  })

  // No path means the default destination.
  it("falls back to the app's home page when there is no path", () => {
    expect(safeRedirectTarget(null, ORIGIN, HOME)).toBe(HOME)
  })
})
