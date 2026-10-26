/**
 * Tests for joining a programme (FR-ENR-1 to FR-ENR-7, D105, D106, D115): the dialog a new student
 * sees (the year first, then that year's programmes), the dashboard and My Courses entry points,
 * and the Requested courses section.
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
// The programme shape the service returns.
import type { JoinableProgramme } from '@/types/domain'

/** Renders `path` for a brand-new student: in no courses, with no requests. */
function renderNewStudent(path = '/dashboard', services: Partial<Services> = {}) {
  startNewStudent(window.localStorage)
  return renderWithRouter({ routes, path, session: makeSession(), services })
}

/** The dialog, once it has opened. */
async function dialog() {
  return screen.findByRole('dialog', { name: 'Join your programme' })
}

/** A programme as the service lists it, for tests that need one the demo does not have. */
function programme(overrides: Partial<JoinableProgramme>): JoinableProgramme {
  return {
    id: 'p1',
    code: 'SWE-Y3',
    name: 'Software Engineering, Year 3',
    courseCount: 3,
    courseCodes: ['BUS 207', 'CSE 205', 'SWE 311'],
    membership: 'none',
    requestId: null,
    ...overrides,
  }
}

describe('Join your programme dialog', () => {
  // Proves a new student sees the dialog on arriving, and that it asks for the year first. The
  // demo has programmes in Years 1 and 3 that are open, so those two years are offered (D115).
  it('opens for a new student on the year step', async () => {
    renderNewStudent()

    const box = await dialog()
    const years = await within(box).findByRole('group', { name: 'Choose your year' })
    expect(within(years).getByRole('button', { name: 'Year 1' })).toBeInTheDocument()
    expect(within(years).getByRole('button', { name: 'Year 3' })).toBeInTheDocument()
    // No programme has a Year 2 in the demo, so the year is not offered.
    expect(within(years).queryByRole('button', { name: 'Year 2' })).not.toBeInTheDocument()
    // The programmes wait until a year is chosen.
    expect(within(box).queryByText('Software Engineering, Year 3')).not.toBeInTheDocument()
  })

  // Proves single courses cannot be asked for from the dialog any more: no search box, no list.
  it('has no course search and lists no courses', async () => {
    renderNewStudent()
    const box = await dialog()
    await within(box).findByRole('group', { name: 'Choose your year' })

    expect(within(box).queryByRole('searchbox')).not.toBeInTheDocument()
    expect(within(box).queryByText(/single course/i)).not.toBeInTheDocument()
    expect(within(box).queryByText('Linear Algebra')).not.toBeInTheDocument()
    expect(within(box).queryByRole('button', { name: /Request to join Linear/ })).toBeNull()
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

  // Proves a student who already asked for a course isn't prompted again, and sees the request
  // waiting on the dashboard and on My Courses (FR-ENR-1, FR-ENR-4).
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

  // Proves a declined course request is still shown as declined on My Courses (FR-ENR-4). Asking
  // again is for programmes now, so the section only reports what happened.
  it('shows a declined request on My Courses', async () => {
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
    renderWithRouter({ routes, path: '/courses', session: makeSession(), services })

    const section = await screen.findByRole('region', { name: 'Requested courses' })

    expect(within(section).getByText('Declined')).toBeInTheDocument()
  })

  // Proves the year step has no accessibility violations.
  it('has no accessibility violations on the year step', async () => {
    renderNewStudent()
    const box = await dialog()
    await within(box).findByRole('group', { name: 'Choose your year' })

    await expectNoAxeViolations(box)
  })

  // Proves a student already in courses is not prompted, and My Courses offers Join programme,
  // which asks for the year like it does for anyone who has no programme yet.
  it('offers Join programme on My Courses to a student who has courses', async () => {
    const { user } = renderWithRouter({ routes, path: '/courses', session: makeSession() })

    await user.click(await screen.findByRole('button', { name: 'Join programme' }))

    const box = await dialog()
    expect(await within(box).findByRole('group', { name: 'Choose your year' })).toBeInTheDocument()
  })

  // Proves the loading state is announced before the programmes arrive.
  it('shows a loading state first', async () => {
    const real = createTestServices().enrolment
    renderNewStudent('/dashboard', {
      enrolment: { ...real, listJoinableProgrammes: () => new Promise(() => undefined) },
    })
    const box = await dialog()

    expect(within(box).getByLabelText('Loading programmes')).toBeInTheDocument()
  })

  // Proves a failed load shows a fixed message with Retry, never the raw error (FR-ENR-7).
  it('shows an error with Retry when the programmes fail to load', async () => {
    const real = createTestServices().enrolment
    renderNewStudent('/dashboard', {
      enrolment: {
        ...real,
        listJoinableProgrammes: () => Promise.reject(new AppError('network', 'down')),
      },
    })
    const box = await dialog()

    expect(await within(box).findByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(within(box).queryByText('down')).not.toBeInTheDocument()
  })

  // Proves a school with no open programme says so, instead of showing an empty dialog.
  it('says so when no programme is open', async () => {
    const real = createTestServices().enrolment
    renderNewStudent('/dashboard', {
      enrolment: { ...real, listJoinableProgrammes: () => Promise.resolve([]) },
    })
    const box = await dialog()

    expect(await within(box).findByText(/No programme is open to join yet/)).toBeInTheDocument()
    expect(within(box).queryByRole('group')).not.toBeInTheDocument()
  })
})

describe('Join your programme: year, then programmes', () => {
  /** Opens the dialog for a new student; returns the dialog and the year group. */
  async function openYears(
    path = '/dashboard',
    services: Partial<Services> = {},
    student: { startNew: boolean } = { startNew: true },
  ) {
    if (student.startNew) startNewStudent(window.localStorage)
    const view = renderWithRouter({ routes, path, session: makeSession(), services })
    const box = await dialog()
    const years = await within(box).findByRole('group', { name: 'Choose your year' })
    return { ...view, box, years }
  }

  /** Opens the dialog and picks `year`; returns the programme group. */
  async function openGroup(
    year = 'Year 3',
    services: Partial<Services> = {},
    student: { startNew: boolean } = { startNew: true },
  ) {
    const opened = await openYears('/dashboard', services, student)
    await opened.user.click(within(opened.years).getByRole('button', { name: year }))
    const group = await within(opened.box).findByRole('group', { name: 'Choose your programme' })
    return { ...opened, group }
  }

  // Proves choosing a year shows only that year's open programmes, with what joining adds, and
  // leaves out other years and closed programmes (D105, D115).
  it('shows only the programmes of the chosen year', async () => {
    const { group } = await openGroup('Year 3')

    expect(within(group).getByText('Software Engineering, Year 3')).toBeInTheDocument()
    expect(within(group).getByText(/Cloud Security and Data Protection Engineering/)).toBeVisible()
    // Another year's programme, and closed ones, are not shown.
    expect(within(group).queryByText('Biomedical Sciences, Year 1')).not.toBeInTheDocument()
    expect(within(group).queryByText('Law, Year 1')).not.toBeInTheDocument()
    // The courses in use, by code; the completed and archived ones are left out.
    expect(within(group).getByText('3 courses: BUS 207, CSE 205, SWE 311')).toBeInTheDocument()
    // Asking, not joining: an administrator approves.
    expect(
      within(group).getByRole('button', { name: 'Request to join Software Engineering, Year 3' }),
    ).toBeInTheDocument()
  })

  // Proves the other year shows its own programmes.
  it('shows the programmes of Year 1 when Year 1 is chosen', async () => {
    const { group } = await openGroup('Year 1')

    expect(within(group).getByText('Biomedical Sciences, Year 1')).toBeInTheDocument()
    expect(within(group).queryByText('Software Engineering, Year 3')).not.toBeInTheDocument()
  })

  // Proves a wrong year can be changed, which brings the year step back.
  it('goes back to the years from Change year', async () => {
    const { user, box, group } = await openGroup('Year 3')

    await user.click(within(group).getByRole('button', { name: 'Change year' }))

    expect(await within(box).findByRole('group', { name: 'Choose your year' })).toBeInTheDocument()
    expect(within(box).queryByRole('group', { name: 'Choose your programme' })).toBeNull()
  })

  // Proves asking records a waiting request and says an administrator decides; nothing is
  // enrolled, so the student's Home does not change. Only the programme asked for stays in view:
  // a student can hold one request at a time and belong to one programme.
  it('asks to join, shows only that programme as waiting and enrols nothing', async () => {
    const { user, box, group } = await openGroup('Year 3')

    await user.click(
      within(group).getByRole('button', { name: 'Request to join Software Engineering, Year 3' }),
    )

    expect(await screen.findByText('Request sent. An administrator will approve it.')).toBeVisible()
    expect(await within(box).findByText('Requested')).toBeInTheDocument()
    // Still the no-courses Home: the dialog stays open on the request.
    expect(screen.getByRole('dialog', { name: 'Join your programme' })).toBeInTheDocument()
    // The other programmes, in this year and in others, are out of the way.
    expect(within(box).queryByText(/Cloud Security and Data Protection/)).not.toBeInTheDocument()
    expect(within(box).queryByRole('group', { name: 'Choose your year' })).not.toBeInTheDocument()
    expect(within(box).getByText(/One request waits at a time/)).toBeInTheDocument()
  })

  // Proves a waiting request can be withdrawn, which brings back the programmes of that year and
  // lets the student change year.
  it('withdraws a request and offers the programmes again', async () => {
    const { user, box, group } = await openGroup('Year 3')
    await user.click(
      within(group).getByRole('button', { name: 'Request to join Software Engineering, Year 3' }),
    )
    await within(box).findByText('Requested')

    await user.click(
      within(box).getByRole('button', { name: 'Cancel request for Software Engineering, Year 3' }),
    )

    const again = await within(box).findByRole('group', { name: 'Choose your programme' })
    expect(within(again).getByText(/Cloud Security and Data Protection/)).toBeVisible()
    expect(
      within(again).getByRole('button', { name: 'Request to join Software Engineering, Year 3' }),
    ).toBeEnabled()
    await user.click(within(again).getByRole('button', { name: 'Change year' }))
    await user.click(await within(box).findByRole('button', { name: 'Year 1' }))
    expect(await within(box).findByText('Biomedical Sciences, Year 1')).toBeInTheDocument()
  })

  // Proves a student who already has a request waiting opens the dialog on it, with no year step.
  it('opens on the waiting request, without asking for the year again', async () => {
    const services = createTestServices()
    startNewStudent(window.localStorage)
    await services.enrolment.requestProgramme('swe-y3')
    const { user } = renderWithRouter({
      routes,
      path: '/courses',
      session: makeSession(),
      services,
    })

    await user.click(await screen.findByRole('button', { name: 'Join programme' }))
    const box = await dialog()

    expect(await within(box).findByText('Requested')).toBeInTheDocument()
    expect(within(box).getByText('Software Engineering, Year 3')).toBeInTheDocument()
    expect(within(box).queryByRole('group', { name: 'Choose your year' })).not.toBeInTheDocument()
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
    const box = await dialog()
    const group = await within(box).findByRole('group', { name: 'Choose your programme' })

    expect(within(group).getByText('Software Engineering, Year 3')).toBeInTheDocument()
    expect(within(group).getByText('Joined')).toBeInTheDocument()
    expect(within(group).queryByText('Biomedical Sciences, Year 1')).not.toBeInTheDocument()
    expect(within(group).queryByRole('button', { name: /Request to join/ })).not.toBeInTheDocument()
    expect(within(group).getByText(/To change it, ask an administrator/)).toBeInTheDocument()
    // No year to choose: the student has one.
    expect(within(box).queryByRole('group', { name: 'Choose your year' })).not.toBeInTheDocument()
  })

  // Proves a refused request says why, in words written for people.
  it('shows why a programme could not be requested', async () => {
    const real = createTestServices().enrolment
    const { user, group } = await openGroup('Year 3', {
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
    const { group } = await openGroup('Year 3', {
      enrolment: {
        ...real,
        listJoinableProgrammes: () =>
          Promise.resolve([programme({ membership: 'declined' as const })]),
      },
    })

    expect(within(group).getByText('Declined')).toBeInTheDocument()
    expect(
      within(group).getByRole('button', {
        name: 'Request again to join Software Engineering, Year 3',
      }),
    ).toBeEnabled()
  })

  // Proves a programme whose code names no year is still reachable, under "Other programmes",
  // and is not put in a wrong year.
  it('keeps a programme without a year under Other programmes', async () => {
    const real = createTestServices().enrolment
    const { user, box, years } = await openYears('/dashboard', {
      enrolment: {
        ...real,
        listJoinableProgrammes: () =>
          Promise.resolve([
            programme({ id: 'p1', code: 'SWE-Y3', name: 'Software Engineering, Year 3' }),
            programme({ id: 'p2', code: 'LAW', name: 'Law foundation' }),
          ]),
      },
    })

    expect(within(years).getByRole('button', { name: 'Year 3' })).toBeInTheDocument()
    await user.click(within(years).getByRole('button', { name: 'Other programmes' }))

    const group = await within(box).findByRole('group', { name: 'Choose your programme' })
    expect(within(group).getByText('Law foundation')).toBeInTheDocument()
    expect(within(group).queryByText('Software Engineering, Year 3')).not.toBeInTheDocument()
  })

  // Proves the year buttons are in order, lowest first, whatever order the service lists them in.
  it('lists the years from the lowest', async () => {
    const real = createTestServices().enrolment
    const { years } = await openYears('/dashboard', {
      enrolment: {
        ...real,
        listJoinableProgrammes: () =>
          Promise.resolve([
            programme({ id: 'a', code: 'SWE-Y3', name: 'A' }),
            programme({ id: 'b', code: 'SWE-Y1', name: 'B' }),
            programme({ id: 'c', code: 'SWE-Y2', name: 'C' }),
          ]),
      },
    })

    expect(
      within(years)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Year 1', 'Year 2', 'Year 3'])
  })

  // Proves the programme step has no accessibility violations.
  it('has no accessibility violations on the programme step', async () => {
    const { box } = await openGroup('Year 3')

    await expectNoAxeViolations(box)
  })
})
