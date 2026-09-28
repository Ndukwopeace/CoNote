/**
 * Runs before every test file (vitest.config.ts → setupFiles).
 */

// Adds DOM matchers such as toBeInTheDocument() and toHaveClass() to expect().
import '@testing-library/jest-dom/vitest'

// Removes rendered components from the fake DOM.
import { cleanup } from '@testing-library/react'
// Hook that runs after each test.
import { afterEach } from 'vitest'

// Reset shared state after every test so tests can't affect each other.
afterEach(() => {
  // Unmount everything rendered.
  cleanup()
  // Forget stored sessions, drafts and demo data.
  window.localStorage.clear()
  // Same for session storage.
  window.sessionStorage.clear()
})
