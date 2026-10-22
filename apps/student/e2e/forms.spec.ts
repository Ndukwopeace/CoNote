/**
 * Form fields and the iPhone's zoom. iOS Safari zooms the whole page when a field with text
 * smaller than 16px gets focus, and does not zoom back out, so on a touch screen every field must
 * use at least 16px. On a desktop the smaller, denser text stays. The "phone" project is a touch
 * screen and the "desktop" project is not, so one test covers both.
 */

// Playwright's assertions and test function.
import { expect, test, type Locator, type Page } from '@playwright/test'

// Shared helpers.
import { signIn } from './helpers.ts'

/** The size of the text in `field`, in pixels. */
async function fontSize(field: Locator): Promise<number> {
  return field.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))
}

/** Whether the screen is a touch screen, the way the stylesheet asks. */
async function isTouchScreen(page: Page): Promise<boolean> {
  return page.evaluate(() => window.matchMedia('(pointer: coarse)').matches)
}

/**
 * Proves `field` is at least 16px on a touch screen. On a desktop the compact text stays, unless
 * the field was never compact (`compactOnDesktop` false), as with the composer.
 */
async function expectNoZoomSize(page: Page, field: Locator, { compactOnDesktop = true } = {}) {
  const size = await fontSize(field)
  if (await isTouchScreen(page)) {
    expect(size).toBeGreaterThanOrEqual(16)
  } else if (compactOnDesktop) {
    // The compact desktop text is deliberate: the rule is for touch screens only.
    expect(size).toBeLessThan(16)
  }
}

test('the sign-in fields are big enough that iOS does not zoom', async ({ page }) => {
  await page.goto('/login')
  await expectNoZoomSize(page, page.getByLabel('Email address'))
  await expectNoZoomSize(page, page.getByLabel('Password', { exact: true }))
})

test('the notes filters and the chat box do not trigger the zoom either', async ({ page }) => {
  await page.goto('/login')
  await signIn(page)
  await page.waitForURL('**/dashboard')

  // The notes screen: its search box and its two filters.
  await page.goto('/notes')
  await expectNoZoomSize(page, page.getByRole('combobox').first())

  // Ask AI: the question box.
  await page.goto('/ask-ai')
  await expectNoZoomSize(page, page.getByRole('textbox', { name: 'Ask a question' }))

  // The note composer on Home: the text box, and the title field from the plus menu.
  await page.goto('/dashboard')
  await expectNoZoomSize(page, page.getByRole('textbox', { name: 'Note', exact: true }), {
    compactOnDesktop: false,
  })
  await page.getByRole('button', { name: 'More options' }).click()
  await page.getByRole('menuitem', { name: 'Add a title' }).click()
  await expectNoZoomSize(page, page.getByRole('textbox', { name: 'Title' }), {
    compactOnDesktop: false,
  })
})
