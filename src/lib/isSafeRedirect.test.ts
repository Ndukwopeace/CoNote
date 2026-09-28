import { describe, expect, it } from 'vitest'

import { isSafeRedirect, safeRedirectTarget } from './isSafeRedirect'

const ORIGIN = 'https://conote.app'

describe('isSafeRedirect', () => {
  it.each(['/dashboard', '/notes/42', '/courses/c1?tab=classes', '/notes#top'])(
    'accepts the same-origin path %s',
    (path) => {
      expect(isSafeRedirect(path, ORIGIN)).toBe(true)
    },
  )

  it.each([
    ['protocol-relative URL', '//evil.com'],
    ['protocol-relative URL with path', '//evil.com/dashboard'],
    ['backslash trick', '/\\evil.com'],
    ['absolute URL', 'https://evil.com'],
    ['same-origin absolute URL', 'https://conote.app/dashboard'],
    ['javascript URL', 'javascript:alert(1)'],
    ['data URL', 'data:text/html,<script>alert(1)</script>'],
    ['relative path without a leading slash', 'dashboard'],
    ['encoded protocol-relative URL', '/%2F%2Fevil.com'],
    ['encoded backslash', '/%5Cevil.com'],
    ['tab inside protocol-relative URL', '/\t/evil.com'],
    ['empty string', ''],
  ])('rejects a %s', (_label, path) => {
    expect(isSafeRedirect(path, ORIGIN)).toBe(false)
  })

  it('rejects null and undefined', () => {
    expect(isSafeRedirect(null, ORIGIN)).toBe(false)
    expect(isSafeRedirect(undefined, ORIGIN)).toBe(false)
  })
})

describe('safeRedirectTarget', () => {
  it('returns the path when it is safe', () => {
    expect(safeRedirectTarget('/notes/42', ORIGIN)).toBe('/notes/42')
  })

  it('falls back to the dashboard when the path is unsafe', () => {
    expect(safeRedirectTarget('//evil.com', ORIGIN)).toBe('/dashboard')
  })

  it('falls back to the dashboard when there is no path', () => {
    expect(safeRedirectTarget(null, ORIGIN)).toBe('/dashboard')
  })
})
