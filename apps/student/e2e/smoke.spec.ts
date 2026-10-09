/**
 * Browser tests against the production build, served with the production security headers.
 * Each test runs twice: desktop Chrome and a Pixel 7 phone (playwright.config.ts).
 */

// Playwright's assertions and test function.
import { expect, test } from '@playwright/test'

// Shared helpers.
import { expectNoAxeViolations, primaryNav, signIn, watchCspViolations } from './helpers.ts'

/** The dashboard's heading: a time-of-day greeting for the demo student (FR-DSH-1). */
const GREETING = /^Good (morning|afternoon|evening), Victory$/

/**
 * M1 smoke test (docs/MILESTONES.md): sign in, visit every portal page, sign out.
 * Runs against the production build with the production security headers.
 */
test('a student signs in, visits every portal page and signs out', async ({ page, isMobile }) => {
  // Start collecting CSP violations before anything loads.
  const cspViolations = watchCspViolations(page)

  // Landing page: tagline visible, no accessibility problems.
  await page.goto('/')
  await expect(
    page.getByRole('heading', { level: 1, name: /Your notes\. Collective understanding\./ }),
  ).toBeVisible()
  await expectNoAxeViolations(page)

  // Go to sign in from the hero (inside <main>, not the header link).
  await page.getByRole('main').getByRole('link', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeVisible()
  await expectNoAxeViolations(page)
  // Sign in.
  await signIn(page)

  // Arrives on the dashboard.
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { level: 1, name: GREETING })).toBeVisible()
  await expectNoAxeViolations(page)

  // Every destination in the visible navigation: [link text, page heading, expected address].
  const destinations = [
    ['Courses', 'My Courses', /\/courses$/],
    ['Notes', 'Notes', /\/notes$/],
    ['Ask AI', 'Ask CoNote AI', /\/ask-ai$/],
    ['Home', GREETING, /\/dashboard$/],
  ] as const
  // Click through each and check address, heading and accessibility.
  for (const [link, heading, url] of destinations) {
    await primaryNav(page, isMobile).getByRole('link', { name: link }).click()
    await expect(page).toHaveURL(url)
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
    await expectNoAxeViolations(page)
  }

  // Notifications through the top-bar bell (the only way on phones, decision D35).
  await page.getByRole('banner').getByRole('link', { name: 'Notifications' }).click()
  await expect(page).toHaveURL(/\/notifications$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Notifications' })).toBeVisible()
  await expectNoAxeViolations(page)

  // Settings through the avatar menu (the only route to it on phones).
  await page.getByRole('button', { name: /account menu/i }).click()
  await page.getByRole('menuitem', { name: 'Settings' }).click()
  await expect(page).toHaveURL(/\/settings\/profile$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()

  // Sign out lands on the landing page (decision D21).
  await page.getByRole('button', { name: /account menu/i }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/$/)

  // SECURITY: after sign-out, a portal page sends the visitor to sign in.
  await page.goto('/notes')
  await expect(page).toHaveURL(/\/login\?redirect=%2Fnotes$/)

  // SECURITY: the whole journey ran without the security policy blocking anything.
  expect(cspViolations).toEqual([])
})

// Proves Vercel's rewrite and the redirect flow: a shared link works, and so does a refresh.
test('a deep link survives sign-in and a page refresh', async ({ page }) => {
  // Open a portal page while signed out: sent to sign in with a redirect back.
  await page.goto('/courses')
  await expect(page).toHaveURL(/\/login\?redirect=%2Fcourses$/)

  // Sign in: returned to the requested page.
  await signIn(page)
  await expect(page).toHaveURL(/\/courses$/)
  await expect(page.getByRole('heading', { level: 1, name: 'My Courses' })).toBeVisible()

  // Refresh: still there, still signed in.
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'My Courses' })).toBeVisible()
})

// SECURITY: proves that without "remember me" a new tab (a stand-in for a new browser session)
// is signed out, so nothing is left behind on a shared computer.
test('without "remember me" the session ends with the browser session', async ({ browser }) => {
  // A fresh browser profile.
  const context = await browser.newContext()
  const page = await context.newPage()
  // Sign in without "remember me".
  await page.goto('/login')
  await signIn(page, { remember: false })
  await expect(page).toHaveURL(/\/dashboard$/)

  // A second tab has its own sessionStorage, so it must be signed out.
  const freshPage = await context.newPage()
  await freshPage.goto('/dashboard')
  await expect(freshPage).toHaveURL(/\/login/)
  // Close the profile.
  await context.close()
})

// Proves nobody meets the canned Ask AI replies unlabelled (T0): the navigation item and the page
// both say "Preview", at phone and desktop widths, with no accessibility problems.
test('Ask AI is labelled as a preview in the navigation and on its page', async ({
  page,
  isMobile,
}) => {
  // Sign in.
  await page.goto('/login')
  await signIn(page)
  await expect(page).toHaveURL(/\/dashboard$/)

  // The navigation item carries the label in its name.
  const link = primaryNav(page, isMobile).getByRole('link', { name: /^Ask AI\s*Preview$/ })
  await expect(link).toBeVisible()

  // The page shows the badge beside its heading and the one-line note under it.
  await link.click()
  const heading = page.getByRole('heading', { level: 1, name: 'Ask CoNote AI' })
  await expect(heading).toBeVisible()
  await expect(page.getByRole('main').getByText('Preview', { exact: true })).toBeVisible()
  await expect(
    page.getByText('Preview: replies are examples while the AI service is being built.'),
  ).toBeVisible()
  await expectNoAxeViolations(page)

  // No sideways scroll at this width: the badge fits.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
})

// Proves unknown addresses get an accessible 404 page.
test('an unknown address shows the not-found page', async ({ page }) => {
  await page.goto('/this-does-not-exist')

  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
  await expectNoAxeViolations(page)
})

// Proves the right navigation shows at each screen size (REQUIREMENTS.md section 8).
test('the portal adapts its navigation to the screen size', async ({ page, isMobile }) => {
  // Sign in.
  await page.goto('/login')
  await signIn(page)
  await expect(page).toHaveURL(/\/dashboard$/)

  // Bottom bar visible only on phones.
  await expect(page.getByRole('navigation', { name: 'Quick navigation' })).toBeVisible({
    visible: isMobile,
  })
  // Sidebar visible only on larger screens.
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible({
    visible: !isMobile,
  })
})
