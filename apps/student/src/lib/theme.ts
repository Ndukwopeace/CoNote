/**
 * The light and dark themes (D104): which one a student uses, how the choice is kept on the
 * device, and how it is put on the page. The colours themselves are tokens in
 * packages/ui/src/styles/tokens.css (`:root.dark` overrides the light ones).
 */

// Builds the namespaced storage key.
import { storageKey } from './storage'

/** The two themes. */
export const THEMES = ['light', 'dark'] as const

/** A theme's name. */
export type Theme = (typeof THEMES)[number]

/** What a first visit gets: the light look. The student can switch to dark from the menu. */
export const DEFAULT_THEME: Theme = 'light'

/** Where the choice is kept. Sign-out leaves it alone, because it belongs to the device. */
export const THEME_KEY = storageKey('theme')

/** The part of a storage object that reading needs. */
type ReadableStore = Pick<Storage, 'getItem'>
/** The part of a storage object that saving needs. */
type WritableStore = Pick<Storage, 'setItem'>

/** The colour of the browser's address bar for each theme (light: the brand colour). */
const BAR_COLOURS: Record<Theme, string> = { light: '#4F46E5', dark: '#0b0b10' }

/** Whether a stored value is one of the themes. */
function isTheme(value: unknown): value is Theme {
  // Compares against the list, so nothing else gets through.
  return (THEMES as readonly unknown[]).includes(value)
}

/** The saved theme, or the default when nothing valid is saved. */
export function readTheme(store: ReadableStore): Theme {
  try {
    // The saved text.
    const saved = store.getItem(THEME_KEY)
    // SECURITY: storage can be edited in developer tools; only a known theme is used, so a
    // planted value can't reach the page.
    return isTheme(saved) ? saved : DEFAULT_THEME
  } catch {
    // Some private modes throw when storage is touched; the default still works.
    return DEFAULT_THEME
  }
}

/** Saves the choice. A browser that refuses storage just forgets it at the next visit. */
export function saveTheme(store: WritableStore, theme: Theme) {
  try {
    // One short word, nothing personal.
    store.setItem(THEME_KEY, theme)
  } catch {
    // Not saved; the theme still applies for this visit.
  }
}

/** The other theme, for the one-tap switch. */
export function nextTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark'
}

/**
 * Puts the theme on the page. The class goes on <html>, not on a wrapper, so menus and dialogs
 * that Radix renders at the end of <body> follow it too.
 */
export function applyTheme(theme: Theme, doc: Document) {
  // Dark adds the class that `:root.dark` in tokens.css answers to; light takes it off.
  doc.documentElement.classList.toggle('dark', theme === 'dark')
  // The browser's address bar (phones) follows the theme.
  doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR_COLOURS[theme])
}

/**
 * Puts the saved theme on the page before React starts, so a student who chose dark never sees
 * a white flash while the app loads.
 */
export function applySavedTheme(doc: Document, win: Window) {
  try {
    // Reading `localStorage` is what throws in some private modes.
    applyTheme(readTheme(win.localStorage), doc)
  } catch {
    // Storage is blocked: the page keeps the default look.
  }
}
