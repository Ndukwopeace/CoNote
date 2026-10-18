/**
 * The context ThemeProvider fills and useTheme reads.
 */

// Creates the context.
import { createContext } from 'react'

// The theme names.
import type { Theme } from '@/lib/theme'

/** What the provider offers. */
export interface ThemeContextValue {
  // The theme in use now.
  theme: Theme
  // Switches to a given theme.
  setTheme: (theme: Theme) => void
  // Switches to the other theme.
  toggle: () => void
}

/** The context; null outside a provider, so useTheme can say what went wrong. */
export const ThemeContext = createContext<ThemeContextValue | null>(null)
