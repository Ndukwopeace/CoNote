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
import {
  createTestServices,
  MOCK_ENROLMENT_KEY,
  renderWithRouter,
  startNewStudent,
} from '@/test/renderWithRouter'
// Service overrides type.
import type { Services } from '@/services/types'

/** Renders `path` for a brand-new student: in no courses, with no requests. */
function renderNewStudent(path = '/dashboard', services: Partial<Services> = {}) {
  startNewStudent(window.localStorage)
  return renderWithRouter({ routes, path, session: makeSession(), services })
}

/** The dialog, once it has opened. */
async function dialog() {
  return screen.findByRole('dialog', { name: 'Join your programme' })
}

describe('Join your programme dialog', () => {
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

    await user.click(
      await within(box).findByRole('button', { name: 'Request to join Linear Algebra' }),
    )

    expect(await within(box).findByText('Requested')).toBeInTheDocument()
    await user.click(within(box).getByRole('button', { name: 'Cancel request for Linear Algebra' }))
    expect(
      await within(box).findByRole('button', { name: 'Request to join Linear Algebra' }),
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

    await user.click(
      await within(box).findByRole('button', { name: 'Request to join Linear Algebra' }),
    )

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
    await screen.findByRole('heading', { level: 1, name: "Let's CoNote" })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  // Proves "Join programme" opens it again after a skip (FR-ENR-2).
  it('reopens from the Join programme button', async () => {
    const { user } = renderNewStudent()
    await user.click(within(await dialog()).getByRole('button', { name: 'Not now' }))

    await user.click(await screen.findByRole('button', { name: 'Join programme' }))

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
    await user.click(screen.getByRole('button', { name: 'Join programme' }))
    const box = await dialog()
    await user.click(
      await within(box).findByRole('button', { name: 'Request again to join Linear Algebra' }),
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

  // Proves a student already in courses is not prompted, and My Courses offers Join programme.
  it('offers Join programme on My Courses to a student who has courses', async () => {
    const { user } = renderWithRouter({ routes, path: '/courses', session: makeSession() })

    await user.click(await screen.findByRole('button', { name: 'Join programme' }))

    const box = await dialog()
    // The four courses the student is in read as Joined.
    expect(await within(box).findAllByText('Joined')).toHaveLength(4)
  })
})

describe('Join your programme', () => {
  /** Opens the dialog for a new student and returns the programme group. */
  async function openGroup(
    path = '/dashboard',
    services: Partial<Services> = {},
    student: { startNew: boolean } = { startNew: true },
  ) {
    if (student.startNew) startNewStudent(window.localStorage)
    const view = renderWithRouter({ routes, path, session: makeSession(), services })
    const box = await dialog()
    const group = await within(box).findByRole('group', { name: 'Choose your programme' })
    return { ...view, box, group }
  }

  // Proves the dialog offers the open programmes first, with what joining adds, and hides a
  // closed one (D105).
  it('offers the open programmes with their courses', async () => {
    const { group } = await openGroup()

    expect(within(group).getByText('Software Engineering, Year 3')).toBeInTheDocument()
    expect(within(group).getByText('Biomedical Sciences, Year 1')).toBeInTheDocument()
    // Closed programmes are not offered.
    expect(within(group).queryByText('Law, Year 1')).not.toBeInTheDocument()
    // The courses in use, by code; the completed and archived ones are left out.
    expect(within(group).getByText('3 courses: BUS 207, CSE 205, SWE 311')).toBeInTheDocument()
    // Asking, not joining: an administrator approves.
    expect(
      within(group).getByRole('button', { name: 'Request to join Software Engineering, Year 3' }),
    ).toBeInTheDocument()
  })

  // Proves asking records a waiting request and says an administrator decides; nothing is
  // enrolled, so the student's Home does not change.
  it('asks to join, shows the request as waiting and enrols nothing', async () => {
    const { user, group } = await openGroup()

    await user.click(
      within(group).getByRole('button', { name: 'Request to join Software Engineering, Year 3' }),
    )

    expect(await screen.findByText('Request sent. An administrator will approve it.')).toBeVisible()
    expect(await within(group).findByText('Requested')).toBeInTheDocument()
    // Still the no-courses Home: the dialog stays open on the request.
    expect(screen.getByRole('dialog', { name: 'Join your programme' })).toBeInTheDocument()
    // One request waits at a time: the others cannot be asked for yet.
    expect(
      within(group).getByRole('button', { name: 'Request to join Biomedical Sciences, Year 1' }),
    ).toBeDisabled()
    expect(within(group).getByText(/One request waits at a time/)).toBeInTheDocument()
  })

  // Proves a waiting request can be withdrawn, which frees the other programmes.
  it('withdraws a request', async () => {
    const { user, group } = await openGroup()
    await user.click(
      within(group).getByRole('button', { name: 'Request to join Software Engineering, Year 3' }),
    )
    await within(group).findByText('Requested')

    await user.click(
      within(group).getByRole('button', {
        name: 'Cancel request for Software Engineering, Year 3',
      }),
    )

    await waitFor(() => {
      expect(within(group).queryByText('Requested')).not.toBeInTheDocument()
    })
    expect(
      within(group).getByRole('button', { name: 'Request to join Biomedical Sciences, Year 1' }),
    ).toBeEnabled()
  })

  // Proves an approved student sees only their programme, as joined, and is told how to change it.
  it('shows only the programme the student is in', async () => {
    // As the demo leaves a student after an administrator approved the request.
    window.localStorage.setItem(
      MOCK_ENROLMENT_KEY,
      JSON.stringify({
        enrolledCourseIds: ['swe-311', 'cse-205', 'bus-207'],
        requests: [],
        programmeId: 'swe-y3',
        programmeRequests: [
          {
            id: 'r1',
            programmeId: 'swe-y3',
            status: 'approved',
            createdAt: '2026-10-19T08:00:00Z',
          },
        ],
      }),
    )
    const { user } = renderWithRouter({ routes, path: '/courses', session: makeSession() })
    await user.click(await screen.findByRole('button', { name: 'Join programme' }))
    const group = await within(await dialog()).findByRole('group', {
      name: 'Choose your programme',
    })

    expect(within(group).getByText('Software Engineering, Year 3')).toBeInTheDocument()
    expect(within(group).getByText('Joined')).toBeInTheDocument()
    expect(within(group).queryByText('Biomedical Sciences, Year 1')).not.toBeInTheDocument()
    expect(within(group).queryByRole('button', { name: /Request to join/ })).not.toBeInTheDocument()
    expect(within(group).getByText(/To change it, ask an administrator/)).toBeInTheDocument()
  })

  // Proves a refused request says why, in words written for people.
  it('shows why a programme could not be requested', async () => {
    const real = createTestServices().enrolment
    const { user, group } = await openGroup('/dashboard', {
      enrolment: {
        ...real,
        requestProgramme: () =>
          Promise.reject(new AppError('conflict', "You're already in a programme.")),
      },
    })

    await user.click(
      within(group).getByRole('button', { name: 'Request to join Software Engineering, Year 3' }),
    )

    expect(await within(group).findByText("You're already in a programme.")).toBeInTheDocument()
  })

  // Proves a declined request shows as declined and can be sent again.
  it('shows a declined request and offers to ask again', async () => {
    const real = createTestServices().enrolment
    const { group } = await openGroup('/dashboard', {
      enrolment: {
        ...real,
        listJoinableProgrammes: () =>
          Promise.resolve([
            {
              id: 'swe-y3',
              code: 'SWE-Y3',
              name: 'Software Engineering, Year 3',
              courseCount: 3,
              courseCodes: ['BUS 207', 'CSE 205', 'SWE 311'],
              membership: 'declined' as const,
              requestId: null,
            },
          ]),
      },
    })

    expect(within(group).getByText('Declined')).toBeInTheDocument()
    expect(
      within(group).getByRole('button', {
        name: 'Request again to join Software Engineering, Year 3',
      }),
    ).toBeEnabled()
  })

  // Proves a failed load of the programmes shows a retry, while the courses still list.
  it('shows an error with Retry when the programmes fail to load', async () => {
    const real = createTestServices().enrolment
    startNewStudent(window.localStorage)
    renderWithRouter({
      routes,
      path: '/dashboard',
      session: makeSession(),
      services: {
        enrolment: {
          ...real,
          listJoinableProgrammes: () => Promise.reject(new AppError('network', 'down')),
        },
      },
    })
    const box = await dialog()

    expect(await within(box).findByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(await within(box).findByText('Linear Algebra')).toBeInTheDocument()
  })

  // Proves a school with no open programme shows no programme section at all.
  it('shows nothing when no programme is open', async () => {
    const real = createTestServices().enrolment
    startNewStudent(window.localStorage)
    renderWithRouter({
      routes,
      path: '/dashboard',
      session: makeSession(),
      services: { enrolment: { ...real, listJoinableProgrammes: () => Promise.resolve([]) } },
    })
    const box = await dialog()
    await within(box).findByText('Linear Algebra')

    expect(
      within(box).queryByRole('group', { name: 'Choose your programme' }),
    ).not.toBeInTheDocument()
  })

  // Proves the section has no accessibility violations.
  it('has no accessibility violations', async () => {
    const { box } = await openGroup()

    await expectNoAxeViolations(box)
  })
})
