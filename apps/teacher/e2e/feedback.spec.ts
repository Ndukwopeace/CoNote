/**
 * Browser test for Feedback in the teacher portal (D125): the top-bar button opens the shared form
 * and a send is acknowledged, against the production build with the demo platform.
 */

// Playwright's test runner and assertions.
import { expect, test } from '@playwright/test'

// Teacher helpers.
import { expectNoAxeViolations, signInAs, watchCspViolations } from './helpers.ts'

test('a teacher sends feedback from the top bar', async ({ page }) => {
  // Watch for Content-Security-Policy breaks throughout.
  const cspViolations = watchCspViolations(page)
  // Sign in.
  await page.goto('/teacher/login')
  await signInAs(page)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  // Open the form, and an empty message is turned away with words.
  await page.getByRole('button', { name: 'Feedback' }).click()
  await page.getByRole('button', { name: 'Send feedback' }).click()
  await expect(page.getByText('Write a message before you send.')).toBeVisible()

  // A real message goes through.
  await page.getByLabel('Your message').fill('The review queue loads slowly')
  await page.getByRole('button', { name: 'Send feedback' }).click()
  await expect(page.getByText('Thank you. Your feedback was sent.')).toBeVisible()
  await expectNoAxeViolations(page)

  // Nothing was blocked by the policy.
  expect(cspViolations).toEqual([])
})
