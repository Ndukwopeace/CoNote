/**
 * The common setup for component tests in every CoNote app and package (D64): DOM matchers,
 * cleanup, and fresh storage for each test. Each project's own setup file imports it.
 */

// Adds DOM matchers such as toBeInTheDocument() and toHaveClass() to expect().
import '@testing-library/jest-dom/vitest'

// Removes rendered components from the fake DOM, and sets how long findBy and waitFor wait.
import { cleanup, configure } from '@testing-library/react'
// Hook that runs after each test, and the fake-function factory.
import { afterEach, vi } from 'vitest'

// findBy and waitFor give up after 3 seconds instead of 1. Page tests render whole screens in
// jsdom, and CI runs them with coverage on shared machines at about half local speed; a failing
// check still fails, only a little later.
configure({ asyncUtilTimeout: 3000 })

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
