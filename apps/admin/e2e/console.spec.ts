/**
 * End-to-end checks for the admin console's frame (milestone A1): sign-in, the admin-only guard,
 * navigation on every screen size, sign-out, security headers, accessibility and the CSP.
 */

// Playwright test runner and assertions.
import { expect, test } from '@playwright/test'

// Admin helpers.
import { expectNoAxeViolations, signInAs, watchCspViolations } from './helpers.ts'

// The nine sections, in sidebar order, with their page headings.
const SECTIONS = [
  'Dashboard',
  'Users',
  'Courses',
  'Classes',
  'Resources',
  'AI & Summaries',
  'Analytics',
  'Audit Logs',
  'Settings',
]

test('a signed-out visitor signs in and returns to the page they asked for', async ({ page }) => {
  // Watch for Content-Security-Policy breaks throughout.
  const cspViolations = watchCspViolations(page)
  // A deep link while signed out goes to sign-in, remembering the page.
  await page.goto('/admin/courses')
  await expect(page.getByRole('heading', { level: 1, name: 'CoNote Admin' })).toBeVisible()
  await expect(page).toHaveURL(/\/admin\/login\?redirect=%2Fadmin%2Fcourses$/)
  await expectNoAxeViolations(page)
  // Signing in lands on that page.
  await signInAs(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Courses' })).toBeVisible()
  await expectNoAxeViolations(page)
  // Nothing was blocked by the policy.
  expect(cspViolations).toEqual([])
})

test('every section opens from the navigation', async ({ page, isMobile }) => {
  // Sign in.
  await page.goto('/admin/login')
  await signInAs(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()
  for (const section of SECTIONS) {
    // Phones open the menu panel first; larger screens use the sidebar.
    if (isMobile) await page.getByRole('button', { name: 'Open navigation' }).click()
    const nav = page.getByRole('navigation', {
      name: isMobile ? 'Phone navigation' : 'Admin navigation',
    })
    await nav.getByRole('link', { name: section }).click()
    // The section's page opens, and the panel has closed on phones.
    await expect(page.getByRole('heading', { level: 1, name: section })).toBeVisible()
    if (isMobile) await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeHidden()
  }
})

test('teachers and students are turned away', async ({ page }) => {
  // SECURITY: a non-admin account authenticates but never sees the console.
  for (const email of ['teacher@conote.example', 'student@conote.example']) {
    await page.goto('/admin/dashboard')
    await signInAs(page, email)
    await expect(
      page.getByRole('heading', { level: 1, name: 'This console is for administrators' }),
    ).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Admin navigation' })).toHaveCount(0)
    await expectNoAxeViolations(page)
    // Sign out from the notice, back to sign-in.
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'CoNote Admin' })).toBeVisible()
  }
})

test('signing out ends the session for good', async ({ page, isMobile }) => {
  // Sign in on one page, then move to another in the app, so Back has a console page to return to.
  await page.goto('/admin/users')
  await signInAs(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible()
  if (isMobile) await page.getByRole('button', { name: 'Open navigation' }).click()
  await page
    .getByRole('navigation', { name: isMobile ? 'Phone navigation' : 'Admin navigation' })
    .getByRole('link', { name: 'Courses' })
    .click()
  await expect(page.getByRole('heading', { level: 1, name: 'Courses' })).toBeVisible()
  // Sign out from the account menu.
  await page.getByRole('button', { name: 'Account menu for Amara Okafor' }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'CoNote Admin' })).toBeVisible()
  // SECURITY: the Back button can't bring the console back (shared-computer exposure): the Users
  // page's address loads, and the guard sends it to sign-in.
  await page.goBack()
  await expect(page).toHaveURL(/\/admin\/login\?redirect=%2Fadmin%2Fusers$/)
  await expect(page.getByRole('heading', { level: 1, name: 'CoNote Admin' })).toBeVisible()
})

test('unknown addresses show not-found', async ({ page }) => {
  // Sign in, then open an address the console doesn't have.
  await page.goto('/admin/login')
  await signInAs(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()
  await page.goto('/admin/nothing-here')
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
  await expectNoAxeViolations(page)
})

test('the server sends the security headers', async ({ request }) => {
  // The sign-in page's response.
  const response = await request.get('/admin/login')
  const headers = response.headers()
  // SECURITY: the CSP, clickjacking protection and the no-index rule are all present.
  expect(headers['content-security-policy']).toContain("script-src 'self'")
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'")
  expect(headers['x-content-type-options']).toBe('nosniff')
  expect(headers['x-robots-tag']).toBe('noindex, nofollow')
})
