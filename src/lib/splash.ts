/**
 * Names shared by index.html's launch splash and the code that removes it (decision D61).
 */

/** The splash element's ID in index.html. */
export const SPLASH_ID = 'splash'
/** How long the fade-out takes, matching the CSS transition in index.html. */
export const SPLASH_FADE_MS = 250
/**
 * The shortest time the splash stays up, counted from launch (D63). A fast start would otherwise
 * flash it for a moment; this gives the brand a beat before the app appears.
 */
export const SPLASH_MIN_MS = 1500
