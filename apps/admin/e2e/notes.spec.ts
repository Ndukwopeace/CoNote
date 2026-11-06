/**
 * Browser tests for Notes (D123): an administrator searches students' notes by course, class and
 * student, against the production build with the demo platform.
 */

// Playwright's test runner and assertions.
import { expect, test } from '@playwright/test'

// Admin helpers.
import { expectNoAxeViolations, signInAs, watchCspViolations } from './helpers.ts'

test('the administrator narrows notes by course and class, and the address keeps the choice', async ({
  page,
}) => {
  // Watch for Content-Security-Policy breaks throughout.
  const cspViolations = watchCspViolations(page)
  // Sign in, then open Notes: the newest notes of every course, with their classes.
  await page.goto('/admin/login?redirect=%2Fadmin%2Fnotes')
  await signInAs(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Notes' })).toBeVisible()
  await expect(page.getByText(/^Showing 1 to 20 of \d+$/)).toBeVisible()
  await expect(page.getByText(/recorded in the audit log/)).toBeVisible()

  // Choose a course, then one of its classes; the address follows.
  await page.getByLabel('Course').selectOption({ label: 'SWE 311 Software Engineering' })
  await expect(page).toHaveURL(/courseId=swe-311/)
  await page.getByLabel('Class').selectOption({ index: 1 })
  await expect(page).toHaveURL(/classId=/)
  // The counts line for the class: notes from some of its students.
  await expect(page.getByText(/^\d+ notes? from \d+ of \d+ students?$/)).toBeVisible()
  await expectNoAxeViolations(page)

  // A reload keeps the choice.
  await page.reload()
  await expect(page.getByLabel('Course')).toHaveValue('swe-311')
  await expect(page.getByText(/^\d+ notes? from \d+ of \d+ students?$/)).toBeVisible()

  // Nothing was blocked by the policy.
  expect(cspViolations).toEqual([])
})

test('a class page links to its notes', async ({ page }) => {
  // Open an older class of SWE 311, then follow its link to the notes.
  await page.goto('/admin/login?redirect=%2Fadmin%2Fclasses%2Fswe-311-1')
  await signInAs(page)
  await page.getByRole('link', { name: 'Read the notes' }).click()

  // The page opens already narrowed to that class.
  await expect(page).toHaveURL(/courseId=swe-311&classId=swe-311-1/)
  await expect(page.getByLabel('Course')).toHaveValue('swe-311')
  await expect(page.getByText(/^\d+ notes? from \d+ of \d+ students?$/)).toBeVisible()
})
