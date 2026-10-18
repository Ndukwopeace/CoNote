/**
 * The hook components use to read the theme and change it.
 */

// React 19's `use` reads a context value.
import { use } from 'react'

// The context filled by ThemeProvider.
import { ThemeContext } from './ThemeContext'

/** Returns the theme and the ways to change it. Throws if called outside ThemeProvider. */
export function useTheme() {
  // Read the nearest ThemeProvider's value.
  const value = use(ThemeContext)
  // A missing provider is a programming mistake; say how to fix it.
  if (!value) throw new Error('useTheme must be used inside <ThemeProvider>')
  // Hand back the theme and actions.
  return value
}
