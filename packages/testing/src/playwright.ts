/**
 * Browser-test helpers shared by every CoNote app's Playwright tests (D64).
 */

// axe-core wired into Playwright.
import { AxeBuilder } from '@axe-core/playwright'
// Assertions and the browser page type.
import { expect, type Page } from '@playwright/test'

/**
 * Runs axe on the current page, including colour contrast, and fails on any violation.
 * `preload: false` stops axe from fetch()-ing stylesheets itself, which the apps' CSP would
 * rightly block and which would otherwise show up as false CSP violations.
 */
export async function expectNoAxeViolationsOnPage(page: Page) {
  // Scan the whole page.
  const results = await new AxeBuilder({ page }).options({ preload: false }).analyze()
  // One readable line per problem.
  const summary = results.violations.map(
    (violation) => `${violation.id}: ${violation.help} (${violation.nodes.length} nodes)`,
  )
  // An empty list means no problems; otherwise the failure lists them.
  expect(summary).toEqual([])
}

/**
 * Collects Content-Security-Policy violations reported by the browser.
 * SECURITY: a policy that blocks part of an app shows up here and fails the test, so a broken
 * policy can't reach production unnoticed, and neither can the temptation to loosen it.
 */
export function watchCspViolations(page: Page) {
  // Every violation message seen.
  const violations: string[] = []
  // Listen to the browser console, where blocked resources are reported.
  page.on('console', (message) => {
    // Keep only errors mentioning the policy.
    if (message.type() === 'error' && /Content Security Policy/i.test(message.text())) {
      violations.push(message.text())
    }
  })
  // The list fills up while the test runs.
  return violations
}
