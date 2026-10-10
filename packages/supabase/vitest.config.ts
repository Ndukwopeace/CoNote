/**
 * Vitest configuration for the @conote/supabase package's tests. The root vitest.config.ts runs it
 * as one project (D64). Nothing here touches a real page, so tests run in jsdom only for the
 * storage tests that need `localStorage`; everything else is plain TypeScript.
 */

// Typed helper to define the configuration.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // The project's name in test output.
    name: 'supabase',
    // jsdom provides localStorage and sessionStorage for the storage adapter's tests.
    environment: 'jsdom',
    // Test files sit next to the code.
    include: ['src/**/*.test.ts'],
    // Undo vi.spyOn and similar changes after each test.
    restoreMocks: true,
  },
})
