/**
 * Accessibility check for component tests, using axe-core (ENGINEERING_STANDARDS.md 7).
 */

// The accessibility rules engine.
import axe from 'axe-core'
// Vitest's assertion function.
import { expect } from 'vitest'

/**
 * Fails the test when axe finds accessibility violations in `container`.
 * Colour contrast is skipped because jsdom does not compute styles; Playwright checks it.
 */
export async function expectNoAxeViolations(container: Element) {
  // Run every axe rule except colour contrast.
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false } },
  })
  // One readable line per problem, e.g. "button-name: Buttons must have discernible text (1 nodes)".
  const summary = results.violations.map(
    (violation) => `${violation.id}: ${violation.help} (${violation.nodes.length} nodes)`,
  )
  // Comparing with an empty list shows every problem in the failure message.
  expect(summary).toEqual([])
}
