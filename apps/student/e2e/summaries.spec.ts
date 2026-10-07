/**
 * M5 browser tests (docs/MILESTONES.md): summaries, Ask CoNote AI, notifications, settings and
 * search on demo data. A summary that is not published never shows its content.
 */

// Playwright's assertions and test function.
import { expect, test, type Page } from '@playwright/test'

// Shared helpers.
import { expectNoAxeViolations, signIn, watchCspViolations } from './helpers.ts'

/** Signs in and waits for Home. */
async function signInToHome(page: Page) {
  await page.goto('/login')
  await signIn(page)
  await expect(page).toHaveURL(/\/dashboard$/)
}

test('a student reads a new summary and asks CoNote AI about it', async ({ page, isMobile }) => {
  // Start collecting CSP violations before anything loads.
  const cspViolations = watchCspViolations(page)
  await signInToHome(page)

  // Home counts two new summaries; the card opens the Summaries tab.
  await page.getByRole('link', { name: '2 New Summaries' }).click()
  await expect(page).toHaveURL(/\/notes\?tab=summaries$/)
  await page
    .getByRole('tabpanel')
    .getByRole('link', { name: /Software Requirements/ })
    .click()

  // The summary: header, approval label, content.
  await expect(page.getByRole('heading', { level: 1, name: 'Software Requirements' })).toBeVisible()
  await expect(page.getByText('Reviewed by Dr. Smith')).toBeVisible()
  await expect(
    page.getByText('AI-generated from class notes, reviewed and approved by your teacher.'),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Key Concepts' })).toBeVisible()
  await expectNoAxeViolations(page)

  // Ask CoNote AI: a side panel on desktop, a bottom sheet on phones.
  if (isMobile) await page.getByRole('button', { name: 'Ask CoNote AI' }).click()
  const chat = isMobile
    ? page.getByRole('dialog', { name: 'Ask CoNote AI' })
    : page.getByRole('complementary', { name: 'Ask CoNote AI' })
  await chat.getByRole('button', { name: 'Explain the main idea of this class simply.' }).click()
  await expect(chat.getByText('CoNote AI is typing…')).toBeVisible()
  await expect(
    chat.getByRole('log').getByText(/In one line: say what the system must do/),
  ).toBeVisible()
  await expectNoAxeViolations(page)
  if (isMobile) await page.keyboard.press('Escape')

  // Opening it marked it viewed: Home now counts one.
  await page.goto('/dashboard')
  await expect(page.getByRole('link', { name: '1 New Summaries' })).toBeVisible()

  // SECURITY: nothing in the journey was blocked by the security policy.
  expect(cspViolations).toEqual([])
})

test('an unpublished summary shows only its state', async ({ page }) => {
  await signInToHome(page)

  // A class whose summary is with the teacher.
  await page.goto('/courses/swe-311/classes/swe-311-c3/summary')
  await expect(page.getByText('Summary in review')).toBeVisible()
  await expect(page.getByRole('tab', { name: 'AI Summary' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Key Concepts' })).toHaveCount(0)
})

test('Ask CoNote AI keeps one context per conversation', async ({ page }) => {
  await signInToHome(page)
  await page.goto('/ask-ai?courseId=eng-201')

  // Preset from the address, then one exchange by typing and Enter.
  const picker = page.getByRole('combobox', { name: 'Context' })
  await expect(picker).toHaveValue('course:eng-201')
  await page.getByRole('textbox', { name: 'Ask a question' }).fill('What is a thesis?')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('log').getByText(/This is the demo/)).toBeVisible()
  await expectNoAxeViolations(page)

  // Switching asks first, then starts afresh.
  await picker.selectOption('all')
  await expect(page.getByRole('alertdialog', { name: 'Start a new conversation?' })).toBeVisible()
  await page.getByRole('button', { name: 'Start new conversation' }).click()
  await expect(page.getByRole('log').getByRole('listitem')).toHaveCount(0)
  await expect(page).toHaveURL(/\/ask-ai$/)
})

test('notifications are read, and the bell follows', async ({ page }) => {
  await signInToHome(page)
  const bell = page.getByRole('banner').getByRole('link', { name: /^Notifications/ })
  await expect(bell).toHaveAccessibleName('Notifications, 3 unread')

  // The page, then "Mark all as read".
  await bell.click()
  await expect(page.getByRole('heading', { level: 1, name: 'Notifications' })).toBeVisible()
  await expectNoAxeViolations(page)
  // How many notifications the demo backend has saved as read (its list in browser storage).
  const savedAsRead = () =>
    page.evaluate(
      () =>
        (JSON.parse(localStorage.getItem('conote:mock:read-notifications') ?? '[]') as unknown[])
          .length,
    )
  const savedBefore = await savedAsRead()
  await page.getByRole('button', { name: 'Mark all as read' }).click()
  // The bell clears at once (optimistic update)...
  await expect(bell).toHaveAccessibleName('Notifications')
  // ...but the save lands only after the demo's simulated network delay. Reloading before then
  // would drop it, so wait for it, as a student would wait for a real request to finish.
  await expect.poll(savedAsRead).toBeGreaterThan(savedBefore)

  // Still read after a reload.
  await page.reload()
  await expect(
    page.getByRole('banner').getByRole('link', { name: /^Notifications/ }),
  ).toHaveAccessibleName('Notifications')
})

test('settings save, and search finds a class', async ({ page }) => {
  await signInToHome(page)

  // Profile: a new name reaches the account menu.
  await page.goto('/settings/profile')
  const name = page.getByRole('textbox', { name: 'Full name' })
  await name.fill('Victory A. Okafor')
  await page.getByRole('button', { name: 'Save Changes' }).click()
  await expect(page.getByText('Profile saved.')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Account menu for Victory A. Okafor' }),
  ).toBeVisible()
  await expectNoAxeViolations(page)

  // Every other section opens and passes the accessibility rules.
  for (const section of ['Account', 'Notifications', 'Privacy', 'Help & Support']) {
    await page
      .getByRole('navigation', { name: 'Settings sections' })
      .getByRole('link', { name: section })
      .click()
    await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible()
    await expectNoAxeViolations(page)
  }
  await expect(page.getByText(/Version \d+\.\d+\.\d+/)).toBeVisible()

  // Search: type, choose with the keyboard, open.
  const search = page.getByRole('combobox', { name: 'Search courses, classes and notes' })
  await search.fill('essay')
  await expect(page.getByRole('listbox', { name: 'Search results' })).toBeVisible()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/courses\/eng-201\/classes\/eng-201-c1$/)
})
