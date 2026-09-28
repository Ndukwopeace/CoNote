/**
 * Tests for My Courses (FR-CRS-1, FR-CRS-2): the course cards, search and status filter.
 */

// Queries.
import { screen } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

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

/** Renders My Courses at `path`, signed in. */
function renderCourses(path = '/courses', services: Partial<Services> = {}) {
  return renderWithRouter({ routes, path, session: makeSession(), services })
}

/** The course card links on screen. */
function courseLinks() {
  // Every card is a link whose name starts with its course code.
  return screen.queryAllByRole('link', { name: /^(SWE|ENG|CSE|BUS) \d{3}/ })
}

describe('CoursesPage', () => {
  // Proves every card shows code, title, teacher, student count and status, and opens the course.
  it('lists the enrolled courses', async () => {
    // Act.
    renderCourses()

    // Assert.
    const swe = await screen.findByRole('link', { name: /^SWE 311/ })
    expect(swe).toHaveAttribute('href', '/courses/swe-311')
    expect(swe).toHaveTextContent('Software Engineering')
    expect(swe).toHaveTextContent('Dr. Smith')
    expect(swe).toHaveTextContent('48 students')
    expect(swe).toHaveTextContent('Ongoing')
    expect(courseLinks()).toHaveLength(4)
  })

  // Proves the search matches the teacher and is kept in the address.
  it('searches by teacher and keeps the search in the address', async () => {
    // Arrange.
    const { user, router } = renderCourses()
    await screen.findByRole('link', { name: /^SWE 311/ })

    // Act.
    await user.type(screen.getByRole('searchbox', { name: 'Search courses' }), 'okoro')

    // Assert.
    expect(courseLinks()).toHaveLength(1)
    expect(courseLinks()[0]).toHaveTextContent('BUS 207')
    expect(router.state.location.search).toBe('?q=okoro')
  })

  // Proves the status filter reads from the address, so a shared link keeps it.
  it('filters by status from the address', async () => {
    // Act.
    renderCourses('/courses?status=upcoming')

    // Assert.
    expect(await screen.findByRole('link', { name: /^BUS 207/ })).toBeInTheDocument()
    expect(courseLinks()).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Upcoming' })).toHaveAttribute('aria-pressed', 'true')
  })

  // Proves choosing a filter updates the list and the address.
  it('changes the status filter', async () => {
    // Arrange.
    const { user, router } = renderCourses()
    await screen.findByRole('link', { name: /^SWE 311/ })

    // Act.
    await user.click(screen.getByRole('button', { name: 'Completed' }))

    // Assert: no completed courses in the demo, so the no-match state shows.
    expect(router.state.location.search).toBe('?status=completed')
    expect(screen.getByText('No courses match')).toBeInTheDocument()
  })

  // Proves the no-match state can reset the search and filter.
  it('clears the search and filter', async () => {
    // Arrange.
    const { user, router } = renderCourses('/courses?q=zzz&status=ongoing')
    await screen.findByText('No courses match')

    // Act.
    await user.click(screen.getByRole('button', { name: 'Clear search and filter' }))

    // Assert.
    expect(router.state.location.search).toBe('')
    expect(courseLinks()).toHaveLength(4)
  })

  // Proves a student with no courses sees the enrolment message (FR-DSH-6 wording).
  it('explains when the student has no courses', async () => {
    // Act.
    renderCourses('/courses', emptyCatalog())

    // Assert.
    expect(await screen.findByText(/not enrolled in any courses yet/)).toBeInTheDocument()
  })

  // Proves the loading skeleton (section 11).
  it('shows skeletons while loading', async () => {
    // Act.
    renderCourses('/courses', hangingCatalog())

    // Assert.
    await screen.findByRole('heading', { level: 1, name: 'My Courses' })
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  // Proves a failed load can be retried (section 11).
  it('shows an error with a retry', async () => {
    // Act.
    renderCourses('/courses', failingCatalog())

    // Assert.
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  // Proves the page passes the automated accessibility rules.
  it('has no accessibility violations', async () => {
    // Act.
    const { container } = renderCourses()
    await screen.findByRole('link', { name: /^SWE 311/ })

    // Assert.
    await expectNoAxeViolations(container)
  })
})
