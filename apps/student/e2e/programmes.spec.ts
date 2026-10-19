/**
 * Browser test for joining a programme (D105): a new student joins a year of study from the
 * dialog and lands on Home with its courses. Runs on desktop and on a phone, against the
 * production build with the production security headers.
 */

// Playwright's assertions and test function.
import { expect, test } from '@playwright/test'

// Shared helpers.
import { expectNoAxeViolations, watchCspViolations } from './helpers.ts'

test('a new student joins a programme and gets all its courses', async ({ page }) => {
  // Watch for Content-Security-Policy breaks throughout.
  const cspViolations = watchCspViolations(page)
  // Sign up: a new student starts in no courses.
  await page.goto('/signup')
  await page.getByLabel('Full name').fill('Ada Obi')
  await page.getByLabel('Email address').fill('ada@example.com')
  await page.getByLabel('Password', { exact: true }).fill('password1')
  await page.getByLabel('Confirm password').fill('password1')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Sign up' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)

  // The dialog offers the open programmes first; the closed one is not there.
  const dialog = page.getByRole('dialog', { name: 'Join your courses' })
  const group = dialog.getByRole('group', { name: 'Join your programme' })
  await expect(group.getByText('Software Engineering, Year 3')).toBeVisible()
  await expect(group.getByText('3 courses: BUS 207, CSE 205, SWE 311')).toBeVisible()
  await expect(group.getByText('Law, Year 1')).toHaveCount(0)
  await expectNoAxeViolations(page)

  // One tap joins them all; the dialog gives way to Home and a toast says how many.
  await group.getByRole('button', { name: 'Join SWE-Y3' }).click()
  await expect(page.getByText('You joined 3 courses.')).toBeVisible()
  await expect(dialog).toBeHidden()

  // The courses are really the student's, after a reload too.
  await page.goto('/courses')
  await page.reload()
  await expect(page.getByRole('link', { name: /SWE 311/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /CSE 205/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /BUS 207/ })).toBeVisible()
  expect(cspViolations).toEqual([])
})
