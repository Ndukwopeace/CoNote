/**
 * Browser test for the programme requests (D106): an administrator approves a student's request,
 * sees them in the programme, and removes them again. Runs on desktop and on a phone, against the
 * production build with the demo platform, which starts with two requests waiting.
 */

// Playwright's runner and assertions.
import { expect, test } from '@playwright/test'

// Admin helpers.
import { expectNoAxeViolations, signInAs, watchCspViolations } from './helpers.ts'

test('a request is approved, the student appears in the programme, and can be removed', async ({
  page,
}) => {
  // Watch for Content-Security-Policy breaks throughout.
  const cspViolations = watchCspViolations(page)
  await page.goto('/admin/login?redirect=%2Fadmin%2Fprogrammes')
  await signInAs(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Programmes' })).toBeVisible()

  // Two requests wait for Software Engineering Year 3.
  const requests = page.getByRole('table', { name: 'Requests to join a programme' })
  await expect(requests.getByRole('row')).toHaveCount(3)
  await expect(page.getByText('2 waiting')).toBeVisible()
  await expectNoAxeViolations(page)

  // Approve the first: a toast says so, and one request is left.
  await requests
    .getByRole('button', { name: /^Approve .* for SWE-Y3$/ })
    .first()
    .click()
  await expect(page.getByText(/joined SWE-Y3\./)).toBeVisible()
  await expect(page.getByText('1 waiting')).toBeVisible()

  // The student is in the programme.
  await page.getByRole('button', { name: 'Students in SWE-Y3' }).click()
  const dialog = page.getByRole('dialog', { name: 'Students in SWE-Y3' })
  await expect(dialog.getByRole('listitem')).toHaveCount(1)
  await expectNoAxeViolations(page)

  // Removing asks first, and says notes are kept.
  await dialog.getByRole('button', { name: /^Remove .* from SWE-Y3$/ }).click()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toContainText('Their own notes are kept')
  await confirm.getByRole('button', { name: 'Remove' }).click()
  await expect(page.getByText(/removed from SWE-Y3\./)).toBeVisible()
  await expect(dialog.getByText('No students have joined yet.')).toBeVisible()

  // The change is still there after a reload.
  await page.reload()
  await page.getByRole('button', { name: 'Students in SWE-Y3' }).click()
  await expect(
    page
      .getByRole('dialog', { name: 'Students in SWE-Y3' })
      .getByText('No students have joined yet.'),
  ).toBeVisible()
  expect(cspViolations).toEqual([])
})
