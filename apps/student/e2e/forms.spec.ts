/**
 * Browser test for the public form (D126): anyone with the link opens it with no account, rates a course,
 * sends it, and can submit another response. The demo form is at /f/demo, against the production build.
 */

// Playwright's test runner and assertions.
import { expect, test } from '@playwright/test'

// Student helpers.
import { expectNoAxeViolations, watchCspViolations } from './helpers.ts'

test('a visitor answers the public form and submits another response', async ({ page }) => {
  // Watch for Content-Security-Policy breaks throughout.
  const cspViolations = watchCspViolations(page)
  // Open the link with no sign-in: the form, not a login page.
  await page.goto('/f/demo')
  await expect(page.getByRole('heading', { level: 1, name: /Lecturer assessment/ })).toBeVisible()
  await expect(page).toHaveURL(/\/f\/demo$/)
  await expectNoAxeViolations(page)

  // Leaving a required question empty is explained.
  await page.getByRole('button', { name: 'Submit' }).click()
  await expect(page.getByText('"Course and lecturer" needs an answer.')).toBeVisible()

  // Choose a course and lecturer, rate, and send.
  await page.getByLabel(/Course and lecturer/).selectOption({ label: 'SWE 311 · Dr. B. Jones' })
  await page.getByRole('radio', { name: '5 of 5, Excellent' }).first().locator('xpath=..').click()
  await page.getByRole('radio', { name: '4 of 5, Very good' }).nth(1).locator('xpath=..').click()
  await page.getByLabel('What could improve?').fill('More practice problems')
  await page.getByRole('button', { name: 'Submit' }).click()
  await expect(page.getByText('Thank you. Your response was sent.')).toBeVisible()

  // Another response starts from an empty form.
  await page.getByRole('button', { name: 'Submit another response' }).click()
  await expect(page.getByLabel(/Course and lecturer/)).toHaveValue('')

  // A wrong link says so.
  await page.goto('/f/not-a-real-link')
  await expect(page.getByText('We could not find this form')).toBeVisible()

  // Nothing was blocked by the policy.
  expect(cspViolations).toEqual([])
})
