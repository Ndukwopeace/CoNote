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

  // The dialog asks for the year first (D115), then shows that year's programmes only.
  const dialog = page.getByRole('dialog', { name: 'Join your programme' })
  await dialog
    .getByRole('group', { name: 'Choose your year' })
    .getByRole('button', { name: 'Year 3' })
    .click()
  const group = dialog.getByRole('group', { name: 'Choose your programme' })
  await expect(group.getByText('Software Engineering, Year 3')).toBeVisible()
  await expect(group.getByText('Biomedical Sciences, Year 1')).toHaveCount(0)
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

  // Asking records a waiting request. It does not enrol: the dialog stays, and only the programme
  // asked for is left in view.
  await group.getByRole('button', { name: 'Request to join Software Engineering, Year 3' }).click()
  await expect(page.getByText('Request sent. An administrator will approve it.')).toBeVisible()
  await expect(dialog.getByText('Requested')).toBeVisible()
  await expect(dialog.getByText('Cloud Security and Data Protection Engineering')).toHaveCount(0)
  await expect(dialog).toBeVisible()

  // The request survives a reload, and the student still has no courses.
  await page.reload()
  await expect(dialog).toBeHidden()
  await page.goto('/courses')
  await expect(page.getByText(/not enrolled in any courses yet/)).toBeVisible()
  await page.getByRole('button', { name: 'Join programme' }).click()
  const again = page.getByRole('dialog', { name: 'Join your programme' })
  await expect(again.getByText('Requested')).toBeVisible()
  // It opens on the waiting request, with no year to choose.
  await expect(again.getByRole('group', { name: 'Choose your year' })).toHaveCount(0)

  // Withdrawing brings the choice back, starting from the year again after a reload.
  await again
    .getByRole('button', { name: 'Cancel request for Software Engineering, Year 3' })
    .click()
  await expect(again.getByText('Requested')).toHaveCount(0)
  await again.getByRole('button', { name: 'Year 3' }).click()
  await expect(
    again.getByRole('button', { name: 'Request to join Software Engineering, Year 3' }),
  ).toBeEnabled()
  await again.getByRole('button', { name: 'Change year' }).click()
  await again.getByRole('button', { name: 'Year 1' }).click()
  await expect(
    again.getByRole('button', { name: 'Request to join Biomedical Sciences, Year 1' }),
  ).toBeEnabled()
  expect(cspViolations).toEqual([])
})
