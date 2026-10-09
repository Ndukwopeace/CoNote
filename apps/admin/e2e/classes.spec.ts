/**
 * Browser tests for Classes (admin REQUIREMENTS section 13), on desktop and phone profiles,
 * against the production build with the demo platform.
 */

// Playwright's test runner and assertions.
import { expect, test } from '@playwright/test'

// Admin helpers.
import { expectNoAxeViolations, signInAs, watchCspViolations } from './helpers.ts'

test('the list filters through the address, which survives a reload', async ({ page }) => {
  // Watch for Content-Security-Policy breaks throughout.
  const cspViolations = watchCspViolations(page)
  // Sign in, then open Classes.
  await page.goto('/admin/login?redirect=%2Fadmin%2Fclasses')
  await signInAs(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Classes' })).toBeVisible()
  await expect(page.getByText(/^Showing 1–20 of \d+$/)).toBeVisible()

  // Filter to one course; the address follows, and a reload keeps it.
  await page.getByLabel('Course').selectOption({ label: 'SWE 311 Software Engineering' })
  await expect(page).toHaveURL(/course=swe-311/)
  await expect(page.getByText('Showing 1–15 of 15')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Showing 1–15 of 15')).toBeVisible()
  await expect(page.getByLabel('Course')).toHaveValue('swe-311')

  // Then the published summaries only.
  await page.getByLabel('Summary').selectOption({ label: 'Published' })
  await expect(page).toHaveURL(/summary=published/)
  await expect(
    page.getByRole('link', { name: 'Software Engineering, week 1', exact: true }),
  ).toBeVisible()

  // No accessibility problems, and nothing blocked by the policy.
  await expectNoAxeViolations(page)
  expect(cspViolations).toEqual([])
})

test('a new class is validated, numbered, listed and kept after a reload', async ({ page }) => {
  // Sign in, then open Classes.
  await page.goto('/admin/login?redirect=%2Fadmin%2Fclasses')
  await signInAs(page)

  // Create a class on CSC 301; an end before the start is refused first.
  await page.getByRole('button', { name: 'Create class' }).click()
  const dialog = page.getByRole('dialog', { name: 'Create a class' })
  await dialog.getByLabel('Course').selectOption({ label: 'CSC 301 Operating Systems' })
  await dialog.getByLabel('Class title').fill('Revision session')
  await dialog.getByLabel('Date').fill('2026-12-01')
  await dialog.getByLabel('Start time').fill('10:00')
  await dialog.getByLabel('End time').fill('09:00')
  await dialog.getByRole('button', { name: 'Create class' }).click()
  await expect(dialog.getByText('The end time must be after the start time.')).toBeVisible()
  await dialog.getByLabel('End time').fill('11:30')
  await expectNoAxeViolations(page)
  await dialog.getByRole('button', { name: 'Create class' }).click()
  await expect(page.getByText('Class “Revision session” created.')).toBeVisible()

  // Listed, and still there after a reload.
  await page.goto('/admin/classes?q=revision')
  await expect(page.getByRole('link', { name: 'Revision session' })).toBeVisible()
  await page.reload()
  await page.getByRole('link', { name: 'Revision session' }).click()

  // Its details: numbered after the course's 15 weekly classes, no summary or jobs yet.
  await expect(page.getByRole('heading', { level: 1, name: 'Revision session' })).toBeVisible()
  const details = page.getByRole('region', { name: 'Details' })
  await expect(details.getByText('Class number').locator('xpath=following-sibling::dd')).toHaveText(
    '16',
  )
  await expect(page.getByText('No AI jobs have run for this class.')).toBeVisible()
})

test('a class shows its summary timeline and job history, and archiving keeps them', async ({
  page,
}) => {
  // Open an older class, which has a published summary.
  await page.goto('/admin/login?redirect=%2Fadmin%2Fclasses%3Fcourse%3Dswe-311%26sort%3Ddate')
  await signInAs(page)
  await page.getByRole('link', { name: 'Software Engineering, week 1', exact: true }).click()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Software Engineering, week 1', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('list', { name: 'Summary timeline' }).getByRole('listitem'),
  ).toHaveCount(4)
  await expect(
    page.getByRole('list', { name: 'AI job history' }).getByRole('listitem'),
  ).toHaveCount(1)
  await expectNoAxeViolations(page)

  // Archive: asks first, then the page locks but the timeline stays.
  await page.getByRole('button', { name: 'Archive' }).click()
  await page
    .getByRole('alertdialog', { name: /^Archive/ })
    .getByRole('button', { name: 'Archive' })
    .click()
  await expect(page.getByText('This class is archived. It can’t be changed.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0)
  await expect(page.getByRole('list', { name: 'Summary timeline' })).toBeVisible()

  // Gone from the list, present in the archived view.
  await page.goto('/admin/classes?course=swe-311&sort=date')
  await expect(
    page.getByRole('link', { name: 'Software Engineering, week 2', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Software Engineering, week 1', exact: true }),
  ).toHaveCount(0)
  await page.getByRole('checkbox', { name: 'Show archived classes' }).click()
  await expect(page.getByRole('checkbox', { name: 'Show archived classes' })).toBeChecked()
  await expect(
    page.getByRole('link', { name: 'Software Engineering, week 1', exact: true }),
  ).toBeVisible()
})
