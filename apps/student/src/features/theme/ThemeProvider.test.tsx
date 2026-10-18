/**
 * Tests for the theme provider: the starting theme, switching, saving and the class on <html>.
 */

// Render and click helpers.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Vitest building blocks.
import { beforeEach, describe, expect, it } from 'vitest'

// The pieces under test.
import { ThemeProvider } from './ThemeProvider'
import { useTheme } from './useTheme'

/** A button that shows the theme and flips it, standing in for the real switch. */
function Probe() {
  const { theme, toggle } = useTheme()
  return (
    <button type="button" onClick={toggle}>
      {theme}
    </button>
  )
}

describe('ThemeProvider', () => {
  // A clean <html> for each test.
  beforeEach(() => {
    document.documentElement.classList.remove('dark')
  })

  // Proves a first visit is light, with no class on <html>.
  it('starts light and leaves <html> plain', () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )
    expect(screen.getByRole('button', { name: 'light' })).toBeInTheDocument()
    expect(document.documentElement).not.toHaveClass('dark')
  })

  // Proves the saved choice is used from the first paint.
  it('starts with the saved theme', () => {
    window.localStorage.setItem('conote:theme', 'dark')
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )
    expect(screen.getByRole('button', { name: 'dark' })).toBeInTheDocument()
    expect(document.documentElement).toHaveClass('dark')
  })

  // Proves switching changes <html> and is remembered.
  it('switches, applies the class and saves the choice', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'light' }))
    expect(screen.getByRole('button', { name: 'dark' })).toBeInTheDocument()
    expect(document.documentElement).toHaveClass('dark')
    expect(window.localStorage.getItem('conote:theme')).toBe('dark')
    await user.click(screen.getByRole('button', { name: 'dark' }))
    expect(document.documentElement).not.toHaveClass('dark')
    expect(window.localStorage.getItem('conote:theme')).toBe('light')
  })

  // Proves leaving the app takes the class off, so one app's theme can't leak into another page.
  it('takes the class off when it unmounts', () => {
    window.localStorage.setItem('conote:theme', 'dark')
    const { unmount } = render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )
    unmount()
    expect(document.documentElement).not.toHaveClass('dark')
  })
})

describe('useTheme', () => {
  // Proves forgetting the provider fails loudly, like useAuth.
  it('throws outside the provider', () => {
    expect(() => render(<Probe />)).toThrow(/ThemeProvider/)
  })
})
