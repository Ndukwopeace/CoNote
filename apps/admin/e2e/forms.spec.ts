/**
 * Browser tests for Forms (D126): the demo assessment lists with its results by lecturer, a new form is
 * made from the template, edited and saved, and answers can be read and downloaded, against the
 * production build with the demo platform.
 */

// Playwright's test runner and assertions.
import { expect, test } from '@playwright/test'

// Admin helpers.
import { expectNoAxeViolations, signInAs, watchCspViolations } from './helpers.ts'

test('the administrator reads the results of the demo assessment', async ({ page }) => {
  // Watch for Content-Security-Policy breaks throughout.
  const cspViolations = watchCspViolations(page)
  // Sign in, then open Forms.
  await page.goto('/admin/login?redirect=%2Fadmin%2Fforms')
  await signInAs(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Forms' })).toBeVisible()
  const list = page.getByRole('list', { name: 'Forms' })
  await expect(list.getByRole('link', { name: 'Lecturer assessment' })).toBeVisible()
  await expectNoAxeViolations(page)

  // Its results: averages by course and lecturer, and every answer.
  await list.getByRole('link', { name: /responses$/ }).click()
  await expect(page.getByRole('table', { name: 'Results by course and lecturer' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Dr. Hassan' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Responses' })).toBeVisible()
  await expectNoAxeViolations(page)

  // The answers download as a CSV file.
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download CSV' }).click()
  expect((await download).suggestedFilename()).toBe('lecturer-assessment-responses.csv')

  // Nothing was blocked by the policy.
  expect(cspViolations).toEqual([])
})

test('the administrator makes a form, changes it and sees the link to share', async ({ page }) => {
  // Sign in on Forms.
  await page.goto('/admin/login?redirect=%2Fadmin%2Fforms')
  await signInAs(page)

  // A new form starts from the lecturer assessment template and opens in the builder.
  await page.getByRole('button', { name: 'New form' }).click()
  await expect(page.getByLabel('Title')).toHaveValue('Lecturer assessment')
  await expect(page.getByLabel('Question 1', { exact: true })).toHaveValue('Course and lecturer')
  await expect(page.getByLabel('Link to share')).toHaveValue(/\/f\/[0-9a-f]{32}$/)

  // Rename it, add a question, switch it on and save.
  await page.getByLabel('Title').fill('Term 1 lecturer assessment')
  await page.getByLabel('New question type').selectOption({ label: 'Short answer' })
  await page.getByRole('button', { name: 'Add question' }).click()
  await page.getByLabel('Question 8', { exact: true }).fill('Your level')
  await page.getByLabel('Accepting responses').check()
  await page.getByRole('button', { name: 'Save form' }).click()
  await expect(page.getByText('Saved.')).toBeVisible()
  await expectNoAxeViolations(page)

  // It shows in the list as open.
  await page.getByRole('link', { name: 'All forms' }).click()
  const row = page.getByRole('listitem').filter({ hasText: 'Term 1 lecturer assessment' })
  await expect(row.getByText('Open')).toBeVisible()
})
