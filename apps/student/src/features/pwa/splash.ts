/**
 * The launch splash screen (decisions D61, D63). index.html draws it before any script runs, so
 * the app opens on the CoNote brand instead of a blank screen; the app hides it once the first
 * page is ready and the splash has been up for a minimum time.
 */

// The splash's ID and timings, shared with components that can't import features.
import { SPLASH_FADE_MS, SPLASH_ID, SPLASH_MIN_MS } from '@/lib/splash'

// Re-exported for callers and tests of this module.
export { SPLASH_FADE_MS, SPLASH_ID, SPLASH_MIN_MS }

/**
 * Waits until the splash has been up for SPLASH_MIN_MS, fades it out, then removes it. Safe to
 * call more than once or when there is none. `elapsedMs` is the time since launch, which
 * performance.now() gives from the start of page load. With reduced motion, index.html's CSS
 * drops the fade, so it simply disappears.
 */
export function hideSplash(doc: Document, elapsedMs = performance.now()) {
  // The splash, if it is still there and not already waiting or on its way out.
  const splash = doc.getElementById(SPLASH_ID)
  if (!splash || splash.dataset.state) return
  // Fades the splash, then removes it.
  const fade = () => {
    // Start the fade (CSS in index.html), and take it out of the accessibility tree at once.
    splash.dataset.state = 'hiding'
    splash.setAttribute('aria-hidden', 'true')
    // Remove it once the fade has finished, so it can't catch taps or focus.
    setTimeout(() => {
      splash.remove()
    }, SPLASH_FADE_MS)
  }
  // The rest of the minimum time; nothing when the app took longer than that to load.
  const wait = SPLASH_MIN_MS - elapsedMs
  // Minimum already reached: fade now.
  if (wait <= 0) {
    fade()
    return
  }
  // Otherwise mark it as scheduled, so a second call doesn't start another timer (the CSS ignores
  // this state), and fade once the wait is over.
  splash.dataset.state = 'waiting'
  setTimeout(fade, wait)
}
