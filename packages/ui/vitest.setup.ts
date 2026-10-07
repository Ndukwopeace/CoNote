/**
 * Runs before every @conote/ui test file (vitest.config.ts → setupFiles).
 */

// Matchers such as toBeInTheDocument().
import '@testing-library/jest-dom/vitest'

// Unmounts what a test rendered.
import { cleanup } from '@testing-library/react'
// Hook to run after each test.
import { afterEach } from 'vitest'

// Each test starts with an empty page.
afterEach(() => {
  cleanup()
})
