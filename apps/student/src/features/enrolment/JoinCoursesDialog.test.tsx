/**
 * Tests for asking to join courses (FR-ENR-1 to FR-ENR-7, D76): the dialog a new student sees,
 * the dashboard and My Courses entry points, and the Requested courses section.
 */

// Queries and waiting.
import { screen, waitFor, within } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The shared error type.
import { AppError } from '@conote/core/errors'
// The real route table.
import { routes } from '@/app/routes'
// Accessibility check.
import { expectNoAxeViolations } from '@conote/testing/axe'
// Session factory.
import { makeSession } from '@/test/factories'
// Render helper.
import { createTestServices, renderWithRouter, startNewStudent } from '@/test/renderWithRouter'
// Service overrides type.
import type { Services } from '@/services/types'

/** Renders `path` for a brand-new student: in no courses, with no requests. */
function renderNewStudent(path = '/dashboard', services: Partial<Services> = {}) {
  startNewStudent(window.localStorage)
  return renderWithRouter({ routes, path, session: makeSession(), services })
}

/** The dialog, once it has opened. */
async function dialog() {
  return screen.findByRole('dialog', { name: 'Join your courses' })
}

describe('Join your courses', () => {
  // Proves a new student sees the dialog on arriving, with courses in use and nothing completed
  // or archived (FR-ENR-1).
  it('opens for a new student, listing courses in use', async () => {
    renderNewStudent()

    const box = await dialog()
    expect(await within(box).findByText('Linear Algebra')).toBeInTheDocument()
    expect(within(box).getByText('Sarah Mbarga')).toBeInTheDocument()
    expect(within(box).getByText('Software Engineering')).toBeInTheDocument()
    // Completed and archived courses are not open for requests.
    expect(within(box).queryByText('Calculus I')).not.toBeInTheDocument()
    expect(within(box).queryByText('Communication in English')).not.toBeInTheDocument()
  })

  // Proves the search narrows the list, and says so when nothing matches (FR-ENR-1, FR-ENR-7).
  it('searches by code or title', async () => {
    const { user } = renderNewStudent()
    const box = await dialog()
    await within(box).findByText('Linear Algebra')

    await user.type(within(box).getByRole('searchbox', { name: 'Search courses to join' }), 'mth')
    await waitFor(() => {
      expect(within(box).queryByText('Software Engineering')).not.toBeInTheDocument()
    })
    expect(within(box).getByText('Linear Algebra')).toBeInTheDocument()

    await user.type(within(box).getByRole('searchbox'), '-nothing')
    expect(await within(box).findByText('No courses match your search.')).toBeInTheDocument()
  })

  // Proves a request shows as Requested with a way to cancel, and cancelling restores the button
  // (FR-ENR-3).
  it('requests a course and cancels the request', async () => {
    const { user } = renderNewStudent()
    const box = await dialog()

    await user.click(await within(box).findByRole('button', { name: 'Request to join MTH 202' }))

    expect(await within(box).findByText('Requested')).toBeInTheDocument()
    await user.click(within(box).getByRole('button', { name: 'Cancel request for MTH 202' }))
    expect(
      await within(box).findByRole('button', { name: 'Request to join MTH 202' }),
    ).toBeInTheDocument()
    expect(within(box).queryByText('Requested')).not.toBeInTheDocument()
  })

  // Proves a request the service refuses shows its reason, in the service's own words (FR-ENR-5).
  it('shows why a request was refused', async () => {
    const real = createTestServices().enrolment
    const { user } = renderNewStudent('/dashboard', {
      enrolment: {
        ...real,
        requestToJoin: () =>
          Promise.reject(new AppError('validation', "This course isn't open for requests.")),
      },
    })
    const box = await dialog()

    await user.click(await within(box).findByRole('button', { name: 'Request to join MTH 202' }))

    expect(await within(box).findByRole('alert')).toHaveTextContent(
      "This course isn't open for requests.",
    )
  })

  // Proves a failed load shows a fixed message with Retry, never the raw error (FR-ENR-7).
  it('shows an error with Retry when the list fails', async () => {
    const real = createTestServices().enrolment
    renderNewStudent('/dashboard', {
      enrolment: {
        ...real,
        listJoinableCourses: () => Promise.reject(new AppError('network', 'down')),
      },
    })
    const box = await dialog()

    expect(await within(box).findByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(within(box).queryByText('down')).not.toBeInTheDocument()
  })

  // Proves the loading state is announced before the list arrives.
  it('shows a loading state first', async () => {
    const real = createTestServices().enrolment
    renderNewStudent('/dashboard', {
      enrolment: { ...real, listJoinableCourses: () => new Promise(() => undefined) },
    })
    const box = await dialog()

    expect(within(box).getByRole('status', { name: 'Loading courses' })).toBeInTheDocument()
  })

  // Proves the dialog can be skipped, and then stays closed on the next page (FR-ENR-1).
  it('can be skipped, and stays away for the rest of the session', async () => {
    const { user, router } = renderNewStudent()
    const box = await dialog()

    await user.click(within(box).getByRole('button', { name: 'Not now' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    // Another page and back: still closed.
    await router.navigate('/courses')
    await screen.findByRole('heading', { level: 1, name: 'My Courses' })
    await router.navigate('/dashboard')
    await screen.findByRole('heading', { level: 1, name: /^Good / })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  // Proves "Find courses" opens it again after a skip (FR-ENR-2).
  it('reopens from the Find courses button', async () => {
    const { user } = renderNewStudent()
    await user.click(within(await dialog()).getByRole('button', { name: 'Not now' }))

    await user.click(await screen.findByRole('button', { name: 'Find courses' }))

    expect(await dialog()).toBeInTheDocument()
  })

  // Proves a student who already asked isn't prompted again, and sees the request waiting
  // on the dashboard and on My Courses (FR-ENR-1, FR-ENR-4).
  it('does not open for a student with a request, and lists it on My Courses', async () => {
    const services = createTestServices()
    startNewStudent(window.localStorage)
    await services.enrolment.requestToJoin('mth-202')
    const { router } = renderWithRouter({
      routes,
      path: '/dashboard',
      session: makeSession(),
      services,
    })

    await screen.findByText(/1 request is waiting for approval/)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await router.navigate('/courses')
    const section = await screen.findByRole('region', { name: 'Requested courses' })
    expect(within(section).getByText('MTH 202 · Linear Algebra')).toBeInTheDocument()
    expect(within(section).getByText('Waiting for approval')).toBeInTheDocument()
  })

  // Proves a declined request is shown as declined, with a way to ask again (FR-ENR-3, FR-ENR-4).
  it('shows a declined request, and lets the student ask again', async () => {
    startNewStudent(window.localStorage)
    const services = createTestServices()
    const request = await services.enrolment.requestToJoin('mth-202')
    // The admin declines it (the admin console is another app; the demo stores the decision).
    const stored = JSON.parse(window.localStorage.getItem('conote:mock:enrolment') ?? '{}') as {
      requests: { id: string; status: string }[]
    }
    window.localStorage.setItem(
      'conote:mock:enrolment',
      JSON.stringify({
        enrolledCourseIds: [],
        requests: stored.requests.map((r) =>
          r.id === request.id ? { ...r, status: 'declined' } : r,
        ),
      }),
    )
    const { user, router } = renderWithRouter({
      routes,
      path: '/courses',
      session: makeSession(),
      services,
    })

    const section = await screen.findByRole('region', { name: 'Requested courses' })
    expect(within(section).getByText('Declined')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Find courses' }))
    const box = await dialog()
    await user.click(
      await within(box).findByRole('button', { name: 'Request again to join MTH 202' }),
    )

    expect(await within(box).findByText('Requested')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/courses')
  })

  // Proves the dialog has no accessibility violations.
  it('has no accessibility violations', async () => {
    renderNewStudent()
    const box = await dialog()
    await within(box).findByText('Linear Algebra')

    await expectNoAxeViolations(box)
  })

  // Proves a student already in courses is not prompted, and My Courses offers Find courses.
  it('offers Find courses on My Courses to a student who has courses', async () => {
    const { user } = renderWithRouter({ routes, path: '/courses', session: makeSession() })

    await user.click(await screen.findByRole('button', { name: 'Find courses' }))

    const box = await dialog()
    // The four courses the student is in read as Joined.
    expect(await within(box).findAllByText('Joined')).toHaveLength(4)
  })
})
