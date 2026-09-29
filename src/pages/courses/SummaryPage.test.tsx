/**
 * Tests for the summary view (FR-SUM-1 to FR-SUM-3, FR-SUM-5, FR-SUM-6).
 */

// Queries and waiting.
import { screen, waitFor, within } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The real route table.
import { routes } from '@/app/routes'
// Service types.
import type { Services } from '@/services/types'
// Accessibility check.
import { expectNoAxeViolations } from '@/test/axe'
// Failing and hanging data.
import { failingCatalog, hangingCatalog } from '@/test/catalogServices'
// Session factory.
import { makeSession } from '@/test/factories'
// Render helper and demo services.
import { createTestServices, renderWithRouter } from '@/test/renderWithRouter'

/** Renders the app at `path`, signed in. */
function renderAt(path: string, services: Partial<Services> = {}) {
  return renderWithRouter({ routes, path, session: makeSession(), services })
}

/** The summary route for a class of SWE 311. */
const SWE_C2 = '/courses/swe-311/classes/swe-311-c2/summary'

describe('SummaryPage', () => {
  // Proves the header (FR-SUM-1) and the approval label (FR-SUM-3).
  it('shows the header and approval label', async () => {
    // Act.
    renderAt(SWE_C2)

    // Assert.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Software Requirements' }),
    ).toBeInTheDocument()
    const header = screen.getByRole('region', { name: 'Software Requirements' })
    expect(header).toHaveTextContent('SWE 311 · Software Engineering')
    expect(header).toHaveTextContent('Published')
    expect(header).toHaveTextContent('Reviewed by Dr. Smith')
    expect(header).toHaveTextContent('Based on 41 student notes')
    expect(
      screen.getByText('AI-generated from class notes, reviewed and approved by your teacher.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Software Requirements/ })).toHaveAttribute(
      'href',
      '/courses/swe-311/classes/swe-311-c2',
    )
  })

  // Proves the AI Summary tab: overview, key concepts and areas of confusion (FR-SUM-2).
  it('shows the AI summary', async () => {
    // Act.
    renderAt(SWE_C2)

    // Assert.
    const panel = await screen.findByRole('tabpanel')
    expect(panel).toHaveTextContent(/Requirements describe what a system must do/)
    expect(within(panel).getByRole('heading', { name: 'Key Concepts' })).toBeInTheDocument()
    expect(panel).toHaveTextContent('Functional requirements')
    expect(
      within(panel).getByRole('heading', { name: 'Common Areas of Confusion' }),
    ).toBeInTheDocument()
    expect(panel).toHaveTextContent('Is "the app should be fast" a requirement?')
  })

  // Proves the Key Topics tab, chosen from the address (FR-SUM-2).
  it('shows key topics', async () => {
    // Act.
    renderAt(`${SWE_C2}?tab=topics`)

    // Assert.
    const panel = await screen.findByRole('tabpanel')
    const topics = within(panel)
      .getAllByRole('listitem')
      .map((li) => li.textContent)
    expect(topics).toEqual([
      'Functional requirements',
      'Non-functional requirements',
      'Measurability',
    ])
  })

  // Proves opening a summary marks it as viewed, which the dashboard's count reads (FR-SUM-5).
  it('marks the summary as viewed', async () => {
    // Arrange: a summary service that records the call.
    const base = createTestServices()
    const viewed: string[] = []
    renderAt(SWE_C2, {
      summaries: {
        ...base.summaries,
        markViewed: (id) => {
          viewed.push(id)
          return base.summaries.markViewed(id)
        },
      },
    })

    // Assert.
    await waitFor(() => {
      expect(viewed).toEqual(['summary-swe-311-c2'])
    })
  })

  // SECURITY: proves an unpublished summary shows only its state, never content (FR-SUM-6).
  it.each([
    ['/courses/swe-311/classes/swe-311-c3/summary', 'Summary in review'],
    ['/courses/cse-205/classes/cse-205-c1/summary', 'Summary in progress'],
    ['/courses/swe-311/classes/swe-311-c4/summary', 'Summary not available yet'],
  ])('shows only the state at %s', async (path, state) => {
    // Act.
    renderAt(path)

    // Assert.
    expect(await screen.findByText(state)).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'AI Summary' })).toBeNull()
  })

  // Proves unknown classes, and classes under the wrong course, are not found.
  it.each([
    '/courses/swe-311/classes/no-such-class/summary',
    '/courses/eng-201/classes/swe-311-c2/summary',
  ])('shows not found for %s', async (path) => {
    // Act.
    renderAt(path)

    // Assert.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Summary not found' }),
    ).toBeInTheDocument()
  })

  // Proves loading and failure states (section 11).
  it('shows loading and error states', async () => {
    // Act: never finishes.
    const { unmount } = renderAt(SWE_C2, hangingCatalog())

    // Assert.
    expect(await screen.findByText('Loading…')).toBeInTheDocument()
    unmount()

    // Act: fails.
    renderAt(SWE_C2, failingCatalog())

    // Assert.
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  // Proves the page passes the automated accessibility rules.
  it('has no accessibility violations', async () => {
    // Act.
    const { container } = renderAt(SWE_C2)
    await screen.findByRole('tabpanel')

    // Assert.
    await expectNoAxeViolations(container)
  })
})
