import { AxeBuilder } from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

/**
 * Runs axe on the current page, including colour contrast, and fails on any violation.
 * `preload: false` stops axe from fetch()-ing stylesheets itself, which the app's CSP would
 * rightly block and which would otherwise show up as false CSP violations.
 */
export async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).options({ preload: false }).analyze()
  const summary = results.violations.map(
    (violation) => `${violation.id}: ${violation.help} (${violation.nodes.length} nodes)`,
  )
  expect(summary).toEqual([])
}

/** Collects Content-Security-Policy violations reported by the browser. */
export function watchCspViolations(page: Page) {
  const violations: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error' && /Content Security Policy/i.test(message.text())) {
      violations.push(message.text())
    }
  })
  return violations
}

export async function signIn(page: Page, { remember = true } = {}) {
  await page.getByLabel('Email address').fill('victory@example.com')
  await page.getByLabel('Password').fill('password1')
  if (remember) await page.getByLabel('Remember me').check()
  await page.getByRole('button', { name: 'Sign in' }).click()
}

/** The primary navigation visible at the current screen size. */
export function primaryNav(page: Page, isMobile: boolean) {
  return page.getByRole('navigation', { name: isMobile ? 'Quick navigation' : 'Main navigation' })
}
