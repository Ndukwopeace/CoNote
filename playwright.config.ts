import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const isCI = Boolean(process.env.CI)

/**
 * PW_CHROMIUM_PATH lets a machine with a preinstalled Chromium use it instead of
 * downloading Playwright's own build. CI installs the matching browser and leaves it unset.
 */
const executablePath = process.env.PW_CHROMIUM_PATH

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: 0,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        ...(executablePath ? { launchOptions: { executablePath } } : {}),
      },
    },
    {
      name: 'phone',
      use: {
        ...devices['Pixel 7'],
        ...(executablePath ? { launchOptions: { executablePath } } : {}),
      },
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !isCI,
    timeout: 180_000,
  },
})
