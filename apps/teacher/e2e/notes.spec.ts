/**
 * End-to-end checks for reading students' notes in the teacher portal (D123): from a course to a
 * class's notes, the counts, who has not written, the search by student, accessibility and the CSP.
 */

// Playwright test runner and assertions.
import { expect, test } from '@playwright/test'

// Teacher helpers.
import { expectNoAxeViolations, signInAs, watchCspViolations } from './helpers.ts'

// Class 4 of MTH 202: the demo has 21 notes from 12 of its 14 students.
const CLASS_NOTES = '/teacher/courses/mth-202/classes/mth-202-4/notes'

test('a teacher opens a class’s notes from its course and sees who wrote what', async ({
  page,
}) => {
  // Watch for Content-Security-Policy breaks throughout.
  const cspViolations = watchCspViolations(page)
  // Sign in and open the course.
  await page.goto('/teacher/login?redirect=%2Fteacher%2Fcourses%2Fmth-202')
  await signInAs(page)
  await expect(page.getByRole('heading', { level: 1, name: /MTH 202/ })).toBeVisible()

  // Each class links to its notes.
  await page.getByRole('link', { name: 'Read the notes of class 4' }).click()
  await expect(page).toHaveURL(new RegExp(`${CLASS_NOTES}$`))
  await expect(page.getByRole('heading', { level: 1, name: /^Class 4:/ })).toBeVisible()

  // The counts, who has not written yet, and a note with its author.
  await expect(page.getByText('21 notes from 12 of 14 students')).toBeVisible()
  await expect(page.getByText('Not written yet (2)')).toBeVisible()
  await expect(page.getByText('Ada Okafor').first()).toBeVisible()
  await expect(page.getByText(/each time you open them is recorded/)).toBeVisible()
  await expectNoAxeViolations(page)

  // Nothing was blocked by the policy.
  expect(cspViolations).toEqual([])
})

test('a teacher searches a class’s notes by student', async ({ page }) => {
  await page.goto(`/teacher/login?redirect=${encodeURIComponent(CLASS_NOTES)}`)
  await signInAs(page)
  await expect(page.getByText('21 notes from 12 of 14 students')).toBeVisible()

  // Only that student's notes remain.
  await page.getByRole('searchbox', { name: 'Search by student' }).fill('Ada Okafor')
  await page.getByRole('button', { name: 'Search' }).click()
  await expect(page.getByText(/^Showing 1 to \d+ of \d+$/)).toBeVisible()
  await expect(page.getByText('Bola Adeyemi')).toHaveCount(0)

  // Clearing the search brings everyone back.
  await page.getByRole('button', { name: 'Clear search' }).click()
  await expect(page.getByText('Showing 1 to 20 of 21')).toBeVisible()
})

test('a teacher cannot open the notes of another teacher’s class', async ({ page }) => {
  // SWE 311 belongs to Dr. Smith in the demo.
  await page.goto(
    `/teacher/login?redirect=${encodeURIComponent('/teacher/courses/swe-311/classes/swe-311-1/notes')}`,
  )
  await signInAs(page)

  await expect(page.getByRole('heading', { name: 'Class not found' })).toBeVisible()
})
