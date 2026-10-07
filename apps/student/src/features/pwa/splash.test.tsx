/**
 * Tests for the launch splash screen (decisions D61, D63): it stays up for a minimum time, hides
 * once the first page is ready, and never stays over a working app.
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
import { hideSplash, SPLASH_FADE_MS, SPLASH_ID, SPLASH_MIN_MS } from './splash'

/** Puts a splash element in the page, as index.html does. */
function addSplash() {
  const splash = document.createElement('div')
  splash.id = SPLASH_ID
  document.body.append(splash)
  return splash
}

// Each test starts without a splash, and with the app open past the minimum time (D63), so
// the in-app tests check readiness only.
beforeEach(() => {
  document.getElementById(SPLASH_ID)?.remove()
  vi.spyOn(performance, 'now').mockReturnValue(SPLASH_MIN_MS)
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

    // Act: the app has already been open for the minimum time.
    hideSplash(document, SPLASH_MIN_MS)

    // Assert: fading, and hidden from screen readers at once.
    expect(splash).toHaveAttribute('data-state', 'hiding')
    expect(splash).toHaveAttribute('aria-hidden', 'true')
    vi.advanceTimersByTime(SPLASH_FADE_MS)
    expect(document.getElementById(SPLASH_ID)).toBeNull()
  })

  // D63: proves a fast start still shows the splash for the minimum time before the fade.
  it('stays up until the minimum time has passed', () => {
    // Arrange.
    vi.useFakeTimers()
    const splash = addSplash()

    // Act: the page is ready 300 ms after launch.
    hideSplash(document, 300)

    // Assert: still fully shown just before the minimum...
    vi.advanceTimersByTime(SPLASH_MIN_MS - 300 - 1)
    expect(splash).not.toHaveAttribute('data-state', 'hiding')
    expect(splash).not.toHaveAttribute('aria-hidden')
    // ...fading once it is reached...
    vi.advanceTimersByTime(1)
    expect(splash).toHaveAttribute('data-state', 'hiding')
    // ...and gone after the fade.
    vi.advanceTimersByTime(SPLASH_FADE_MS)
    expect(document.getElementById(SPLASH_ID)).toBeNull()
  })

  // Proves a second call while the splash waits doesn't start a second timer.
  it('ignores a second call while waiting', () => {
    // Arrange.
    vi.useFakeTimers()
    addSplash()

    // Act: called twice during the wait.
    hideSplash(document, 0)
    hideSplash(document, 0)

    // Assert: exactly one timer is pending.
    expect(vi.getTimerCount()).toBe(1)
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
