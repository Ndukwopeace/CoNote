/**
 * Root Vitest configuration (D64): runs every app's tests as one suite, so `npm test` and
 * `vitest related` work from the repository root, and measures coverage across all of them.
 * Each app keeps its own test settings in its own vitest.config.ts.
 */

// Typed helper to define the configuration.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Each app, and each package with tests, is a project with its own config (environment,
    // setup files, aliases).
    projects: ['apps/*/vitest.config.ts', 'packages/*/vitest.config.ts'],
    coverage: {
      // Use V8's built-in coverage (fast, no code instrumentation).
      provider: 'v8',
      // Terminal summary, a browsable HTML report, and lcov for SonarCloud.
      reporter: ['text', 'html', 'lcov'],
      // ENGINEERING_STANDARDS.md section 2.6: the floor applies to each app's logic folders and
      // to the shared logic in packages/core and the staff-portal logic in packages/portal (auth, lib).
      include: [
        'packages/core/src/**',
        'packages/supabase/src/**',
        'packages/portal/src/auth/**',
        'packages/portal/src/lib/**',
        'apps/*/src/services/**',
        'apps/*/src/hooks/**',
        'apps/*/src/lib/**',
        'apps/*/src/features/**',
      ],
      // Tests, shared contracts, pure type files and seed data aren't logic to cover.
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.contract.ts',
        '**/types.ts',
        '**/seed/**',
        // Test double and thin wiring of the Supabase SDK, covered by the integration run in CI.
        '**/fakeSupabase.ts',
        '**/fakeTables.ts',
        '**/integrationSupport.ts',
        'packages/supabase/src/client.ts',
      ],
      // CI fails if line or branch coverage drops below 80%.
      thresholds: { lines: 80, branches: 80 },
    },
  },
})
