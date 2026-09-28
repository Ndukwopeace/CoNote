import axe from 'axe-core'
import { expect } from 'vitest'

/**
 * Fails the test when axe finds accessibility violations in `container`.
 * Colour contrast is skipped because jsdom does not compute styles; Playwright checks it.
 */
export async function expectNoAxeViolations(container: Element) {
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false } },
  })
  const summary = results.violations.map(
    (violation) => `${violation.id}: ${violation.help} (${violation.nodes.length} nodes)`,
  )
  expect(summary).toEqual([])
}
