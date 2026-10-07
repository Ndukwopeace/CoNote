/**
 * Runs before every test file (vitest.config.ts → setupFiles).
 */

// Adds DOM matchers such as toBeInTheDocument() and toHaveClass() to expect().
import '@testing-library/jest-dom/vitest'

// Removes rendered components from the fake DOM.
import { cleanup } from '@testing-library/react'
// Hook that runs after each test, and the fake-function factory.
import { afterEach, vi } from 'vitest'

// jsdom has no layout, so it leaves out scrollIntoView. A recording stand-in lets pages call it
// and lets tests check that they did.
Element.prototype.scrollIntoView = vi.fn()

// Reset shared state after every test so tests can't affect each other.
afterEach(() => {
  // Unmount everything rendered.
  cleanup()
  // Forget stored sessions, drafts and demo data.
  window.localStorage.clear()
  // Same for session storage.
  window.sessionStorage.clear()
})
