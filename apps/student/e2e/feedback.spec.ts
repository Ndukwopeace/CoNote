/**
 * Browser test for Feedback in the student portal (D125): the navigation opens the shared form
 * and a send is acknowledged, against the production build with the demo data.
 */

// Playwright's test runner and assertions.
import { expect, test } from '@playwright/test'

// Student helpers.
import { expectNoAxeViolations, mainNav, signIn, watchCspViolations } from './helpers.ts'

test('a student sends feedback from the navigation', async ({ page, isMobile }) => {
  // Watch for Content-Security-Policy breaks throughout.
  const cspViolations = watchCspViolations(page)
  // Sign in, which lands on the student's home.
  await page.goto('/login')
  await signIn(page)

  // Open the navigation (on phones, its menu first) and the form.
  await mainNav(page, isMobile)
  await page.getByRole('button', { name: 'Feedback', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Send feedback' })).toBeVisible()

  // A message goes through, with a score.
  await page.getByLabel('Your message').fill('Dark mode would help at night')
  await page.getByRole('radio', { name: '4 of 5, Very good' }).locator('xpath=..').click()
  await page.getByRole('button', { name: 'Send feedback' }).click()
  await expect(page.getByText('Thank you. Your feedback was sent.')).toBeVisible()
  await expectNoAxeViolations(page)

  // Nothing was blocked by the policy.
  expect(cspViolations).toEqual([])
})
