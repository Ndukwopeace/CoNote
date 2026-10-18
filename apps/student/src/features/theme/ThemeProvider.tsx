/**
 * Holds the light/dark choice for the whole app (D104): reads it from the device, puts it on
 * <html>, and saves a change.
 */

// React hooks used below, and the children type.
import { useEffect, useMemo, useState, type ReactNode } from 'react'

// The theme rules.
import { applyTheme, nextTheme, readTheme, saveTheme, type Theme } from '@/lib/theme'

// The context this provider fills.
import { ThemeContext, type ThemeContextValue } from './ThemeContext'

/** The browser's storage, or an object that holds nothing where merely touching it throws. */
function deviceStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  try {
    // Reading the property is what throws in some private modes.
    return window.localStorage
  } catch {
    // No saving, but the switch still works for this visit.
    return { getItem: () => null, setItem: () => undefined }
  }
}

/** Provides the theme to everything inside it. */
export function ThemeProvider({ children }: Readonly<{ children: ReactNode }>) {
  // The first render already has the saved theme, so there is no flash of the wrong one.
  const [theme, setTheme] = useState<Theme>(() => readTheme(deviceStorage()))

  // Puts the theme on <html> whenever it changes, and takes it off when the app unmounts.
  useEffect(() => {
    applyTheme(theme, document)
    return () => {
      applyTheme('light', document)
    }
  }, [theme])

  // Stable value, so consumers only re-render when the theme changes.
  const value = useMemo<ThemeContextValue>(() => {
    /** Switches and remembers. */
    function change(next: Theme) {
      // Show it now.
      setTheme(next)
      // Keep it for the next visit.
      saveTheme(deviceStorage(), next)
    }
    return {
      theme,
      setTheme: change,
      toggle: () => {
        change(nextTheme(theme))
      },
    }
  }, [theme])

  return <ThemeContext value={value}>{children}</ThemeContext>
}
