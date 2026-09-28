import { expect, test } from '@playwright/test'

import { expectNoAxeViolations, primaryNav, signIn, watchCspViolations } from './helpers.ts'

/**
 * M1 smoke test (docs/MILESTONES.md): sign in, visit every portal page, sign out.
 * Runs against the production build with the production security headers.
 */
test('a student signs in, visits every portal page and signs out', async ({ page, isMobile }) => {
  const cspViolations = watchCspViolations(page)

  await page.goto('/')
  await expect(
    page.getByRole('heading', { level: 1, name: /Your notes\. Collective understanding\./ }),
  ).toBeVisible()
  await expectNoAxeViolations(page)

  await page.getByRole('main').getByRole('link', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeVisible()
  await expectNoAxeViolations(page)
  await signIn(page)

  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()
  await expectNoAxeViolations(page)

  const destinations = [
    ['Courses', 'My Courses', /\/courses$/],
    ['Notes', 'Notes', /\/notes$/],
    ['Ask AI', 'Ask CoNote AI', /\/ask-ai$/],
    ['Notifications', 'Notifications', /\/notifications$/],
    ['Dashboard', 'Dashboard', /\/dashboard$/],
  ] as const
  for (const [link, heading, url] of destinations) {
    await primaryNav(page, isMobile).getByRole('link', { name: link }).click()
    await expect(page).toHaveURL(url)
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
    await expectNoAxeViolations(page)
  }

  await page.getByRole('button', { name: /account menu/i }).click()
  await page.getByRole('menuitem', { name: 'Settings' }).click()
  await expect(page).toHaveURL(/\/settings\/profile$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()

  await page.getByRole('button', { name: /account menu/i }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/$/)

  await page.goto('/notes')
  await expect(page).toHaveURL(/\/login\?redirect=%2Fnotes$/)

  expect(cspViolations).toEqual([])
})

test('a deep link survives sign-in and a page refresh', async ({ page }) => {
  await page.goto('/courses')
  await expect(page).toHaveURL(/\/login\?redirect=%2Fcourses$/)

  await signIn(page)
  await expect(page).toHaveURL(/\/courses$/)
  await expect(page.getByRole('heading', { level: 1, name: 'My Courses' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'My Courses' })).toBeVisible()
})

test('without "remember me" the session ends with the browser session', async ({ browser }) => {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto('/login')
  await signIn(page, { remember: false })
  await expect(page).toHaveURL(/\/dashboard$/)

  const freshPage = await context.newPage()
  await freshPage.goto('/dashboard')
  await expect(freshPage).toHaveURL(/\/login/)
  await context.close()
})

test('an unknown address shows the not-found page', async ({ page }) => {
  await page.goto('/this-does-not-exist')

  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
  await expectNoAxeViolations(page)
})

test('the portal adapts its navigation to the screen size', async ({ page, isMobile }) => {
  await page.goto('/login')
  await signIn(page)
  await expect(page).toHaveURL(/\/dashboard$/)

  await expect(page.getByRole('navigation', { name: 'Quick navigation' })).toBeVisible({
    visible: isMobile,
  })
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible({
    visible: !isMobile,
  })
})
