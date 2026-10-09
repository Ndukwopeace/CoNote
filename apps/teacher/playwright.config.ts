/**
 * Playwright configuration for the teacher app's browser (end-to-end) tests in e2e/. It uses its own
 * port, so it can run next to the student app's tests.
 */

// Typed config helper and ready-made device profiles.
import { defineConfig, devices } from '@playwright/test'

// Port for the preview server the tests visit.
const PORT = 4175
// True in GitHub Actions, which sets CI=true.
const isCI = Boolean(process.env.CI)

/**
 * PW_CHROMIUM_PATH lets a machine with a preinstalled Chromium use it instead of
 * downloading Playwright's own build. CI installs the matching browser and leaves it unset.
 */
const executablePath = process.env.PW_CHROMIUM_PATH

export default defineConfig({
  // Where the tests live.
  testDir: './e2e',
  // Run tests in parallel for speed; each has its own browser context.
  fullyParallel: true,
  // In CI, a leftover test.only fails the run instead of silently skipping the other tests.
  forbidOnly: isCI,
  // No automatic retries: a failure is treated as real (ENGINEERING_STANDARDS.md 2).
  retries: 0,
  // Annotations on the PR plus an HTML report in CI; a simple list locally.
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    // Tests can write page.goto('/') instead of the full address.
    baseURL: `http://localhost:${PORT}`,
    // Keep a step-by-step trace only when a test fails, for debugging.
    trace: 'retain-on-failure',
  },
  // Every test runs on both screen types.
  projects: [
    {
      // Desktop Chrome, 1280 × 720.
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        ...(executablePath ? { launchOptions: { executablePath } } : {}),
      },
    },
    {
      // A Pixel 7 phone: small screen, touch, mobile user agent.
      name: 'phone',
      use: {
        ...devices['Pixel 7'],
        ...(executablePath ? { launchOptions: { executablePath } } : {}),
      },
    },
  ],
  webServer: {
    // Build for production, then serve it with the production security headers.
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    // Wait until this port answers before starting the tests.
    port: PORT,
    // Locally, reuse an already-running server; in CI, always start fresh.
    reuseExistingServer: !isCI,
    // Allow three minutes for the build.
    timeout: 180_000,
  },
})
