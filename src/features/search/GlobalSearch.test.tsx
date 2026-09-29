/**
 * Tests for global search in the top bar (REQUIREMENTS.md section 8): grouped results, keyboard
 * use, clearing and "no matches".
 */

// Queries and waiting.
import { screen, waitFor, within } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The real route table.
import { routes } from '@/app/routes'
// Accessibility check.
import { expectNoAxeViolations } from '@/test/axe'
// Session factory.
import { makeSession } from '@/test/factories'
// Render helper.
import { renderWithRouter } from '@/test/renderWithRouter'

/** Renders the portal on Home, signed in. */
function renderPortal() {
  return renderWithRouter({ routes, path: '/dashboard', session: makeSession() })
}

/** The search box. */
function box() {
  return screen.getByRole('combobox', { name: 'Search courses, classes and notes' })
}

describe('GlobalSearch', () => {
  // Proves results come grouped by type (section 8).
  it('shows grouped results', async () => {
    // Arrange.
    const { user } = renderPortal()
    await screen.findByRole('heading', { level: 1 })

    // Act.
    await user.type(box(), 'requirement')

    // Assert.
    const listbox = await screen.findByRole('listbox', { name: 'Search results' })
    expect(within(listbox).getByRole('group', { name: 'Classes' })).toHaveTextContent(
      'Software Requirements',
    )
    expect(within(listbox).getByRole('group', { name: 'Notes' })).toHaveTextContent(
      'Is "fast" a requirement?',
    )
    expect(within(listbox).queryByRole('group', { name: 'Courses' })).toBeNull()
    expect(box()).toHaveAttribute('aria-expanded', 'true')
  })

  // Proves arrow keys pick a result and Enter opens it.
  it('opens a result with the keyboard', async () => {
    // Arrange.
    const { user, router } = renderPortal()
    await screen.findByRole('heading', { level: 1 })
    await user.type(box(), 'swe 311')
    await screen.findByRole('listbox')

    // Act.
    await user.keyboard('{ArrowDown}')

    // Assert: the first option is active.
    const [first] = screen.getAllByRole('option')
    expect(first).toHaveAttribute('aria-selected', 'true')
    expect(box()).toHaveAttribute('aria-activedescendant', first?.id)

    // Act.
    await user.keyboard('{Enter}')

    // Assert: opened, and the search is closed and cleared.
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/courses/swe-311')
    })
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(box()).toHaveValue('')
  })

  // Proves a click opens a result.
  it('opens a result with a click', async () => {
    // Arrange.
    const { user, router } = renderPortal()
    await screen.findByRole('heading', { level: 1 })
    await user.type(box(), 'essay')

    // Act.
    await user.click(await screen.findByRole('option', { name: /Essay Structure/ }))

    // Assert.
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/courses/eng-201/classes/eng-201-c1')
    })
  })

  // Proves "no matches" is said, not left blank.
  it('says when nothing matches', async () => {
    // Arrange.
    const { user } = renderPortal()
    await screen.findByRole('heading', { level: 1 })

    // Act.
    await user.type(box(), 'zzzz')

    // Assert.
    expect(await screen.findByText('No matches for “zzzz”.')).toBeInTheDocument()
  })

  // Proves Escape closes the results and the clear button empties the box.
  it('closes with Escape and clears with the clear button', async () => {
    // Arrange.
    const { user } = renderPortal()
    await screen.findByRole('heading', { level: 1 })
    await user.type(box(), 'essay')
    await screen.findByRole('listbox')

    // Act: Escape.
    await user.keyboard('{Escape}')

    // Assert.
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(box()).toHaveAttribute('aria-expanded', 'false')

    // Act: clear.
    await user.click(screen.getByRole('button', { name: 'Clear search' }))

    // Assert.
    expect(box()).toHaveValue('')
    expect(box()).toHaveFocus()
  })

  // Proves the open results pass the automated accessibility rules.
  it('has no accessibility violations', async () => {
    // Arrange.
    const { user, container } = renderPortal()
    await screen.findByRole('heading', { level: 1 })
    await user.type(box(), 'requirement')
    await screen.findByRole('listbox')

    // Assert.
    await expectNoAxeViolations(container)
  })
})
