/**
 * Tests for the Class page (FR-CLS-1 to FR-CLS-5): header, three tabs, privacy banner, empty
 * notes, summary states and Previous/Next.
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
import { expectNoAxeViolations } from '@conote/testing/axe'
// Failing and hanging data.
import { failingCatalog, hangingCatalog } from '@/test/catalogServices'
// Session factory.
import { makeSession } from '@/test/factories'
// Render helper.
import { renderWithRouter } from '@/test/renderWithRouter'

/** Renders the Class page at `path`, signed in. */
function renderClass(path: string, services: Partial<Services> = {}) {
  return renderWithRouter({ routes, path, session: makeSession(), services })
}

// Only Date is faked, at 9:00, so class 4 of SWE 311 is live.
beforeEach(() => {
  vi.useFakeTimers({ now: new Date(2026, 8, 28, 9, 0), toFake: ['Date'] })
})

// Back to the real clock.
afterEach(() => {
  vi.useRealTimers()
})

describe('ClassPage', () => {
  // Proves the header (FR-CLS-1), with the status following the clock.
  it('shows the class header with a Live badge', async () => {
    // Act.
    renderClass('/courses/swe-311/classes/swe-311-c4')

    // Assert.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'SDLC Models' }),
    ).toBeInTheDocument()
    const header = screen.getByRole('region', { name: 'SDLC Models' })
    expect(header).toHaveTextContent('SWE 311 · Software Engineering')
    expect(header).toHaveTextContent('Class 4')
    expect(header).toHaveTextContent('8:30 AM – 10:30 AM')
    expect(header).toHaveTextContent('Live')
    expect(screen.getByRole('link', { name: 'Software Engineering' })).toHaveAttribute(
      'href',
      '/courses/swe-311',
    )
  })

  // Proves Overview shows the description and the summary stage (FR-CLS-2, section 4).
  it('shows the description and summary state on Overview', async () => {
    // Act.
    renderClass('/courses/swe-311/classes/swe-311-c3')

    // Assert.
    const panel = await screen.findByRole('tabpanel')
    expect(panel).toHaveTextContent('Reviews, prototypes and test cases')
    expect(panel).toHaveTextContent('Summary in review')
  })

  // Proves the Notes tab: privacy banner, the student's notes and Add Note (FR-CLS-2, FR-CLS-3).
  it('lists notes under the privacy banner with an Add Note link', async () => {
    // Act.
    renderClass('/courses/swe-311/classes/swe-311-c4?tab=notes')

    // Assert.
    const panel = await screen.findByRole('tabpanel')
    expect(panel).toHaveTextContent('Your notes are private. You can only see your own notes.')
    expect(
      await within(panel).findByRole('link', { name: /Waterfall in one line/ }),
    ).toHaveAttribute('href', '/notes/note-7')
    expect(within(panel).getByRole('link', { name: 'Add Note' })).toHaveAttribute(
      'href',
      '/notes/new?classId=swe-311-c4',
    )
  })

  // Proves the FR-CLS-4 empty state, with the banner still showing.
  it('shows the empty notes state', async () => {
    // Act.
    renderClass('/courses/eng-201/classes/eng-201-c2?tab=notes')

    // Assert.
    const panel = await screen.findByRole('tabpanel')
    expect(await within(panel).findByText('No notes yet')).toBeInTheDocument()
    expect(panel).toHaveTextContent(
      'Start taking notes for this class. Your notes will be private and used to help generate summaries.',
    )
    expect(panel).toHaveTextContent('Your notes are private.')
  })

  // Proves a published summary links to the summary view (FR-CLS-2).
  it('links to a published summary', async () => {
    // Act.
    renderClass('/courses/swe-311/classes/swe-311-c1?tab=summary')

    // Assert.
    const panel = await screen.findByRole('tabpanel')
    expect(panel).toHaveTextContent('Summary available')
    expect(within(panel).getByRole('link', { name: 'Read the summary' })).toHaveAttribute(
      'href',
      '/courses/swe-311/classes/swe-311-c1/summary',
    )
  })

  // SECURITY: proves an unpublished summary shows only its state, never a link to content.
  it('shows only the state for an unpublished summary', async () => {
    // Act.
    renderClass('/courses/cse-205/classes/cse-205-c1?tab=summary')

    // Assert.
    const panel = await screen.findByRole('tabpanel')
    expect(panel).toHaveTextContent('Summary in progress')
    expect(within(panel).queryByRole('link')).toBeNull()
  })

  // Proves Previous/Next, hidden at the ends (FR-CLS-5).
  it('links to the previous and next classes', async () => {
    // Act: a middle class.
    const { unmount } = renderClass('/courses/swe-311/classes/swe-311-c2')

    // Assert.
    expect(await screen.findByRole('link', { name: /Previous class/ })).toHaveAttribute(
      'href',
      '/courses/swe-311/classes/swe-311-c1',
    )
    expect(screen.getByRole('link', { name: /Next class/ })).toHaveAttribute(
      'href',
      '/courses/swe-311/classes/swe-311-c3',
    )
    unmount()

    // Act: the first class.
    renderClass('/courses/swe-311/classes/swe-311-c1')

    // Assert.
    expect(await screen.findByRole('link', { name: /Next class/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Previous class/ })).toBeNull()
  })

  // Proves unknown classes, and classes opened under the wrong course, are not found.
  it.each([
    '/courses/swe-311/classes/no-such-class',
    '/courses/eng-201/classes/swe-311-c1',
    '/courses/no-such-course/classes/swe-311-c1',
  ])('shows not found for %s', async (path) => {
    // Act.
    renderClass(path)

    // Assert.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Class not found' }),
    ).toBeInTheDocument()
  })

  // Proves loading and failure states (section 11).
  it('shows loading and error states', async () => {
    // Act: never finishes.
    const { unmount } = renderClass('/courses/swe-311/classes/swe-311-c1', hangingCatalog())

    // Assert.
    expect(await screen.findByText('Loading…')).toBeInTheDocument()
    unmount()

    // Act: fails.
    renderClass('/courses/swe-311/classes/swe-311-c1', failingCatalog())

    // Assert.
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  // Proves the page passes the automated accessibility rules.
  it('has no accessibility violations', async () => {
    // Act.
    const { container } = renderClass('/courses/swe-311/classes/swe-311-c2?tab=notes')
    await within(await screen.findByRole('tabpanel')).findAllByRole('link')

    // Assert.
    await expectNoAxeViolations(container)
  })
})
