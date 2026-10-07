/**
 * Vitest configuration for the student app's unit and component tests. Builds on vite.config.ts,
 * so tests resolve imports exactly like the app does. The root vitest.config.ts runs it as one
 * project and owns the coverage settings (D64).
 */

// Typed helpers to define and merge configuration.
import { defineConfig, mergeConfig } from 'vitest/config'

// The app's Vite configuration (plugins and the "@" alias).
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // The project's name in test output.
      name: 'student',
      // describe/it/expect are available without importing (files still import them explicitly).
      globals: true,
      // A simulated browser (DOM) for component tests.
      environment: 'jsdom',
      // Runs before every test file: adds DOM matchers and resets state.
      setupFiles: ['./src/test/setup.ts'],
      // Only files ending in .test.ts or .test.tsx under src/ are tests (e2e/ is Playwright's).
      include: ['src/**/*.test.{ts,tsx}'],
      // Undo vi.spyOn and similar changes after each test, so tests can't leak into each other.
      restoreMocks: true,
    },
  }),
)
