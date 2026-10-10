/**
 * Tests for Home, the dashboard (FR-DSH-1 to FR-DSH-6), over the demo data at a fixed time.
 */

// Queries.
import { screen, within } from '@testing-library/react'
// Vitest building blocks.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The real route table.
import { routes } from '@/app/routes'
// Accessibility check.
import { expectNoAxeViolations } from '@conote/testing/axe'
// Empty, failing and hanging data.
import { emptyCatalog, failingCatalog, hangingCatalog } from '@/test/catalogServices'
// Session factory.
import { makeSession } from '@/test/factories'
// Render helper.
import { renderWithRouter } from '@/test/renderWithRouter'
// Service overrides type.
import type { Services } from '@/services/types'

/** Renders the dashboard, signed in, with optional service replacements. */
function renderDashboard(services: Partial<Services> = {}) {
  return renderWithRouter({ routes, path: '/dashboard', session: makeSession(), services })
}

// Only Date is faked, at 9:00 on a Monday, so timers and promises run normally.
beforeEach(() => {
  vi.useFakeTimers({ now: new Date(2026, 8, 28, 9, 0), toFake: ['Date'] })
})

// Back to the real clock.
afterEach(() => {
  vi.useRealTimers()
})

describe('DashboardPage', () => {
  // Proves the greeting follows the clock and uses the first name (FR-DSH-1).
  it('greets the student for the time of day', async () => {
    // Act.
    renderDashboard()

    // Assert.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Good morning, Victory' }),
    ).toBeInTheDocument()
    expect(screen.getByText("Here's what's happening with your learning.")).toBeInTheDocument()
  })

  // Proves the four stat cards count the demo data and link to their lists (FR-DSH-2).
  it('shows four stat cards that link to their lists', async () => {
    // Act.
    renderDashboard()

    // Assert: 4 courses, 2 classes today (the live one and one later), 2 unread summaries,
    // 11 notes.
    expect(await screen.findByRole('link', { name: '4 My Courses' })).toHaveAttribute(
      'href',
      '/courses',
    )
    expect(screen.getByRole('link', { name: '2 Classes Today' })).toHaveAttribute(
      'href',
      '/classes',
    )
    expect(screen.getByRole('link', { name: '2 New Summaries' })).toHaveAttribute(
      'href',
      '/notes?tab=summaries',
    )
    expect(screen.getByRole('link', { name: '11 Notes Created' })).toHaveAttribute('href', '/notes')
  })

  // Proves the next three classes show, live one first, each linking to its class (FR-DSH-3).
  it('lists the next three classes with Live and Upcoming badges', async () => {
    // Act.
    renderDashboard()

    // Assert.
    const section = await screen.findByRole('region', { name: 'Upcoming Classes' })
    const links = await within(section).findAllByRole('link', { name: /SWE|ENG|CSE|BUS/ })
    expect(links).toHaveLength(3)
    expect(links[0]).toHaveTextContent('SDLC Models')
    expect(links[0]).toHaveTextContent('Live')
    expect(links[0]).toHaveAttribute('href', '/courses/swe-311/classes/swe-311-c4')
    expect(links[1]).toHaveTextContent('Hash Tables')
    expect(links[1]).toHaveTextContent('Upcoming')
    expect(within(section).getByRole('link', { name: 'View all classes' })).toHaveAttribute(
      'href',
      '/classes',
    )
  })

  // Proves the five newest events show with relative times (FR-DSH-4).
  it('shows the five most recent events', async () => {
    // Act.
    renderDashboard()

    // Assert.
    const section = await screen.findByRole('region', { name: 'Recent Activity' })
    const items = await within(section).findAllByRole('listitem')
    expect(items).toHaveLength(5)
    expect(items[0]).toHaveTextContent('Note saved')
    expect(items[0]).toHaveTextContent('25 min ago')
  })

  // Proves the Ask AI card links to the chat (FR-DSH-5).
  it('links to Ask CoNote AI', async () => {
    // Act.
    renderDashboard()

    // Assert.
    expect(await screen.findByRole('link', { name: /Ask CoNote AI/ })).toHaveAttribute(
      'href',
      '/ask-ai',
    )
  })

  // Proves a student with no courses sees the enrolment message (FR-DSH-6).
  it('explains when the student has no courses', async () => {
    // Act.
    renderDashboard(emptyCatalog())

    // Assert.
    expect(
      await screen.findByText(
        /You're not enrolled in any courses yet\. Find a course to request to join, or wait for your teacher or administrator to add you\./,
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Find courses' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Upcoming Classes' })).toBeNull()
  })

  // Proves loading shows skeletons, not a blank page (section 11).
  it('shows skeletons while loading', async () => {
    // Act.
    renderDashboard(hangingCatalog())

    // Assert: the greeting is there straight away; the data area says it's loading.
    await screen.findByRole('heading', { level: 1 })
    expect(screen.getAllByRole('status').some((el) => el.textContent.includes('Loading…'))).toBe(
      true,
    )
  })

  // Proves a failed load explains itself and offers a retry (section 11).
  it('shows an error with a retry when loading fails', async () => {
    // Act.
    renderDashboard(failingCatalog())

    // Assert.
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't reach CoNote/)
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  // Proves the page passes the automated accessibility rules.
  it('has no accessibility violations', async () => {
    // Act.
    const { container } = renderDashboard()
    await screen.findByRole('region', { name: 'Recent Activity' })

    // Assert.
    await expectNoAxeViolations(container)
  })
})
