/**
 * Browser tests for the dashboard (admin REQUIREMENTS section 10), on desktop and phone profiles,
 * against the production build with the demo platform.
 */

// Playwright's test runner and assertions.
import { expect, test } from '@playwright/test'

// Admin helpers.
import { expectNoAxeViolations, signInAs, watchCspViolations } from './helpers.ts'

/** Where the demo health override lives (src/services/mock/mockHealthService.ts). */
const HEALTH_OVERRIDE_KEY = 'conote-admin-demo:health'

test('the dashboard shows counts, alerts, activity and health', async ({ page }) => {
  // Watch for Content-Security-Policy breaks throughout.
  const cspViolations = watchCspViolations(page)
  // Sign in; the dashboard is the landing page.
  await page.goto('/admin/login')
  await signInAs(page)
  await expect(page.getByRole('heading', { level: 1, name: /^Good .+, Amara$/ })).toBeVisible()

  // The demo platform's counts, as links.
  await expect(page.getByRole('link', { name: '48 Students' })).toBeVisible()
  await expect(page.getByRole('link', { name: '6 Teachers' })).toBeVisible()

  // Alerts from the demo's problems, critical first.
  const alerts = page.getByRole('list', { name: 'Alerts' })
  await expect(alerts.getByRole('link').first()).toHaveText(/security event/)
  await expect(alerts.getByRole('link', { name: /course has no teacher/ })).toBeVisible()

  // Every part of the platform reports its state.
  await expect(page.getByRole('list', { name: 'System health' }).getByRole('listitem')).toHaveCount(
    5,
  )

  // The chart and the table hold the same 30 days.
  await expect(page.getByRole('figure', { name: /Notes created per day/ })).toBeVisible()
  await page.getByRole('button', { name: 'Last 30 days' }).click()
  await expect(page.getByRole('button', { name: 'Last 30 days' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByLabel('Show').selectOption({ label: 'Resources opened' })
  await expect(page.getByRole('figure', { name: /Resources opened per day/ })).toBeVisible()
  await page.getByRole('button', { name: 'Show as table' }).click()
  await expect(
    page.getByRole('table', { name: /Resources opened per day/ }).getByRole('row'),
  ).toHaveCount(31)

  // No accessibility problems, and nothing blocked by the policy.
  await expectNoAxeViolations(page)
  expect(cspViolations).toEqual([])
})

test('an alert opens the screen that fixes it', async ({ page }) => {
  // Sign in.
  await page.goto('/admin/login')
  await signInAs(page)

  // Follow the untaught-course alert.
  await page
    .getByRole('list', { name: 'Alerts' })
    .getByRole('link', { name: /course has no teacher/ })
    .click()

  // The course list opens, filtered to courses without a teacher.
  await expect(page).toHaveURL(/\/admin\/courses\?teacher=none$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Courses' })).toBeVisible()
})

test('the chart follows the keyboard', async ({ page, isMobile }) => {
  // Keyboard use is for the desktop profile.
  test.skip(isMobile, 'Keyboard navigation is checked on desktop')
  // Sign in.
  await page.goto('/admin/login')
  await signInAs(page)

  // Focus the chart: it reports today, then the day before.
  const slider = page.getByRole('slider', { name: 'Notes created, day' })
  await slider.focus()
  await expect(slider).toHaveAttribute('aria-valuenow', '6')
  await page.keyboard.press('ArrowLeft')
  await expect(slider).toHaveAttribute('aria-valuenow', '5')
  await page.keyboard.press('Home')
  await expect(slider).toHaveAttribute('aria-valuenow', '0')
})

test('health states show in words, including Unknown', async ({ page }) => {
  // Set the demo health check's states before the app loads.
  await page.addInitScript((key) => {
    window.localStorage.setItem(
      key,
      JSON.stringify({ ai_service: 'degraded', storage: 'unavailable', notifications: 'unknown' }),
    )
  }, HEALTH_OVERRIDE_KEY)
  // Sign in.
  await page.goto('/admin/login')
  await signInAs(page)

  // Each part with its state.
  const health = page.getByRole('list', { name: 'System health' })
  await expect(health.getByRole('listitem').nth(2)).toHaveText('AI serviceDegraded')
  await expect(health.getByRole('listitem').nth(3)).toHaveText('StorageUnavailable')
  await expect(health.getByRole('listitem').nth(4)).toHaveText('NotificationsUnknown')
  await expectNoAxeViolations(page)
})
