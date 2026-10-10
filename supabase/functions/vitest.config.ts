/**
 * Vitest configuration for the Edge Functions' tests. The root vitest.config.ts runs it as one
 * project (D86). The handlers use only Request, Response and fetch-style APIs, so they run in
 * plain Node.
 */

// Typed helper to define the configuration.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // The project's name in test output.
    name: 'functions',
    // No browser APIs are needed.
    environment: 'node',
    // Test files sit next to the code.
    include: ['**/*.test.ts'],
    // Undo vi.spyOn and similar changes after each test.
    restoreMocks: true,
  },
})
