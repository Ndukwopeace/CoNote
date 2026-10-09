/**
 * Helpers for the teacher app's browser tests.
 */

// The browser page type.
import type { Page } from '@playwright/test'

// The shared browser-test helpers (packages/testing).
export {
  expectNoAxeViolationsOnPage as expectNoAxeViolations,
  watchCspViolations,
} from '@conote/testing/playwright'

/** The demo password every demo account shares (src/services/mock/mockAuthService.ts). */
export const DEMO_PASSWORD = 'password1'

/** Fills in and submits the sign-in form as the given demo account. */
export async function signInAs(page: Page, email = 'teacher@conote.example') {
  // Email and password; the password field's "Show password" toggle also matches "Password".
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD)
  // Submit.
  await page.getByRole('button', { name: 'Sign In' }).click()
}
