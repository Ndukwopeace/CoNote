/**
 * Browser tests for Feedback (D125): the top-bar button sends feedback, and the Feedback page lists
 * it, against the production build with the demo platform.
 */

// Playwright's test runner and assertions.
import { expect, test } from '@playwright/test'

// Admin helpers.
import { expectNoAxeViolations, signInAs, watchCspViolations } from './helpers.ts'

test('feedback sent from the top bar appears on the Feedback page and can be marked read', async ({
  page,
}) => {
  // Watch for Content-Security-Policy breaks throughout.
  const cspViolations = watchCspViolations(page)
  // Sign in on the dashboard.
  await page.goto('/admin/login')
  await signInAs(page)
  await expect(page.getByRole('heading', { level: 1, name: /^Good / })).toBeVisible()

  // Send feedback from the top bar.
  await page.getByRole('button', { name: 'Feedback' }).click()
  await page.getByLabel('What is it about?').selectOption('idea')
  await page.getByLabel('Your message').fill('Show the sender role in the list')
  await page.getByRole('radio', { name: '5 of 5, Great' }).locator('xpath=..').click()
  await page.getByRole('button', { name: 'Send feedback' }).click()
  await expect(page.getByText('Thank you. Your feedback was sent.')).toBeVisible()
  await expectNoAxeViolations(page)
  await page.getByRole('button', { name: 'Close' }).first().click()

  // The Feedback page lists it first, as new, with its page.
  await page.goto('/admin/feedback')
  await expect(page.getByRole('heading', { level: 1, name: 'Feedback' })).toBeVisible()
  const list = page.getByRole('list', { name: 'Feedback' })
  const first = list.getByRole('listitem').first()
  await expect(first).toContainText('Show the sender role in the list')
  await expect(first).toContainText('Score 5 of 5')
  await expect(first).toContainText('/admin/dashboard')
  await expectNoAxeViolations(page)

  // Marking it read keeps it after a reload.
  await first.getByRole('button', { name: 'Mark as read' }).click()
  await expect(first.getByRole('button', { name: 'Mark as new' })).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('list', { name: 'Feedback' }).getByRole('listitem').first(),
  ).toContainText('Mark as new')

  // Nothing was blocked by the policy.
  expect(cspViolations).toEqual([])
})
