/**
 * End-to-end check for signing in with an emailed code (D114): ask for a code, type it, and be in.
 * The demo shows the code on screen instead of emailing it.
 */

// Playwright test runner and assertions.
import { expect, test } from '@playwright/test'

// Teacher helpers.
import { expectNoAxeViolations, watchCspViolations } from './helpers.ts'

test('a teacher signs in with a code and no password', async ({ page }) => {
  // Watch for Content-Security-Policy breaks throughout.
  const cspViolations = watchCspViolations(page)

  // From the password form to the code way in.
  await page.goto('/teacher/login')
  await page.getByRole('button', { name: 'Email me a sign-in code' }).click()
  await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0)
  await expectNoAxeViolations(page)

  // Ask for the code; the demo shows it where the email would carry it.
  await page.getByLabel('Email').fill('teacher@conote.example')
  await page.getByRole('button', { name: 'Send code' }).click()
  const hint = page.getByTestId('demo-code')
  await expect(hint).toBeVisible()
  await expectNoAxeViolations(page)
  const code = (await hint.textContent())?.match(/\d{6}/)?.[0] ?? ''
  expect(code).toHaveLength(6)

  // A wrong code is refused, and the field is empty again.
  const wrong = code === '000000' ? '111111' : '000000'
  await page.getByLabel('Sign-in code').fill(wrong)
  await expect(page.getByRole('alert')).toHaveText(
    'That code is not right or has expired. Ask for a new one.',
  )
  await expect(page.getByLabel('Sign-in code')).toHaveValue('')

  // The right code signs in at the last digit, with no button pressed.
  await page.getByLabel('Sign-in code').fill(code)
  await expect(page.getByRole('heading', { level: 1, name: 'My courses' })).toBeVisible()

  expect(cspViolations).toEqual([])
})
