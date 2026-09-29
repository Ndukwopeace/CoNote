/**
 * The launch splash screen (decision D61). index.html draws it before any script runs, so the
 * app opens on the CoNote brand instead of a blank screen; the app hides it once the first page
 * is ready.
 */

// The splash's ID and fade time, shared with components that can't import features.
import { SPLASH_FADE_MS, SPLASH_ID } from '@/lib/splash'

// Re-exported for callers and tests of this module.
export { SPLASH_FADE_MS, SPLASH_ID }

/**
 * Fades the splash out, then removes it. Safe to call more than once or when there is none.
 * With reduced motion, index.html's CSS drops the fade, so it simply disappears.
 */
export function hideSplash(doc: Document) {
  // The splash, if it is still there and not already on its way out.
  const splash = doc.getElementById(SPLASH_ID)
  if (!splash || splash.dataset.state === 'hiding') return
  // Start the fade (CSS in index.html), and take it out of the accessibility tree at once.
  splash.dataset.state = 'hiding'
  splash.setAttribute('aria-hidden', 'true')
  // Remove it once the fade has finished, so it can't catch taps or focus.
  setTimeout(() => {
    splash.remove()
  }, SPLASH_FADE_MS)
}
