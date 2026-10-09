/**
 * Vitest configuration for the @conote/portal package's tests. The root vitest.config.ts runs it
 * as one project (D64, D77).
 */

// Typed helper to define the configuration.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // The project's name in test output.
    name: 'portal',
    // A simulated browser (DOM) for component tests.
    environment: 'jsdom',
    // Adds DOM matchers and cleans up after each test.
    setupFiles: ['./vitest.setup.ts'],
    // Test files sit next to the code.
    include: ['src/**/*.test.{ts,tsx}'],
    // Undo vi.spyOn and similar changes after each test.
    restoreMocks: true,
  },
})
