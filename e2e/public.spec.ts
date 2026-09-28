/**
 * M2 browser tests (docs/MILESTONES.md): the public pages and the account flows, against the
 * production build with the production security headers. Each runs on desktop and on a phone.
 */

// Playwright's assertions and test function.
import { expect, test } from '@playwright/test'

// Shared helpers.
import { expectNoAxeViolations, watchCspViolations } from './helpers.ts'

// M2's "done when": a new visitor goes from the landing page through sign-up to the dashboard.
test('a new visitor signs up from the landing page and reaches the dashboard', async ({ page }) => {
  // Start collecting CSP violations before anything loads.
  const cspViolations = watchCspViolations(page)

  // Landing page, checked for accessibility with every section rendered.
  await page.goto('/')
  await expect(
    page.getByRole('heading', { level: 1, name: /Your notes\. Collective understanding\./ }),
  ).toBeVisible()
  await expectNoAxeViolations(page)

  // The closing call to action goes to sign-up.
  await page.getByRole('link', { name: 'Create Free Account' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Create your account' })).toBeVisible()
  await expectNoAxeViolations(page)

  // Submitting empty shows the inline errors, and they are accessible too.
  await page.getByRole('button', { name: 'Sign up' }).click()
  await expect(page.getByText('Enter your full name.')).toBeVisible()
  await expectNoAxeViolations(page)

  // Fill in the form properly.
  await page.getByLabel('Full name').fill('Ada Obi')
  await page.getByLabel('Email address').fill('ada@example.com')
  await page.getByLabel('Password', { exact: true }).fill('password1')
  await page.getByLabel('Confirm password').fill('password1')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Sign up' }).click()

  // Arrives on the dashboard, greeted by the new name.
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByText(/Welcome, Ada/)).toBeVisible()

  // SECURITY: the whole journey ran without the security policy blocking anything.
  expect(cspViolations).toEqual([])
})

// FR-AUTH-4, FR-AUTH-5 and FR-AUTH-7: forgot, the demo link, a new password, then sign in.
test('a student resets a forgotten password with the demo link', async ({ page }) => {
  // From sign in to the forgot page.
  await page.goto('/login')
  await page.getByRole('link', { name: 'Forgot password?' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Reset your password' })).toBeVisible()

  // Ask for a link: the generic answer and the demo shortcut.
  await page.getByLabel('Email address').fill('victory@example.com')
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await expect(page.getByRole('status')).toHaveText(
    'If an account exists for that email, we sent a reset link.',
  )
  await expectNoAxeViolations(page)
  await page.getByRole('link', { name: 'Continue to reset (demo)' }).click()

  // Choose a new password.
  await expect(page.getByRole('heading', { level: 1, name: 'Choose a new password' })).toBeVisible()
  // Keep the link, to try it again afterwards.
  const resetUrl = page.url()
  await page.getByLabel('New password', { exact: true }).fill('newpassword1')
  await page.getByLabel('Confirm new password').fill('newpassword1')
  await page.getByRole('button', { name: 'Update password' }).click()

  // Back on sign in with the notice.
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('status')).toContainText('Your password has been updated.')

  // SECURITY: the used link no longer works.
  await page.goto(resetUrl)
  await expect(
    page.getByRole('heading', { level: 1, name: 'This reset link has expired' }),
  ).toBeVisible()
  await expectNoAxeViolations(page)
})

// FR-LND-1: on phones the section links live in a menu sheet.
test('the phone menu opens and jumps to a section', async ({ page, isMobile }) => {
  // Desktop shows the links directly, so there is no menu to test.
  test.skip(!isMobile, 'The menu button only shows on phones')

  // Open the menu.
  await page.goto('/')
  await page.getByRole('button', { name: 'Open menu' }).click()
  const sheet = page.getByRole('dialog', { name: 'Menu' })
  await expect(sheet).toBeVisible()
  await expectNoAxeViolations(page)

  // Choose About: the sheet closes and the section is on screen.
  await sheet.getByRole('link', { name: 'About' }).click()
  await expect(sheet).toBeHidden()
  await expect(page).toHaveURL(/\/#about$/)
  await expect(page.getByRole('heading', { level: 2, name: 'About CoNote' })).toBeInViewport()
})

// FR-LND-1 on larger screens: a header link scrolls to its section.
test('a header link scrolls to its section', async ({ page, isMobile }) => {
  // Phones use the menu instead (tested above).
  test.skip(isMobile, 'The header links only show from 768 px')

  // Click Features in the header.
  await page.goto('/')
  await page
    .getByRole('navigation', { name: 'Site' })
    .getByRole('link', { name: 'Features' })
    .click()

  // The section is on screen.
  await expect(page).toHaveURL(/\/#features$/)
  await expect(
    page.getByRole('heading', { level: 2, name: /Everything you need/ }),
  ).toBeInViewport()
})

// The placeholder legal pages linked from sign-up and the footer.
test('the legal pages open from the footer', async ({ page }) => {
  // Footer link to Terms.
  await page.goto('/')
  await page.getByRole('contentinfo').getByRole('link', { name: 'Terms' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Terms of Service' })).toBeVisible()
  await expectNoAxeViolations(page)

  // Footer link to Privacy.
  await page.getByRole('contentinfo').getByRole('link', { name: 'Privacy' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeVisible()
  await expectNoAxeViolations(page)
})
