/**
 * Test helper: makes the page look as if it runs as the installed app (display-mode:
 * standalone), or in a normal browser tab. jsdom has no matchMedia, so tests install one.
 */

/** Installs a matchMedia that answers the standalone query with `standalone`. */
export function setStandalone(standalone: boolean) {
  // Replace (or create) window.matchMedia for this test.
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      // Only the display-mode query can match.
      matches: standalone && query === '(display-mode: standalone)',
      media: query,
      onchange: null,
      // The listener methods exist but never fire; the display mode doesn't change mid-test.
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  })
}

/** Removes the test matchMedia, back to jsdom's default (none). */
export function resetDisplayMode() {
  // Deleting the property restores "no matchMedia", as in plain jsdom.
  Reflect.deleteProperty(window, 'matchMedia')
}
