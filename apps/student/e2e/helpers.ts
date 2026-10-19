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
  // A drawer that is still sliding shut keeps the page behind it hidden from screen readers, so
  // let it finish before scanning.
  await expect(page.locator('[role="dialog"][data-state="closed"]')).toHaveCount(0)
  // Colours fade between themes (and on hover); axe would measure a half-faded colour and report
  // a contrast failure that is not there once settled, so wait for every colour transition to end.
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => !(animation instanceof CSSTransition)),
  )
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

/**
 * The shared navigation (D104), the same on every page: the sidebar on larger screens; on phones
 * the drawer, opened here from the menu button. There is no bottom bar.
 */
export async function mainNav(page: Page, isMobile: boolean) {
  // Phones: open the drawer first.
  if (isMobile) await page.getByRole('button', { name: 'Open menu' }).click()
  // The navigation named "Main" (inside the drawer on phones).
  return page.getByRole('navigation', { name: 'Main' })
}
