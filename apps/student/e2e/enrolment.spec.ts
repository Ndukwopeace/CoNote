/**
 * J1 browser tests (docs/MILESTONES.md, D76): a new student signs up and is asked for their year
 * in the join dialog, with no course search. Each runs on desktop and on a phone, against the
 * production build with the production security headers.
 */

// Playwright's assertions and test function, and the page type.
import { expect, test, type Page } from '@playwright/test'

// Shared helpers.
import { expectNoAxeViolations, signIn, watchCspViolations } from './helpers.ts'

/** Signs up as a new student and lands on the dashboard. */
async function signUp(page: Page) {
  await page.goto('/signup')
  await page.getByLabel('Full name').fill('Ada Obi')
  await page.getByLabel('Email address').fill('ada@example.com')
  await page.getByLabel('Password', { exact: true }).fill('password1')
  await page.getByLabel('Confirm password').fill('password1')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Sign up' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

test('a new student is asked for the year first, with no course search', async ({ page }) => {
  // Watch for Content-Security-Policy breaks throughout.
  const cspViolations = watchCspViolations(page)
  await signUp(page)

  // The dialog opens by itself and asks for the year. There is no course search and no course list:
  // a student joins one programme, which brings its courses (D115).
  const dialog = page.getByRole('dialog', { name: 'Join your programme' })
  await expect(dialog).toBeVisible()
  const years = dialog.getByRole('group', { name: 'Choose your year' })
  await expect(years.getByRole('button', { name: 'Year 1' })).toBeVisible()
  await expect(years.getByRole('button', { name: 'Year 3' })).toBeVisible()
  await expect(dialog.getByRole('searchbox')).toHaveCount(0)
  await expect(dialog.getByText('Linear Algebra')).toHaveCount(0)
  await expectNoAxeViolations(page)

  // Not now: the dashboard has no courses and no upcoming classes, and nothing is enrolled.
  await dialog.getByRole('button', { name: 'Not now' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('heading', { level: 2, name: 'Upcoming Classes' })).toHaveCount(0)

  // My Courses says so too, and "Join programme" opens the same year step again.
  await page.goto('/courses')
  await expect(page.getByRole('heading', { level: 1, name: 'My Courses' })).toBeVisible()
  await expect(page.getByText(/not enrolled in any courses yet/)).toBeVisible()
  await expectNoAxeViolations(page)
  await page.getByRole('button', { name: 'Join programme' }).click()
  await expect(
    page
      .getByRole('dialog', { name: 'Join your programme' })
      .getByRole('group', { name: 'Choose your year' }),
  ).toBeVisible()

  // SECURITY: the whole journey ran without the security policy blocking anything.
  expect(cspViolations).toEqual([])
})

test('a returning student with courses is not prompted, and can still find more', async ({
  page,
}) => {
  await page.goto('/login')
  await signIn(page)
  await expect(page).toHaveURL(/\/dashboard$/)
  // No dialog on arrival.
  await expect(page.getByRole('dialog')).toHaveCount(0)

  // My Courses offers Join programme, which asks for the year like it does for anyone.
  await page.goto('/courses')
  await page.getByRole('button', { name: 'Join programme' }).click()
  const dialog = page.getByRole('dialog', { name: 'Join your programme' })
  await expect(dialog.getByRole('group', { name: 'Choose your year' })).toBeVisible()
})
