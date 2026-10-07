/**
 * End-to-end check for password recovery (milestone A2): forgot password, the reset link, the
 * new password, and that the link works only once.
 */

// Playwright test runner and assertions.
import { expect, test } from '@playwright/test'

// Admin helpers.
import { DEMO_PASSWORD, expectNoAxeViolations, watchCspViolations } from './helpers.ts'

// A new password that meets the admin rules (12+ characters, a letter and a number).
const NEW_PASSWORD = 'new-password-2026'

test('an administrator resets a forgotten password', async ({ page }) => {
  // Watch for Content-Security-Policy breaks throughout.
  const cspViolations = watchCspViolations(page)

  // From sign-in to the forgot-password page.
  await page.goto('/admin/login')
  await page.getByRole('link', { name: 'Forgot password?' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Reset your password' })).toBeVisible()
  await expectNoAxeViolations(page)

  // Ask for a link; the demo offers it on screen instead of by email.
  await page.getByLabel('Email').fill('admin@conote.example')
  await page.getByRole('button', { name: 'Send reset link' }).click()
  const demoLink = page.getByRole('link', { name: 'Continue to reset (demo)' })
  await expect(demoLink).toBeVisible()
  const resetPath = await demoLink.getAttribute('href')
  await demoLink.click()

  // Choose the new password.
  await expect(page.getByRole('heading', { level: 1, name: 'Choose a new password' })).toBeVisible()
  await expectNoAxeViolations(page)
  await page.getByLabel('New password', { exact: true }).fill(NEW_PASSWORD)
  await page.getByLabel('Confirm new password', { exact: true }).fill(NEW_PASSWORD)
  await page.getByRole('button', { name: 'Update password' }).click()

  // Back on sign-in, with the confirmation.
  await expect(page.getByRole('heading', { level: 1, name: 'CoNote Admin' })).toBeVisible()
  await expect(page.getByRole('status')).toHaveText(
    'Your password has been updated. Sign in with your new password.',
  )

  // The old password no longer works.
  await page.getByLabel('Email').fill('admin@conote.example')
  await page.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page.getByRole('alert')).toHaveText('Incorrect email or password.')

  // The new one does.
  await page.getByLabel('Password', { exact: true }).fill(NEW_PASSWORD)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()

  // SECURITY: the used link can't be used again. Sign out first, since sign-in pages send a
  // signed-in admin to the dashboard.
  await page.getByRole('button', { name: 'Account menu for Amara Okafor' }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'CoNote Admin' })).toBeVisible()
  await page.goto(resetPath ?? '/admin/reset-password')
  await expect(page.getByRole('heading', { level: 1, name: 'This link has expired' })).toBeVisible()

  // Nothing was blocked by the policy.
  expect(cspViolations).toEqual([])
})
