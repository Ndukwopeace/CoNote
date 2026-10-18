/**
 * Tests for the theme rules: what is read from storage, what is saved, and what goes on <html>.
 */

// Vitest building blocks.
import { beforeEach, describe, expect, it } from 'vitest'

// The functions under test.
import {
  applySavedTheme,
  applyTheme,
  DEFAULT_THEME,
  nextTheme,
  readTheme,
  saveTheme,
  THEME_KEY,
} from './theme'

describe('readTheme', () => {
  // Proves a first visit gets the light look.
  it('starts light when nothing is saved', () => {
    expect(readTheme(window.localStorage)).toBe('light')
    expect(DEFAULT_THEME).toBe('light')
  })

  // Proves a saved choice comes back.
  it('returns the saved choice', () => {
    window.localStorage.setItem(THEME_KEY, 'dark')
    expect(readTheme(window.localStorage)).toBe('dark')
  })

  // SECURITY: storage can be edited in developer tools, so anything unknown is ignored.
  it('ignores a value that is not a theme', () => {
    window.localStorage.setItem(THEME_KEY, '<script>')
    expect(readTheme(window.localStorage)).toBe('light')
  })

  // Proves a browser that refuses storage still gets a theme instead of a crash.
  it('falls back to light when storage throws', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked')
      },
    }
    expect(readTheme(blocked)).toBe('light')
  })
})

describe('saveTheme', () => {
  // Proves the choice is written under the theme key.
  it('writes the choice', () => {
    saveTheme(window.localStorage, 'light')
    expect(window.localStorage.getItem(THEME_KEY)).toBe('light')
  })

  // Proves a browser that refuses storage does not break switching.
  it('does not throw when storage throws', () => {
    const blocked = {
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(() => {
      saveTheme(blocked, 'light')
    }).not.toThrow()
  })
})

describe('nextTheme', () => {
  // Proves the toggle flips between the two themes.
  it('flips light and dark', () => {
    expect(nextTheme('dark')).toBe('light')
    expect(nextTheme('light')).toBe('dark')
  })
})

describe('applyTheme', () => {
  // A clean <html> for each test.
  beforeEach(() => {
    document.documentElement.classList.remove('dark')
    document.head.innerHTML = '<meta name="theme-color" content="#4F46E5">'
  })

  // Proves dark puts the class on <html> and colours the browser bar to match.
  it('adds the dark class and colours the browser bar', () => {
    applyTheme('dark', document)
    expect(document.documentElement).toHaveClass('dark')
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#0b0b10')
  })

  // Proves light takes the class off again.
  it('removes the dark class for light', () => {
    applyTheme('dark', document)
    applyTheme('light', document)
    expect(document.documentElement).not.toHaveClass('dark')
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#4F46E5')
  })
})

describe('applySavedTheme', () => {
  // A clean <html> for each test.
  beforeEach(() => {
    document.documentElement.classList.remove('dark')
  })

  // Proves a saved dark choice reaches <html> before the app renders.
  it('applies the saved theme', () => {
    window.localStorage.setItem(THEME_KEY, 'dark')
    applySavedTheme(document, window)
    expect(document.documentElement).toHaveClass('dark')
  })

  // Proves a browser where touching storage throws still starts the app.
  it('does not throw when storage is blocked', () => {
    const blocked = {
      get localStorage(): Storage {
        throw new Error('blocked')
      },
    } as unknown as Window
    expect(() => {
      applySavedTheme(document, blocked)
    }).not.toThrow()
  })
})
