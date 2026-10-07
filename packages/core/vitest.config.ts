/**
 * Vitest configuration for the @conote/core package's tests. The root vitest.config.ts runs it
 * as one project (D64). The code is plain TypeScript with no DOM, so tests run in Node.
 */

// Typed helper to define the configuration.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // The project's name in test output.
    name: 'core',
    // Plain Node: nothing here touches the page.
    environment: 'node',
    // Test files sit next to the code.
    include: ['src/**/*.test.ts'],
    // Undo vi.spyOn and similar changes after each test.
    restoreMocks: true,
  },
})
