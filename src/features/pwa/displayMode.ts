/**
 * Tells the installed app apart from a browser tab (decision D36). The installed app shows only
 * sign-in and the portal; the public landing page belongs to the website.
 */

/** True when CoNote is running as the installed app rather than in a browser tab. */
export function isRunningStandalone(): boolean {
  // Chromium, Firefox and Android report the display mode through a media query. jsdom and very
  // old browsers have no matchMedia, which counts as a browser tab.
  const displayMode =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches
  // iOS home-screen apps set Safari's own flag instead.
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  // Either means installed.
  return displayMode || iosStandalone
}
