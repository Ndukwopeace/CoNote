/**
 * Tests for Settings → Appearance (D104): choosing light or dark.
 */

// Query helpers.
import { screen } from '@testing-library/react'
// Vitest building blocks.
import { beforeEach, describe, expect, it } from 'vitest'

// Accessibility checker.
import { expectNoAxeViolations } from '@conote/testing/axe'
// Render helper.
import { renderWithRouter } from '@/test/renderWithRouter'

// The component under test.
import { AppearanceSection } from './AppearanceSection'

/** Renders the section on its own. */
function renderSection() {
  return renderWithRouter({ routes: [{ path: '/', element: <AppearanceSection /> }], path: '/' })
}

describe('AppearanceSection', () => {
  // A clean <html> for each test.
  beforeEach(() => {
    document.documentElement.classList.remove('dark')
  })

  // Proves light is the starting choice and says so to screen readers.
  it('shows light as chosen at first', async () => {
    renderSection()

    expect(await screen.findByRole('button', { name: 'Light' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'false')
  })

  // Proves choosing dark changes the page and the pressed button, and light brings it back.
  it('switches to dark and back', async () => {
    const { user } = renderSection()

    await user.click(await screen.findByRole('button', { name: 'Dark' }))
    expect(document.documentElement).toHaveClass('dark')
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Light' }))
    expect(document.documentElement).not.toHaveClass('dark')
    expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true')
  })

  // Proves the section passes axe's automated accessibility rules.
  it('has no detectable accessibility violations', async () => {
    const { container } = renderSection()
    await screen.findByRole('heading', { name: 'Appearance' })

    await expectNoAxeViolations(container)
  })
})
