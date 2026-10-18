/**
 * Browser test for the light and dark themes (D104): light by default, a switch that works on
 * every page, a choice that survives reloads and sign-out, and no accessibility violations in
 * either theme.
 */

// Playwright's test runner.
import { expect, test } from '@playwright/test'

// Shared helpers.
import { expectNoAxeViolations, mainNav, signIn, watchCspViolations } from './helpers.ts'

// Proves the app starts light, switches to dark on every page, and remembers the choice.
test('the theme switches on every page and is remembered', async ({ page, isMobile }) => {
  // Collect any security-policy violations.
  const cspViolations = watchCspViolations(page)
  // Sign in; Home opens.
  await page.goto('/login')
  await signIn(page)
  await expect(page).toHaveURL(/\/dashboard$/)

  // A first visit is light. Wait for Home's heading first: while it loads, the page has none.
  await expect(page.getByRole('heading', { level: 1, name: /Let's CoNote/ })).toBeVisible()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  await expectNoAxeViolations(page)

  // Switch to dark through the navigation.
  await (await mainNav(page, isMobile)).getByRole('button', { name: 'Dark mode' }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  // On phones the drawer stays open after the switch; close it so the page is the active layer.
  if (isMobile) await page.keyboard.press('Escape')
  await expectNoAxeViolations(page)

  // The same design on every other page, still dark, with no accessibility violations (dark
  // colours have their own contrast limits).
  for (const [address, heading] of [
    ['/courses', 'My Courses'],
    ['/classes', 'All classes'],
    ['/notes', 'Notes'],
    ['/notifications', 'Notifications'],
    ['/settings/profile', 'Settings'],
  ] as const) {
    await page.goto(address)
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await expectNoAxeViolations(page)
  }
  await page.goto('/courses')

  // Dark survives a reload.
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'My Courses' })).toBeVisible()
  await expect(page.locator('html')).toHaveClass(/dark/)

  // Settings has the same choice, and switching back to light works there.
  await page.goto('/settings/profile')
  await page.getByRole('button', { name: 'Light', exact: true }).click()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  await expectNoAxeViolations(page)

  // SECURITY: the whole journey ran without the security policy blocking anything.
  expect(cspViolations).toEqual([])
})

// Proves signing out keeps the choice: it belongs to the device, not to the student's data.
test('the theme survives sign-out', async ({ page, isMobile }) => {
  await page.goto('/login')
  await signIn(page)
  // On phones the drawer stays open after the switch, so one open navigation serves both clicks.
  const nav = await mainNav(page, isMobile)
  await nav.getByRole('button', { name: 'Dark mode' }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)

  // Sign out through the navigation; the guard sends the student to the landing page.
  await nav.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/$/)

  // The landing page is dark too.
  await expect(page.locator('html')).toHaveClass(/dark/)
})
