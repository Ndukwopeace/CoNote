/**
 * Tests for the placeholder legal pages linked from sign-up and the footer.
 */

// Queries the rendered page.
import { screen } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The real route table.
import { routes } from '@/app/routes'
// Accessibility check.
import { expectNoAxeViolations } from '@/test/axe'
// Render helper.
import { renderWithRouter } from '@/test/renderWithRouter'

describe('legal pages', () => {
  // Proves each page renders, says it is a draft, and is accessible: [address, heading].
  it.each([
    ['/terms', 'Terms of Service'],
    ['/privacy', 'Privacy Policy'],
  ])('%s shows a marked draft', async (path, heading) => {
    // Act.
    const { container } = renderWithRouter({ routes, path })

    // Assert: the heading, the draft notice, and no accessibility problems.
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
    expect(screen.getByText(/This is a draft/)).toBeInTheDocument()
    await expectNoAxeViolations(container)
  })
})
