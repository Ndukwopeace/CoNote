/**
 * M3 "done when" (docs/MILESTONES.md): every course and class in the demo data can be reached
 * from Home, and the Live badge matches the clock. Runs on desktop and phone.
 */

// Playwright's assertions and test function.
import { expect, test } from '@playwright/test'

// Shared helpers.
import { expectNoAxeViolations, homeNav, signIn, watchCspViolations } from './helpers.ts'

test('every course and class is reachable from Home', async ({ page, isMobile }) => {
  // Start collecting CSP violations before anything loads.
  const cspViolations = watchCspViolations(page)

  // Sign in and land on Home.
  await page.goto('/login')
  await signIn(page)
  await expect(page).toHaveURL(/\/dashboard$/)

  // Home is the note form (D101); the demo always has a class in progress, so it is the chosen one.
  await expect(page.getByRole('button', { name: /Class: SWE 311 · SDLC Models/ })).toBeVisible()
  await expectNoAxeViolations(page)

  // Home → the Classes list through Home's navigation; it marks the class in progress as Live.
  await (await homeNav(page, isMobile)).getByRole('link', { name: 'Classes', exact: true }).click()
  await expect(page.getByRole('main')).toContainText('Live')
  await expectNoAxeViolations(page)

  // Back Home, then → My Courses through the navigation.
  await page.goto('/dashboard')
  await (await homeNav(page, isMobile)).getByRole('link', { name: 'Courses', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'My Courses' })).toBeVisible()
  await expectNoAxeViolations(page)

  // The course cards: each link's name starts with its code.
  const courseLinks = page.getByRole('main').getByRole('link', { name: /^[A-Z]{3} \d{3}/ })
  await expect(courseLinks).toHaveCount(4)

  // Visit every course, then every class in it.
  for (let c = 0; c < 4; c++) {
    // Open the course.
    await courseLinks.nth(c).click()
    await expect(page).toHaveURL(/\/courses\/[\w-]+$/)
    // Its Classes tab.
    await page.getByRole('tab', { name: 'Classes' }).click()
    await expect(page).toHaveURL(/\?tab=classes$/)
    const classLinks = page.getByRole('tabpanel').getByRole('link')
    await expect(classLinks.first()).toBeVisible()
    const classCount = await classLinks.count()
    expect(classCount).toBeGreaterThan(0)
    if (c === 0) await expectNoAxeViolations(page)

    // Each class opens its page with a heading, then Back returns to the Classes tab.
    for (let i = 0; i < classCount; i++) {
      await classLinks.nth(i).click()
      await expect(page).toHaveURL(/\/classes\/[\w-]+$/)
      await expect(page.getByRole('tab', { name: 'Overview', selected: true })).toBeVisible()
      if (c === 0 && i === 0) await expectNoAxeViolations(page)
      await page.goBack()
      await expect(page).toHaveURL(/\?tab=classes$/)
    }

    // Back to My Courses for the next one.
    await page.goBack()
    await expect(page.getByRole('heading', { level: 1, name: 'My Courses' })).toBeVisible()
  }

  // Home → All classes through Home's navigation: all twelve demo classes are listed.
  await page.goto('/dashboard')
  await (await homeNav(page, isMobile)).getByRole('link', { name: 'Classes', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'All classes' })).toBeVisible()
  await expect(page.getByRole('main').getByRole('listitem')).toHaveCount(12)
  await expectNoAxeViolations(page)

  // SECURITY: the whole journey ran without the security policy blocking anything.
  expect(cspViolations).toEqual([])
})
