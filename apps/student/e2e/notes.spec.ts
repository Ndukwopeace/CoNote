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

// D101, D102: Home is the note composer. The class on now is already chosen, so a note takes no
// navigation: type, send, and it is in the stream.
test('a student writes a note straight from Home', async ({ page }) => {
  // Start collecting CSP violations before anything loads.
  const cspViolations = watchCspViolations(page)

  // Sign in: Home opens on the statement and the composer, on the class in progress.
  await page.goto('/login')
  await signIn(page)
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { level: 1, name: "Let's CoNote" })).toBeVisible()
  await expect(page.getByRole('button', { name: /Class: SWE 311 · SDLC Models/ })).toBeVisible()
  await expectNoAxeViolations(page)

  // Tag it, type and send, without choosing a course or class.
  await page.getByRole('button', { name: 'Example', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'Note', exact: true })
    .fill('Agile favours working software')
  await page.getByRole('button', { name: 'Save note' }).click()

  // Still on Home: the note is in the stream, tagged, and the composer is empty again.
  await expect(page.getByText('Agile favours working software')).toBeVisible()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('textbox', { name: 'Note', exact: true })).toHaveValue('')

  // Its link opens the note, which lists it under the class.
  await page.getByRole('link', { name: 'Open note' }).last().click()
  await expect(page).toHaveURL(/\/notes\/[\w-]+$/)
  await expect(
    page.getByRole('heading', { level: 1, name: 'Agile favours working software' }),
  ).toBeVisible()

  // SECURITY: the whole journey ran without the security policy blocking anything.
  expect(cspViolations).toEqual([])
})

// D102: the same screen answers questions: Note | Ask.
test('a student switches Home to Ask and asks about the class', async ({ page }) => {
  await page.goto('/login')
  await signIn(page)
  await expect(page).toHaveURL(/\/dashboard$/)

  await page.getByRole('button', { name: 'Ask', exact: true }).click()
  await expect(page).toHaveURL(/mode=ask/)
  await page.getByRole('textbox', { name: 'Ask a question' }).fill('What is waterfall?')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByRole('log', { name: 'Conversation' })).toContainText('What is waterfall?')
  await expectNoAxeViolations(page)
})

// A note with no spaces must wrap inside its bubble, not push the bubble out of the screen.
test('a long unbroken note stays inside the screen', async ({ page }) => {
  await page.goto('/login')
  await signIn(page)
  await expect(page.getByRole('heading', { level: 1, name: "Let's CoNote" })).toBeVisible()

  // Send 200 letters with no space to break the line at.
  const unbroken = 'x'.repeat(200)
  await page.getByRole('textbox', { name: 'Note', exact: true }).fill(unbroken)
  await page.getByRole('button', { name: 'Save note' }).click()
  // The note's bubble is the first box inside the newest item of the stream.
  const bubble = page.getByRole('main').getByRole('listitem').last().locator('> div').first()
  await expect(bubble).toContainText(unbroken)

  // It sits inside the stream: nothing is cut off at either edge.
  const box = await bubble.boundingBox()
  const stream = await page.getByRole('main').boundingBox()
  expect(box).not.toBeNull()
  expect(stream).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(stream!.x)
  expect(box!.x + box!.width).toBeLessThanOrEqual(stream!.x + stream!.width)
  // The text wraps onto more than one line, rather than running on.
  expect(box!.height).toBeGreaterThan(60)
})

// The same for a long unbroken question in Ask mode.
test('a long unbroken question stays inside the screen', async ({ page }) => {
  await page.goto('/login')
  await signIn(page)
  await expect(page.getByRole('heading', { level: 1, name: "Let's CoNote" })).toBeVisible()

  await page.getByRole('button', { name: 'Ask', exact: true }).click()
  const unbroken = 'q'.repeat(200)
  await page.getByRole('textbox', { name: 'Ask a question' }).fill(unbroken)
  await page.getByRole('button', { name: 'Send' }).click()

  // Your question's bubble is inside the conversation: nothing is cut off at either edge.
  const bubble = page.getByRole('log', { name: 'Conversation' }).getByRole('listitem').first()
  await expect(bubble).toContainText(unbroken)
  const box = await bubble.boundingBox()
  const stream = await page.getByRole('main').boundingBox()
  expect(box).not.toBeNull()
  expect(stream).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(stream!.x)
  expect(box!.x + box!.width).toBeLessThanOrEqual(stream!.x + stream!.width)
})
