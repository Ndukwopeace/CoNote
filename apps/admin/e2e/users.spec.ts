/**
 * Browser tests for Users (admin REQUIREMENTS section 11), on desktop and phone profiles, against
 * the production build with the demo platform.
 */

// Playwright's test runner and assertions.
import { expect, test } from '@playwright/test'

// Admin helpers.
import { expectNoAxeViolations, signInAs, watchCspViolations } from './helpers.ts'

test('the list filters through the address, which survives a reload', async ({ page }) => {
  // Watch for Content-Security-Policy breaks throughout.
  const cspViolations = watchCspViolations(page)
  // Sign in, then open Users.
  await page.goto('/admin/login?redirect=%2Fadmin%2Fusers')
  await signInAs(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible()
  // The demo's 48 students, 20 to a page.
  await expect(page.getByText('Showing 1–20 of 48')).toBeVisible()

  // Filter to invited students; the address follows, and a reload keeps it.
  await page.getByLabel('Status').selectOption({ label: 'Invited' })
  await expect(page).toHaveURL(/status=pending/)
  await expect(page.getByText('Showing 1–2 of 2')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Showing 1–2 of 2')).toBeVisible()
  await expect(page.getByLabel('Status')).toHaveValue('pending')

  // The teachers tab, then a search.
  await page.getByRole('tab', { name: 'Teachers' }).click()
  await expect(page).toHaveURL(/tab=teachers/)
  await page.getByRole('searchbox', { name: 'Search users' }).fill('smith')
  await expect(page.getByText('Showing 1–1 of 1')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Dr. Smith' })).toBeVisible()

  // No accessibility problems, and nothing blocked by the policy.
  await expectNoAxeViolations(page)
  expect(cspViolations).toEqual([])
})

test('an invitation is listed as invited and kept after a reload', async ({ page }) => {
  // Sign in, then open Users.
  await page.goto('/admin/login?redirect=%2Fadmin%2Fusers')
  await signInAs(page)

  // Invite a teacher.
  await page.getByRole('button', { name: 'Invite user' }).click()
  const dialog = page.getByRole('dialog', { name: 'Invite a user' })
  await dialog.getByLabel('Role').selectOption('teacher')
  await dialog.getByLabel('Full name').fill('Ngozi Eze')
  await dialog.getByLabel('Email').fill('ngozi.eze@conote.example')
  await dialog.getByLabel('Department').selectOption('English')
  await expectNoAxeViolations(page)
  await dialog.getByRole('button', { name: 'Send invitation' }).click()
  await expect(page.getByText('Invitation sent to ngozi.eze@conote.example.')).toBeVisible()

  // Listed among the teachers as invited, and still there after a reload.
  await page.goto('/admin/users?tab=teachers&q=ngozi')
  await expect(page.getByRole('link', { name: 'Ngozi Eze' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('link', { name: 'Ngozi Eze' })).toBeVisible()
  await expect(page.getByRole('table').getByText('Invited')).toBeVisible()
})

test('a suspended account can no longer sign in', async ({ page }) => {
  // Sign in and open the demo teacher's page.
  await page.goto('/admin/login?redirect=%2Fadmin%2Fusers%3Ftab%3Dteachers%26q%3Dmbarga')
  await signInAs(page)
  await page.getByRole('link', { name: 'Sarah Mbarga' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Sarah Mbarga' })).toBeVisible()

  // Suspend, after confirming.
  await page.getByRole('button', { name: 'Suspend' }).click()
  const confirm = page.getByRole('alertdialog', { name: 'Suspend Sarah Mbarga?' })
  await confirm.getByRole('button', { name: 'Suspend' }).click()
  await expect(page.getByText('Sarah Mbarga is now suspended.')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Status history' })).toContainText('Suspended')
  await expectNoAxeViolations(page)

  // Sign out, then try to sign in as the teacher.
  await page.getByRole('button', { name: /Account menu/ }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'CoNote Admin' })).toBeVisible()
  await signInAs(page, 'teacher@conote.example')
  await expect(page.getByRole('alert')).toHaveText(
    'This account is not active. Contact your administrator.',
  )
})

test('phones show each person as a card', async ({ page, isMobile }) => {
  // The card layout is for the phone profile.
  test.skip(!isMobile, 'Cards are checked on the phone profile')
  // Sign in, then open Users.
  await page.goto('/admin/login?redirect=%2Fadmin%2Fusers')
  await signInAs(page)

  // The first person is a card (a block, not a table row), and each field shows its column's
  // name beside it (CSS generated text, which screen readers read with the value).
  const firstRow = page.getByRole('row').nth(1)
  await expect(firstRow).toHaveCSS('display', 'block')
  const labels = await firstRow
    .getByRole('cell')
    .evaluateAll((cells) => cells.map((cell) => getComputedStyle(cell, '::before').content))
  expect(labels.slice(0, 2)).toEqual(['"Student number"', '"Name"'])
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(overflow).toBe(false)
  await expectNoAxeViolations(page)
})
