/**
 * End-to-end checks for the teacher portal's frame (milestone T1): sign-in, the teacher-only
 * guard, My courses, navigation on every screen size, sign-out, security headers, accessibility
 * and the CSP.
 */

// Playwright test runner and assertions.
import { expect, test } from '@playwright/test'

// Teacher helpers.
import { expectNoAxeViolations, signInAs, watchCspViolations } from './helpers.ts'

test('a signed-out visitor signs in and returns to the page they asked for', async ({ page }) => {
  // Watch for Content-Security-Policy breaks throughout.
  const cspViolations = watchCspViolations(page)
  // A deep link while signed out goes to sign-in, remembering the page.
  await page.goto('/teacher/courses')
  await expect(page.getByRole('heading', { level: 1, name: 'CoNote Teacher' })).toBeVisible()
  await expect(page).toHaveURL(/\/teacher\/login\?redirect=%2Fteacher%2Fcourses$/)
  await expectNoAxeViolations(page)
  // Signing in lands on that page.
  await signInAs(page)
  await expect(page.getByRole('heading', { level: 1, name: 'My courses' })).toBeVisible()
  await expectNoAxeViolations(page)
  // Nothing was blocked by the policy.
  expect(cspViolations).toEqual([])
})

test('My courses shows only the demo teacher’s courses, with what waits for review', async ({
  page,
}) => {
  // Sign in from the bare address, which leads to My courses.
  await page.goto('/')
  await signInAs(page)
  await expect(page.getByRole('heading', { level: 1, name: 'My courses' })).toBeVisible()
  // Her two live courses, ongoing first.
  const cards = page.getByRole('main').getByRole('listitem')
  await expect(cards).toHaveCount(2)
  await expect(cards.nth(0)).toContainText('MTH 202')
  await expect(cards.nth(0)).toContainText('Ongoing')
  await expect(cards.nth(0)).toContainText('7 classes')
  await expect(cards.nth(0)).toContainText('2 waiting for review')
  await expect(cards.nth(1)).toContainText('MTH 301')
  await expect(cards.nth(1)).toContainText('Upcoming')
  // Another teacher's course and her archived course are not there.
  await expect(page.getByText('SWE 311')).toHaveCount(0)
  await expect(page.getByText('MTH 101')).toHaveCount(0)
  await expectNoAxeViolations(page)
})

test('the navigation reaches My courses and the review queue on every screen size', async ({
  page,
  isMobile,
}) => {
  // Sign in.
  await page.goto('/teacher/login')
  await signInAs(page)
  await expect(page.getByRole('heading', { level: 1, name: 'My courses' })).toBeVisible()
  // Phones open the menu panel first; larger screens use the sidebar.
  if (isMobile) await page.getByRole('button', { name: 'Open navigation' }).click()
  const nav = page.getByRole('navigation', {
    name: isMobile ? 'Phone navigation' : 'Teacher navigation',
  })
  await expect(nav.getByRole('link')).toHaveCount(2)
  await nav.getByRole('link', { name: 'My courses' }).click()
  // The page is still there, and the panel has closed on phones.
  await expect(page.getByRole('heading', { level: 1, name: 'My courses' })).toBeVisible()
  if (isMobile) await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeHidden()
})

test('admins and students are turned away', async ({ page }) => {
  // SECURITY: a non-teacher account authenticates but never sees the portal.
  for (const email of ['admin@conote.example', 'student@conote.example']) {
    await page.goto('/teacher/courses')
    await signInAs(page, email)
    await expect(
      page.getByRole('heading', { level: 1, name: 'This portal is for teachers' }),
    ).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Teacher navigation' })).toHaveCount(0)
    await expectNoAxeViolations(page)
    // Sign out from the notice, back to sign-in.
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'CoNote Teacher' })).toBeVisible()
  }
})

test('signing out ends the session for good', async ({ page }) => {
  // Sign in on My courses.
  await page.goto('/teacher/courses')
  await signInAs(page)
  await expect(page.getByRole('heading', { level: 1, name: 'My courses' })).toBeVisible()
  // Move to another page inside the frame, so Back has a portal page to return to.
  await page.goto('/teacher/nothing-here')
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
  // Sign out from the account menu.
  await page.getByRole('button', { name: 'Account menu for Sarah Mbarga' }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'CoNote Teacher' })).toBeVisible()
  // SECURITY: the Back button can't bring the portal back (shared-computer exposure): My courses'
  // address loads, and the guard sends it to sign-in.
  await page.goBack()
  await expect(page).toHaveURL(/\/teacher\/login\?redirect=%2Fteacher%2Fcourses$/)
  await expect(page.getByRole('heading', { level: 1, name: 'CoNote Teacher' })).toBeVisible()
})

test('unknown addresses show not-found', async ({ page }) => {
  // Sign in, then open an address the portal doesn't have.
  await page.goto('/teacher/login')
  await signInAs(page)
  await expect(page.getByRole('heading', { level: 1, name: 'My courses' })).toBeVisible()
  await page.goto('/teacher/nothing-here')
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
  await expectNoAxeViolations(page)
})

test('the server sends the security headers', async ({ request }) => {
  // The sign-in page's response.
  const response = await request.get('/teacher/login')
  const headers = response.headers()
  // SECURITY: the CSP, clickjacking protection and the no-index rule are all present.
  expect(headers['content-security-policy']).toContain("script-src 'self'")
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'")
  expect(headers['x-content-type-options']).toBe('nosniff')
  expect(headers['x-robots-tag']).toBe('noindex, nofollow')
})
