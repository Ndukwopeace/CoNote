/**
 * Vitest configuration for unit and component tests. Builds on vite.config.ts, so tests resolve
 * imports exactly like the app does.
 */

// Typed helpers to define and merge configuration.
import { defineConfig, mergeConfig } from 'vitest/config'

// The app's Vite configuration (plugins and the "@" alias).
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
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
      coverage: {
        // Use V8's built-in coverage (fast, no code instrumentation).
        provider: 'v8',
        // Terminal summary, a browsable HTML report, and lcov for other tools.
        reporter: ['text', 'html', 'lcov'],
        // ENGINEERING_STANDARDS.md section 2.6: the floor applies to logic folders only.
        include: ['src/services/**', 'src/hooks/**', 'src/lib/**', 'src/features/**'],
        // Tests, shared contracts, pure type files and seed data aren't logic to cover.
        exclude: ['**/*.test.{ts,tsx}', '**/*.contract.ts', '**/types.ts', '**/seed/**'],
        // CI fails if line or branch coverage drops below 80%.
        thresholds: { lines: 80, branches: 80 },
      },
    },
  }),
)
