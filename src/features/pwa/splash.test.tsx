/**
 * Tests for the launch splash screen (decision D61): it hides once the first page is ready, and
 * never stays over a working app.
 */

// Queries and waiting.
import { screen, waitFor } from '@testing-library/react'
// Vitest building blocks.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The real route table.
import { routes } from '@/app/routes'
// Session factory.
import { makeSession } from '@/test/factories'
// Render helper.
import { renderWithRouter } from '@/test/renderWithRouter'

// The unit under test.
import { hideSplash, SPLASH_FADE_MS, SPLASH_ID } from './splash'

/** Puts a splash element in the page, as index.html does. */
function addSplash() {
  const splash = document.createElement('div')
  splash.id = SPLASH_ID
  document.body.append(splash)
  return splash
}

// Each test starts without a splash.
beforeEach(() => {
  document.getElementById(SPLASH_ID)?.remove()
})

// Real timers again.
afterEach(() => {
  vi.useRealTimers()
})

describe('hideSplash', () => {
  // Proves the splash fades, then leaves the page entirely.
  it('fades the splash out, then removes it', () => {
    // Arrange.
    vi.useFakeTimers()
    const splash = addSplash()

    // Act.
    hideSplash(document)

    // Assert: fading, and hidden from screen readers at once.
    expect(splash).toHaveAttribute('data-state', 'hiding')
    expect(splash).toHaveAttribute('aria-hidden', 'true')
    vi.advanceTimersByTime(SPLASH_FADE_MS)
    expect(document.getElementById(SPLASH_ID)).toBeNull()
  })

  // Proves calling it again, or with no splash, is harmless.
  it('does nothing when there is no splash', () => {
    expect(() => {
      hideSplash(document)
      hideSplash(document)
    }).not.toThrow()
  })
})

describe('splash in the app', () => {
  // Proves the app hides the splash once sign-in is known and the first page is shown.
  it('hides once the first page is ready', async () => {
    // Arrange.
    addSplash()

    // Act.
    renderWithRouter({ routes, path: '/dashboard', session: makeSession() })

    // Assert.
    await screen.findByRole('heading', { level: 1 })
    await waitFor(() => {
      expect(document.getElementById(SPLASH_ID)).toBeNull()
    })
  })

  // Proves a public page hides it too, for visitors who aren't signed in.
  it('hides on a public page', async () => {
    // Arrange.
    addSplash()

    // Act.
    renderWithRouter({ routes, path: '/login' })

    // Assert.
    await screen.findByRole('heading', { level: 1, name: 'Welcome back' })
    await waitFor(() => {
      expect(document.getElementById(SPLASH_ID)).toBeNull()
    })
  })
})
