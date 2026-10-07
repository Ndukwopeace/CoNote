/**
 * Tests for Course Details (FR-CRS-3, FR-CRS-4): the header and the four tabs.
 */

// Queries.
import { screen, within } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

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

/** Renders Course Details at `path`, signed in. */
function renderCourse(path = '/courses/swe-311', services: Partial<Services> = {}) {
  return renderWithRouter({ routes, path, session: makeSession(), services })
}

describe('CourseDetailsPage', () => {
  // Proves the header shows the FR-CRS-3 details.
  it('shows the course header', async () => {
    // Act.
    renderCourse()

    // Assert.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Software Engineering' }),
    ).toBeInTheDocument()
    const header = screen.getByRole('region', { name: 'Software Engineering' })
    expect(header).toHaveTextContent('SWE 311')
    expect(header).toHaveTextContent('Dr. Smith')
    expect(header).toHaveTextContent('48 students')
    expect(header).toHaveTextContent('4 classes')
    expect(header).toHaveTextContent('Ongoing')
    expect(screen.getByRole('link', { name: 'My Courses' })).toHaveAttribute('href', '/courses')
  })

  // Proves Overview is the default tab and shows the description, teacher and schedule.
  it('opens on the Overview tab', async () => {
    // Act.
    renderCourse()

    // Assert.
    expect(await screen.findByRole('tab', { name: 'Overview', selected: true })).toBeInTheDocument()
    const panel = screen.getByRole('tabpanel')
    expect(panel).toHaveTextContent(/How teams plan, build, test and maintain software/)
    expect(panel).toHaveTextContent('Mondays and Wednesdays, 9–11 AM')
  })

  // Proves the Classes tab lists every class in order, with note counts and summary markers.
  it('lists classes with note counts and summary markers', async () => {
    // Act.
    renderCourse('/courses/swe-311?tab=classes')

    // Assert.
    const panel = await screen.findByRole('tabpanel')
    const links = await within(panel).findAllByRole('link')
    expect(links).toHaveLength(4)
    expect(links[0]).toHaveTextContent('1. Introduction to Software Engineering')
    expect(links[0]).toHaveTextContent('2 notes')
    expect(links[0]).toHaveTextContent('Summary available')
    expect(links[0]).toHaveAttribute('href', '/courses/swe-311/classes/swe-311-c1')
    expect(links[3]).toHaveTextContent('1 note')
    expect(links[3]).not.toHaveTextContent('Summary available')
  })

  // Proves choosing a tab puts it in the address, so refresh and Back keep it.
  it('keeps the chosen tab in the address', async () => {
    // Arrange.
    const { user, router } = renderCourse()

    // Act.
    await user.click(await screen.findByRole('tab', { name: 'Notes' }))

    // Assert.
    expect(router.state.location.search).toBe('?tab=notes')
    const panel = screen.getByRole('tabpanel')
    expect(
      await within(panel).findByRole('link', { name: /Waterfall in one line/ }),
    ).toHaveAttribute('href', '/notes/note-7')
  })

  // Proves the Summaries tab lists only this course's published summaries.
  it('lists published summaries', async () => {
    // Act.
    renderCourse('/courses/swe-311?tab=summaries')

    // Assert.
    const panel = await screen.findByRole('tabpanel')
    const links = await within(panel).findAllByRole('link')
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveTextContent('Software Requirements')
    expect(links[0]).toHaveAttribute('href', '/courses/swe-311/classes/swe-311-c2/summary')
  })

  // Proves courses with nothing yet say so instead of showing a blank tab.
  it('shows empty states on a course with no notes or summaries', async () => {
    // Act.
    renderCourse('/courses/bus-207?tab=summaries')

    // Assert.
    expect(await screen.findByText('No summaries yet')).toBeInTheDocument()
  })

  // SECURITY: proves an unknown ?tab= falls back to Overview.
  it('falls back to Overview for an unknown tab', async () => {
    // Act.
    renderCourse('/courses/swe-311?tab=grades')

    // Assert.
    expect(await screen.findByRole('tab', { name: 'Overview', selected: true })).toBeInTheDocument()
  })

  // Proves a missing course shows the in-layout not-found panel (section 11).
  it('shows not found for an unknown course', async () => {
    // Act.
    renderCourse('/courses/no-such-course')

    // Assert.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Course not found' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to My Courses' })).toHaveAttribute(
      'href',
      '/courses',
    )
  })

  // Proves loading and failure states (section 11).
  it('shows loading and error states', async () => {
    // Act: a load that never finishes.
    const { unmount } = renderCourse('/courses/swe-311', hangingCatalog())

    // Assert.
    expect(await screen.findByText('Loading…')).toBeInTheDocument()
    unmount()

    // Act: a load that fails.
    renderCourse('/courses/swe-311', failingCatalog())

    // Assert.
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  // Proves the page passes the automated accessibility rules.
  it('has no accessibility violations', async () => {
    // Act.
    const { container } = renderCourse('/courses/swe-311?tab=classes')
    await within(await screen.findByRole('tabpanel')).findAllByRole('link')

    // Assert.
    await expectNoAxeViolations(container)
  })
})
