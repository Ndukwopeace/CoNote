/**
 * Tests for the build step that moves the app's stylesheet into index.html (D62), so the launch
 * splash paints as soon as the page arrives instead of after a separate CSS download.
 */

// Test helpers.
import { describe, expect, it } from 'vitest'

// The function under test.
import { inlineStylesheets } from './inlineStylesheets'

/** A page shaped like Vite's build output: the stylesheet link sits in the head. */
const PAGE =
  '<head><style>#splash{}</style><link rel="stylesheet" crossorigin href="/assets/index-abc.css"></head><body></body>'

describe('inlineStylesheets', () => {
  it('replaces a stylesheet link with the stylesheet itself', () => {
    // The build knows this stylesheet's content.
    const result = inlineStylesheets(PAGE, (href) =>
      href === '/assets/index-abc.css' ? 'body{color:red}' : undefined,
    )
    // The link is gone and the rules sit in a <style> in its place.
    expect(result.html).toBe(
      '<head><style>#splash{}</style><style>body{color:red}</style></head><body></body>',
    )
    // The caller learns which file was inlined, so it can drop it from the build.
    expect(result.inlined).toEqual(['/assets/index-abc.css'])
  })

  it('leaves a link alone when its stylesheet is not part of the build', () => {
    // Nothing is known about this address.
    const result = inlineStylesheets(PAGE, () => undefined)
    // The page is unchanged and nothing is reported as inlined.
    expect(result.html).toBe(PAGE)
    expect(result.inlined).toEqual([])
  })

  it('ignores links that are not stylesheets', () => {
    // An icon link has an href but must never be touched.
    const page = '<link rel="icon" href="/favicon.svg">'
    const result = inlineStylesheets(page, () => 'svg{}')
    expect(result.html).toBe(page)
  })

  it('refuses a stylesheet that would end the <style> element early', () => {
    // "</style" inside the rules would close the element and turn the rest into page content.
    expect(() => inlineStylesheets(PAGE, () => 'a{content:"</style>"}')).toThrow(/<\/style/)
  })

  it('refuses a stylesheet with relative url() paths', () => {
    // Moved into index.html, "./font.woff2" would resolve against the page instead of /assets/.
    expect(() => inlineStylesheets(PAGE, () => '@font-face{src:url(./font.woff2)}')).toThrow(
      /relative/,
    )
  })
})
