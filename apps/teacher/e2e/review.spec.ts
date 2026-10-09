/**
 * End-to-end checks for the review flow (milestone T2): the course page, the review queue, editing
 * and saving a draft, Approve & Publish with its question, and who may open what. Each test gets a
 * fresh browser profile, so the demo starts from its seed.
 */

// Playwright test runner and assertions.
import { expect, test } from '@playwright/test'

// Teacher helpers.
import { expectNoAxeViolations, signInAs, watchCspViolations } from './helpers.ts'

test('a teacher reviews, edits, saves and publishes a summary', async ({ page, isMobile }) => {
  // Watch for Content-Security-Policy breaks throughout.
  const cspViolations = watchCspViolations(page)
  // Sign in: My courses says two summaries wait on MTH 202.
  await page.goto('/teacher/courses')
  await signInAs(page)
  const mth202 = page.getByRole('listitem').filter({ hasText: 'MTH 202' })
  await expect(mth202).toContainText('2 waiting for review')

  // The queue: the longest wait (class 4) is first.
  if (isMobile) await page.getByRole('button', { name: 'Open navigation' }).click()
  await page
    .getByRole('navigation', { name: isMobile ? 'Phone navigation' : 'Teacher navigation' })
    .getByRole('link', { name: 'Review queue' })
    .click()
  await expect(page.getByRole('heading', { level: 1, name: 'Review queue' })).toBeVisible()
  const rows = page.getByRole('main').getByRole('listitem')
  await expect(rows).toHaveCount(2)
  await expect(rows.nth(0)).toContainText('Class 4')
  await expect(rows.nth(1)).toContainText('Class 5')
  await expectNoAxeViolations(page)

  // Open the first: the draft, with counts and no notes.
  await page.getByRole('link', { name: 'Review MTH 202 class 4' }).click()
  await expect(page.getByRole('heading', { level: 1, name: /^Class 4:/ })).toBeVisible()
  await expect(page.getByText(/^Based on \d+ notes from \d+ students$/)).toBeVisible()
  const overview = page.getByRole('textbox', { name: 'Overview' })
  await expect(overview).toHaveValue(/^This class introduced/)
  await expectNoAxeViolations(page)

  // Edit and save; the edit survives a reload.
  await overview.fill('Edited by the teacher.')
  await page.getByRole('button', { name: 'Save draft' }).click()
  await expect(page.getByText('Draft saved.')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Overview' })).toHaveValue(
    'Edited by the teacher.',
  )

  // Approve & Publish asks first. Cancel changes nothing.
  await page.getByRole('button', { name: 'Approve & Publish' }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Publish this summary?' })
  await expect(dialog).toContainText('Students in MTH 202 will see it.')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('button', { name: 'Save draft' })).toBeVisible()

  // Confirm: the summary is published and read-only.
  await page.getByRole('button', { name: 'Approve & Publish' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Approve & Publish' }).click()
  await expect(page.getByText(/Published .* by Sarah Mbarga/)).toBeVisible()
  await expect(page.getByText('Edited by the teacher.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Approve & Publish' })).toHaveCount(0)
  await expect(page.getByRole('textbox')).toHaveCount(0)
  await expectNoAxeViolations(page)

  // It stays published after a reload.
  await page.reload()
  await expect(page.getByText(/Published .* by Sarah Mbarga/)).toBeVisible()

  // The queue lost one, and My courses says one waits.
  await page.goto('/teacher/reviews')
  await expect(page.getByRole('main').getByRole('listitem')).toHaveCount(1)
  await page.goto('/teacher/courses')
  await expect(page.getByRole('listitem').filter({ hasText: 'MTH 202' })).toContainText(
    '1 waiting for review',
  )
  // Nothing was blocked by the policy.
  expect(cspViolations).toEqual([])
})

test('a course shows its classes, newest first, with their stages', async ({ page }) => {
  await page.goto('/teacher/courses/mth-202')
  await signInAs(page)
  await expect(
    page.getByRole('heading', { level: 1, name: 'MTH 202 Linear Algebra' }),
  ).toBeVisible()
  const rows = page.getByRole('main').getByRole('listitem')
  await expect(rows).toHaveCount(7)
  // The latest class is first, and still being collected; class 6 is being drafted.
  await expect(rows.nth(0)).toContainText('Class 7')
  await expect(rows.nth(0)).toContainText('Collecting notes')
  await expect(rows.nth(1)).toContainText('AI is drafting')
  await expect(rows.nth(2)).toContainText('Ready for your review')
  await expect(rows.nth(6)).toContainText('Published')
  await expectNoAxeViolations(page)
  // A published class opens read-only.
  await page.getByRole('link', { name: 'View class 1' }).click()
  await expect(page.getByText(/Published .* by Sarah Mbarga/)).toBeVisible()
})

test('another teacher’s course and summary are not found', async ({ page }) => {
  // SECURITY: the same answer as for an address that doesn't exist.
  await page.goto('/teacher/courses/swe-311')
  await signInAs(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Course not found' })).toBeVisible()
  await page.goto('/teacher/reviews/summary-swe-311-1')
  await expect(page.getByRole('heading', { level: 1, name: 'Summary not found' })).toBeVisible()
  await page.goto('/teacher/reviews/no-such-summary')
  await expect(page.getByRole('heading', { level: 1, name: 'Summary not found' })).toBeVisible()
  await expectNoAxeViolations(page)
})

test('leaving a review with unsaved edits asks first', async ({ page }) => {
  await page.goto('/teacher/reviews/summary-mth-202-4')
  await signInAs(page)
  await page.getByRole('textbox', { name: 'Overview' }).fill('Not saved.')
  // Leave through the link back to the course: asked first; Keep editing stays.
  await page.getByRole('link', { name: 'MTH 202 Linear Algebra' }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Leave without saving?' })
  await dialog.getByRole('button', { name: 'Keep editing' }).click()
  await expect(page).toHaveURL(/\/teacher\/reviews\/summary-mth-202-4$/)
  // Leave goes to the course, and the edit is gone.
  await page.getByRole('link', { name: 'MTH 202 Linear Algebra' }).click()
  await dialog.getByRole('button', { name: 'Leave' }).click()
  await expect(page).toHaveURL(/\/teacher\/courses\/mth-202$/)
  await page.goBack()
  await expect(page.getByRole('textbox', { name: 'Overview' })).toHaveValue(
    /^This class introduced/,
  )
})
