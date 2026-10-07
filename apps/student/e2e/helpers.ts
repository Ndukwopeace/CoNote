/**
 * Shared helpers for the Playwright browser tests.
 */

// Assertions and the browser page type.
import { expect, type Page } from '@playwright/test'

// The shared browser-test helpers (packages/testing).
import { expectNoAxeViolationsOnPage, watchCspViolations } from '@conote/testing/playwright'

// Re-exported, so the student tests keep importing every helper from here.
export { watchCspViolations }

/**
 * Runs axe on the settled page (shared helper), after the launch splash (D61) has faded and gone,
 * since axe would otherwise measure text through the half-transparent overlay.
 */
export async function expectNoAxeViolations(page: Page) {
  // Wait for the splash to leave.
  await expect(page.locator('#splash')).toHaveCount(0)
  // Then scan.
  await expectNoAxeViolationsOnPage(page)
}

/** Fills in and submits the sign-in form with demo credentials. */
export async function signIn(page: Page, { remember = true } = {}) {
  // Email.
  await page.getByLabel('Email address').fill('victory@example.com')
  // Password.
  await page.getByLabel('Password', { exact: true }).fill('password1')
  // Tick "Remember me" unless the test says otherwise.
  if (remember) await page.getByLabel('Remember me').check()
  // Submit.
  await page.getByRole('button', { name: 'Sign in' }).click()
}

/** The primary navigation visible at the current screen size. */
export function primaryNav(page: Page, isMobile: boolean) {
  // Phones use the bottom bar; larger screens use the sidebar.
  return page.getByRole('navigation', { name: isMobile ? 'Quick navigation' : 'Main navigation' })
}
