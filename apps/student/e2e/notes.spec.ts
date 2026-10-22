/**
 * M4 "done when" (docs/MILESTONES.md): a student writes a note for a class, finds it from the
 * class, the course and the Notes page, edits it, reloads without losing it, and deletes it. Since
 * D109 the writing and the editing both happen in the chat on Home.
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

  // Add Note opens the chat on Home for this class, with the cursor in the box.
  await page.getByRole('link', { name: 'Add Note' }).click()
  await expect(page).toHaveURL(/\/dashboard\?write=1&classId=swe-311-c4$/)
  await expect(
    page.getByRole('button', { name: /Class: Software Engineering · SDLC Models/ }),
  ).toBeVisible()
  const box = page.getByRole('textbox', { name: 'Note', exact: true })
  await expect(box).toBeFocused()
  await expectNoAxeViolations(page)

  // Write: a title from the plus menu, the text, a tag.
  await page.getByRole('button', { name: 'More options' }).click()
  await page.getByRole('menuitem', { name: 'Add a title' }).click()
  await page.getByRole('textbox', { name: 'Title' }).fill('Spiral model')
  await box.fill('Risk-driven iterations')
  await page.getByRole('button', { name: 'Question', exact: true }).click()
  await page.getByRole('button', { name: 'Save note' }).click()

  // Saved: it is in the stream, and the composer is empty for the next thought.
  await expect(page.getByText('Risk-driven iterations')).toBeVisible()
  await expect(box).toHaveValue('')

  // Found from the class's Notes tab and the course's.
  await page.goto('/courses/swe-311/classes/swe-311-c4?tab=notes')
  await expect(page.getByRole('tabpanel').getByRole('link', { name: /Spiral model/ })).toBeVisible()
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

  // Open it: the read view shows the text and the tag.
  await row.click()
  await expect(page.getByRole('heading', { level: 1, name: 'Spiral model' })).toBeVisible()
  await expect(page.getByText('Risk-driven iterations')).toBeVisible()

  // Edit opens it in the chat's composer, in its own class, which cannot be changed meanwhile.
  await page.getByRole('link', { name: 'Edit' }).click()
  await expect(page).toHaveURL(/\/dashboard\?edit=/)
  await expect(page.getByText('Editing a note')).toBeVisible()
  await expect(
    page.getByRole('button', { name: /Class: Software Engineering · SDLC Models, SWE 311\./ }),
  ).toBeDisabled()
  await expect(box).toHaveValue('Risk-driven iterations')
  await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue('Spiral model')
  await page.getByRole('textbox', { name: 'Title' }).fill('Spiral model (Boehm)')
  await box.fill('Risk-driven iterations, each loop')
  await page.getByRole('button', { name: 'Save note' }).click()

  // Back to writing a new note, with the change in the stream and in the lists, after a reload too.
  await expect(page.getByText('Editing a note')).toHaveCount(0)
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByText('Risk-driven iterations, each loop')).toBeVisible()
  await page.goto('/notes')
  await page.reload()
  await expect(
    page
      .getByRole('list', { name: 'My notes' })
      .getByRole('link', { name: 'Spiral model (Boehm)', exact: true }),
  ).toBeVisible()

  // Delete it from the read view, after confirming.
  await page
    .getByRole('list', { name: 'My notes' })
    .getByRole('link', { name: 'Spiral model (Boehm)', exact: true })
    .click()
  await page.getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page).toHaveURL(/\/notes$/)
  await expect(page.getByText('Note deleted.')).toBeVisible()
  await expect(page.getByRole('link', { name: /Spiral model/ })).toHaveCount(0)

  // SECURITY: the whole journey ran without the security policy blocking anything.
  expect(cspViolations).toEqual([])
})

// FR-NTE-5: what was typed and not sent is still there after a reload, and gone once it is sent.
test('an unsent note survives a reload and is gone once it is sent', async ({ page }) => {
  await page.goto('/login')
  await signIn(page)
  await expect(page).toHaveURL(/\/dashboard$/)
  const box = page.getByRole('textbox', { name: 'Note', exact: true })

  // Type without sending; wait until the draft is written, then reload.
  await box.fill('Half a thought')
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('conote:draft:class:swe-311-c4')))
    .not.toBeNull()
  await page.reload()
  await expect(box).toHaveValue('Half a thought')

  // Sending clears the draft: it does not come back.
  await page.getByRole('button', { name: 'Save note' }).click()
  await expect(page.getByText('Half a thought')).toBeVisible()
  await expect(box).toHaveValue('')
  await page.reload()
  await expect(box).toHaveValue('')
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
  await expect(
    page.getByRole('button', { name: /Class: Software Engineering · SDLC Models/ }),
  ).toBeVisible()
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
