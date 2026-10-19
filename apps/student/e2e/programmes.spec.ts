/**
 * Browser test for asking to join a programme (D105, D106): a new student asks from the dialog, sees
 * the request wait for an administrator, and can withdraw it. Nothing is enrolled until an
 * administrator approves, which happens in the admin console. Runs on desktop and on a phone,
 * against the production build with the production security headers.
 */

// Playwright's assertions and test function.
import { expect, test } from '@playwright/test'

// Shared helpers.
import { expectNoAxeViolations, watchCspViolations } from './helpers.ts'

test('a new student asks to join a programme and nothing is enrolled until it is approved', async ({
  page,
}) => {
  // Watch for Content-Security-Policy breaks throughout.
  const cspViolations = watchCspViolations(page)
  // Sign up: a new student starts in no courses.
  await page.goto('/signup')
  await page.getByLabel('Full name').fill('Ada Obi')
  await page.getByLabel('Email address').fill('ada@example.com')
  await page.getByLabel('Password', { exact: true }).fill('password1')
  await page.getByLabel('Confirm password').fill('password1')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Sign up' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)

  // The dialog offers the open programmes first; the closed one is not there.
  const dialog = page.getByRole('dialog', { name: 'Join your programme' })
  const group = dialog.getByRole('group', { name: 'Choose your programme' })
  await expect(group.getByText('Software Engineering, Year 3')).toBeVisible()
  await expect(group.getByText('3 courses: BUS 207, CSE 205, SWE 311')).toBeVisible()
  await expect(group.getByText('Law, Year 1')).toHaveCount(0)
  await expectNoAxeViolations(page)

  // A long programme name must not push the dialog wider than the screen: every button stays on
  // screen, and the long name is readable in full.
  const viewport = page.viewportSize()
  for (const button of await group.getByRole('button').all()) {
    const box = await button.boundingBox()
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport?.width ?? 0)
  }
  await expect(group.getByText('Cloud Security and Data Protection Engineering')).toBeVisible()

  // Asking records a waiting request. It does not enrol: the dialog stays, and the others wait.
  await group.getByRole('button', { name: 'Request to join SWE-Y3' }).click()
  await expect(page.getByText('Request sent. An administrator will approve it.')).toBeVisible()
  await expect(group.getByText('Requested')).toBeVisible()
  await expect(group.getByRole('button', { name: 'Request to join BMS-Y1' })).toBeDisabled()
  await expect(dialog).toBeVisible()

  // The request survives a reload, and the student still has no courses.
  await page.reload()
  await expect(dialog).toBeHidden()
  await page.goto('/courses')
  await expect(page.getByText(/not enrolled in any courses yet/)).toBeVisible()
  await page.getByRole('button', { name: 'Join programme' }).click()
  const again = page
    .getByRole('dialog', { name: 'Join your programme' })
    .getByRole('group', { name: 'Choose your programme' })
  await expect(again.getByText('Requested')).toBeVisible()

  // Withdrawing frees the other programmes.
  await again.getByRole('button', { name: 'Cancel request for SWE-Y3' }).click()
  await expect(again.getByText('Requested')).toHaveCount(0)
  await expect(again.getByRole('button', { name: 'Request to join BMS-Y1' })).toBeEnabled()
  expect(cspViolations).toEqual([])
})
