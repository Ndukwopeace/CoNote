/**
 * Browser tests for Analytics (D124): an administrator sees which students wrote notes in which
 * classes, changes the period, and follows a class to its notes, against the production build with
 * the demo platform.
 */

// Playwright's test runner and assertions.
import { expect, test } from '@playwright/test'

// Admin helpers.
import { expectNoAxeViolations, signInAs, watchCspViolations } from './helpers.ts'

test('the administrator reads who wrote notes, changes the period and opens a class', async ({
  page,
}) => {
  // Watch for Content-Security-Policy breaks throughout.
  const cspViolations = watchCspViolations(page)
  // Sign in, then open Analytics.
  await page.goto('/admin/login?redirect=%2Fadmin%2Fanalytics')
  await signInAs(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Analytics' })).toBeVisible()

  // The headline and the class table appear, and the figures below them.
  await expect(page.getByText('Students who sent notes')).toBeVisible()
  await expect(page.getByRole('table', { name: 'Notes by class, quietest first' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Users' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'AI summaries' })).toBeVisible()
  await expectNoAxeViolations(page)

  // Another period is kept in the address and survives a reload.
  await page.getByLabel('Period').selectOption({ label: 'Last 90 days' })
  await expect(page).toHaveURL(/days=90/)
  await page.reload()
  await expect(page.getByLabel('Period')).toHaveValue('90')

  // A class row opens the Notes search narrowed to that class.
  await page
    .getByRole('link', { name: /^Read the notes of / })
    .first()
    .click()
  await expect(page).toHaveURL(/\/admin\/notes\?courseId=.*&classId=/)
  await expect(page.getByRole('heading', { level: 1, name: 'Notes' })).toBeVisible()

  // Nothing was blocked by the policy.
  expect(cspViolations).toEqual([])
})
