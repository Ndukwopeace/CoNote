/**
 * M4 "done when" (docs/MILESTONES.md): a student writes a note for a class, finds it from the
 * class, the course and the Notes page, edits it, reloads without losing it, and deletes it.
 */

// Playwright's assertions and test function.
import { expect, test } from '@playwright/test'

// Shared helpers.
import { expectNoAxeViolations, signIn, watchCspViolations } from './helpers.ts'

test('a student writes, finds, edits and deletes a note', async ({ page }) => {
  // Start collecting CSP violations before anything loads.
  const cspViolations = watchCspViolations(page)

  // Sign in and open a class's Notes tab.
  await page.goto('/login')
  await signIn(page)
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto('/courses/swe-311/classes/swe-311-c4?tab=notes')

  // Add Note opens the editor for this class.
  await page.getByRole('link', { name: 'Add Note' }).click()
  await expect(page).toHaveURL(/\/notes\/new\?classId=swe-311-c4$/)
  await expect(page.getByText('SWE 311 · SDLC Models')).toBeVisible()
  await expectNoAxeViolations(page)

  // Write: title, formatted body, a tag.
  await page.getByRole('textbox', { name: /Title/ }).fill('Spiral model')
  await page.getByRole('textbox', { name: 'Note', exact: true }).click()
  await page.keyboard.type('Risk-driven iterations')
  await page.keyboard.press('ControlOrMeta+a')
  await page.getByRole('button', { name: 'Bold' }).click()
  await page.getByRole('button', { name: 'Question' }).click()
  await page.getByRole('button', { name: 'Save Note' }).click()

  // Saved: toast, and back on the class's Notes tab with the note listed.
  await expect(page.getByText('Note saved.')).toBeVisible()
  await expect(page).toHaveURL(/\/courses\/swe-311\/classes\/swe-311-c4\?tab=notes$/)
  await expect(page.getByRole('tabpanel').getByRole('link', { name: /Spiral model/ })).toBeVisible()

  // Found from the course's Notes tab.
  await page.goto('/courses/swe-311?tab=notes')
  await expect(page.getByRole('tabpanel').getByRole('link', { name: /Spiral model/ })).toBeVisible()

  // Found from the Notes page by searching.
  await page.goto('/notes')
  await page.getByRole('searchbox', { name: 'Search notes' }).fill('spiral')
  const row = page
    .getByRole('list', { name: 'My notes' })
    .getByRole('link', { name: 'Spiral model', exact: true })
  await expect(row).toBeVisible()
  await expectNoAxeViolations(page)

  // Open it: the body keeps its bold formatting, sanitised.
  await row.click()
  await expect(page.getByRole('heading', { level: 1, name: 'Spiral model' })).toBeVisible()
  await expect(page.locator('.note-content strong')).toHaveText('Risk-driven iterations')

  // Edit the title.
  await page.getByRole('link', { name: 'Edit' }).click()
  const title = page.getByRole('textbox', { name: /Title/ })
  await title.fill('Spiral model (Boehm)')
  await page.getByRole('button', { name: 'Save Note' }).click()
  await expect(page).toHaveURL(/\?tab=notes$/)

  // A reload keeps it.
  await page.reload()
  await expect(
    page.getByRole('tabpanel').getByRole('link', { name: /Spiral model \(Boehm\)/ }),
  ).toBeVisible()

  // Delete it from the read view, after confirming.
  await page
    .getByRole('tabpanel')
    .getByRole('link', { name: /Spiral model \(Boehm\)/ })
    .click()
  await page.getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page).toHaveURL(/\/notes$/)
  await expect(page.getByText('Note deleted.')).toBeVisible()
  await expect(page.getByRole('link', { name: /Spiral model/ })).toHaveCount(0)

  // SECURITY: the whole journey ran without the security policy blocking anything.
  expect(cspViolations).toEqual([])
})
