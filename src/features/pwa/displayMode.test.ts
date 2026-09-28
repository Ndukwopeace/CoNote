/**
 * Tests for telling the installed app apart from a browser tab (decision D36).
 */

// Vitest building blocks.
import { afterEach, describe, expect, it, vi } from 'vitest'

// Test helpers that fake the display mode.
import { resetDisplayMode, setStandalone } from '@/test/displayMode'

// The unit under test.
import { isRunningStandalone } from './displayMode'

// Back to a plain browser after each test.
afterEach(() => {
  resetDisplayMode()
  vi.restoreAllMocks()
})

describe('isRunningStandalone', () => {
  // Proves a normal browser tab is not the installed app.
  it('is false in a browser tab', () => {
    setStandalone(false)
    expect(isRunningStandalone()).toBe(false)
  })

  // Proves Chrome, Edge and Android report the installed app through the media query.
  it('is true when the display mode is standalone', () => {
    setStandalone(true)
    expect(isRunningStandalone()).toBe(true)
  })

  // Proves iOS home-screen apps are recognised through Safari's own flag.
  it('is true for an iOS home-screen app', () => {
    // No matchMedia answer, but iOS sets navigator.standalone.
    Object.defineProperty(navigator, 'standalone', { configurable: true, value: true })
    expect(isRunningStandalone()).toBe(true)
    Reflect.deleteProperty(navigator, 'standalone')
  })

  // Proves a browser without matchMedia (jsdom, very old browsers) counts as a browser tab.
  it('is false when matchMedia is missing', () => {
    expect(isRunningStandalone()).toBe(false)
  })
})
