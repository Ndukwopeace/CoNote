/**
 * J1 browser tests (docs/MILESTONES.md, D76): a new student signs up, asks to join courses from the
 * dialog, and sees the requests wait for approval. Each runs on desktop and on a phone, against the
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

test('a new student asks to join courses, and the requests wait for approval', async ({ page }) => {
  // Watch for Content-Security-Policy breaks throughout.
  const cspViolations = watchCspViolations(page)
  await signUp(page)

  // The dialog opens by itself, lists courses in use and nothing finished or archived.
  const dialog = page.getByRole('dialog', { name: 'Join your courses' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Linear Algebra')).toBeVisible()
  await expect(dialog.getByText('Calculus I')).toHaveCount(0)
  await expect(dialog.getByText('Communication in English')).toHaveCount(0)
  await expectNoAxeViolations(page)

  // Search, then ask for two courses and withdraw one.
  await dialog.getByRole('searchbox', { name: 'Search courses to join' }).fill('mth')
  await expect(dialog.getByText('Software Engineering')).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Request to join MTH 202' }).click()
  await expect(dialog.getByText('Requested')).toBeVisible()
  await dialog.getByRole('searchbox').fill('')
  await dialog.getByRole('button', { name: 'Request to join PHY 101' }).click()
  await expect(dialog.getByText('Requested')).toHaveCount(2)
  await dialog.getByRole('button', { name: 'Cancel request for PHY 101' }).click()
  await expect(dialog.getByText('Requested')).toHaveCount(1)

  // Not now: the dashboard says one request is waiting, and nothing is enrolled.
  await dialog.getByRole('button', { name: 'Not now' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText(/1 request is waiting for approval/)).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Upcoming Classes' })).toHaveCount(0)

  // My Courses lists the request as waiting, still with no course in it, and survives a reload.
  await page.goto('/courses')
  await expect(page.getByRole('heading', { level: 1, name: 'My Courses' })).toBeVisible()
  await page.reload()
  const requested = page.getByRole('region', { name: 'Requested courses' })
  await expect(requested).toContainText('MTH 202 · Linear Algebra')
  await expect(requested).toContainText('Waiting for approval')
  await expect(page.getByText(/not enrolled in any courses yet/)).toBeVisible()
  await expectNoAxeViolations(page)

  // "Find courses" opens the dialog again, with the request shown.
  await page.getByRole('button', { name: 'Find courses' }).click()
  await expect(
    page.getByRole('dialog', { name: 'Join your courses' }).getByText('Requested'),
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

  // My Courses offers Find courses, and the four courses read as Joined.
  await page.goto('/courses')
  await page.getByRole('button', { name: 'Find courses' }).click()
  const dialog = page.getByRole('dialog', { name: 'Join your courses' })
  await expect(dialog.getByText('Joined')).toHaveCount(4)
})
