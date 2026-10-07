/**
 * Tests for All classes at /classes (FR-CLS-6): every class, grouped into Today, Upcoming and
 * Past.
 */

// Queries.
import { screen, within } from '@testing-library/react'
// Vitest building blocks.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The real route table.
import { routes } from '@/app/routes'
// Service overrides type.
import type { Services } from '@/services/types'
// Accessibility check.
import { expectNoAxeViolations } from '@/test/axe'
// Empty, failing and hanging data.
import { emptyCatalog, failingCatalog, hangingCatalog } from '@/test/catalogServices'
// Session factory.
import { makeSession } from '@/test/factories'
// Render helper.
import { renderWithRouter } from '@/test/renderWithRouter'

/** Renders /classes, signed in. */
function renderClasses(services: Partial<Services> = {}) {
  return renderWithRouter({ routes, path: '/classes', session: makeSession(), services })
}

// Only Date is faked, at 9:00, so the live class and the one at noon fall on today.
beforeEach(() => {
  vi.useFakeTimers({ now: new Date(2026, 8, 28, 9, 0), toFake: ['Date'] })
})

// Back to the real clock.
afterEach(() => {
  vi.useRealTimers()
})

describe('ClassesPage', () => {
  // Proves the three groups hold the right classes, each linking to its class page.
  it('groups every class into Today, Upcoming and Past', async () => {
    // Act.
    renderClasses()

    // Assert: 2 today, 5 upcoming, 5 past = all 12 demo classes.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'All classes' }),
    ).toBeInTheDocument()
    const today = await screen.findByRole('region', { name: 'Today' })
    const upcoming = screen.getByRole('region', { name: 'Upcoming' })
    const past = screen.getByRole('region', { name: 'Past' })
    expect(within(today).getAllByRole('link')).toHaveLength(2)
    expect(within(upcoming).getAllByRole('link')).toHaveLength(5)
    expect(within(past).getAllByRole('link')).toHaveLength(5)
    // Today starts with the live class.
    const [live] = within(today).getAllByRole('link')
    expect(live).toHaveTextContent('SDLC Models')
    expect(live).toHaveTextContent('Live')
    expect(live).toHaveAttribute('href', '/courses/swe-311/classes/swe-311-c4')
    // Past is most recent first.
    expect(within(past).getAllByRole('link')[0]).toHaveTextContent('Balanced Search Trees')
    expect(within(past).getAllByRole('link')[0]).toHaveTextContent('Completed')
  })

  // Proves a student with no classes sees an empty state.
  it('shows an empty state with no classes', async () => {
    // Act.
    renderClasses(emptyCatalog())

    // Assert.
    expect(await screen.findByText('No classes yet')).toBeInTheDocument()
  })

  // Proves loading and failure states (section 11).
  it('shows loading and error states', async () => {
    // Act: never finishes.
    const { unmount } = renderClasses(hangingCatalog())

    // Assert.
    expect(await screen.findByText('Loading…')).toBeInTheDocument()
    unmount()

    // Act: fails.
    renderClasses(failingCatalog())

    // Assert.
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  // Proves the page passes the automated accessibility rules.
  it('has no accessibility violations', async () => {
    // Act.
    const { container } = renderClasses()
    await screen.findByRole('region', { name: 'Today' })

    // Assert.
    await expectNoAxeViolations(container)
  })
})
