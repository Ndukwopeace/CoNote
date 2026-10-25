/**
 * Tests for the Programmes list (D105): the table, opening and closing enrolment, the link to the
 * timetable import, and the loading, empty and error states.
 */

// Queries and waiting.
import { screen, within } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The shared error type.
import { AppError } from '@conote/core/errors'
// Accessibility check.
import { expectNoAxeViolations } from '@conote/testing/axe'

// The routes, so the page renders inside the real layout.
import { routes } from '@/app/routes'
// The records the demo services read.
import {
  courseRecord,
  emptyPlatformData,
  programmeRecord,
  userRecord,
  type PlatformData,
} from '@/services/platformData'
// Service types.
import type { Services } from '@/services/types'
// Session builder.
import { makeSession } from '@/test/factories'
// Render helper.
import { createTestServices, renderWithRouter } from '@/test/renderWithRouter'

/** The platform: the signed-in admin, two courses and two programmes (one closed). */
function platform(): PlatformData {
  return emptyPlatformData({
    users: [
      userRecord({ id: 'admin-test', role: 'admin', fullName: 'Amara Okafor' }),
      userRecord({ id: 's1', role: 'student', fullName: 'Student 01' }),
      userRecord({ id: 's2', role: 'student', fullName: 'Student 02' }),
    ],
    courses: [
      courseRecord({ id: 'c1', code: 'CSC 101', title: 'Programming' }),
      courseRecord({ id: 'c2', code: 'ENG 101', title: 'Writing' }),
    ],
    programmes: [
      programmeRecord({ id: 'p1', code: 'SWE-Y1', name: 'Software Engineering · Year 1' }),
      programmeRecord({
        id: 'p2',
        code: 'BMS-Y1',
        name: 'Business Management · Year 1',
        openEnrolment: false,
      }),
    ],
    programmeCourses: [
      { programmeId: 'p1', courseId: 'c1' },
      { programmeId: 'p1', courseId: 'c2' },
    ],
    programmeMembers: [{ programmeId: 'p1', studentId: 's1' }],
    enrollments: [{ courseId: 'c1', studentId: 's1' }],
    // Student 2 is waiting to join SWE-Y1.
    programmeRequests: [
      {
        id: 'r1',
        programmeId: 'p1',
        studentId: 's2',
        status: 'pending',
        createdAt: '2026-10-19T08:00:00.000Z',
      },
    ],
  })
}

/** Renders the Programmes page as the signed-in admin. */
function renderProgrammes(data = platform(), overrides: Partial<Services> = {}) {
  return renderWithRouter({
    routes,
    path: '/admin/programmes',
    session: makeSession('admin', { fullName: 'Amara Okafor' }),
    platform: data,
    overrides,
  })
}

describe('ProgrammesPage', () => {
  // Proves the list shows each programme with its figures and whether students may join.
  it('lists programmes with their counts and enrolment state', async () => {
    renderProgrammes()

    expect(await screen.findByRole('heading', { level: 1, name: 'Programmes' })).toBeInTheDocument()
    const table = await screen.findByRole('table', { name: 'Programmes' })
    const rows = within(table).getAllByRole('row').slice(1)
    // A to Z by code: BMS first.
    expect(
      within(rows[0]!)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual([
      'Business Management · Year 1BMS-Y1',
      '0',
      '0',
      '0',
      'Closed',
      expect.stringContaining('Open enrolment'),
    ])
    expect(
      within(rows[1]!)
        .getAllByRole('cell')
        .map((cell) => cell.textContent)
        .slice(0, 5),
    ).toEqual(['Software Engineering · Year 1SWE-Y1', '2', '1', '1', 'Open'])
  })

  // Proves closing enrolment changes the row, and says so.
  it('closes enrolment from the row', async () => {
    const { user } = renderProgrammes()
    const table = await screen.findByRole('table', { name: 'Programmes' })
    const row = within(table).getByRole('row', { name: /SWE-Y1/ })

    await user.click(within(row).getByRole('button', { name: 'Close enrolment' }))

    expect(
      await screen.findByText('SWE-Y1 is closed to students joining it themselves.'),
    ).toBeInTheDocument()
    expect(await within(row).findByText('Closed')).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Open enrolment' })).toBeInTheDocument()
  })

  // Proves opening a closed programme works the same way.
  it('opens enrolment from the row', async () => {
    const { user } = renderProgrammes()
    const table = await screen.findByRole('table', { name: 'Programmes' })
    const row = within(table).getByRole('row', { name: /BMS-Y1/ })

    await user.click(within(row).getByRole('button', { name: 'Open enrolment' }))

    expect(
      await screen.findByText('BMS-Y1 is open to students joining it themselves.'),
    ).toBeInTheDocument()
    expect(await within(row).findByText('Open')).toBeInTheDocument()
  })

  // Proves a failed change is explained and the row is left as it was.
  it('explains a failed change', async () => {
    const { user } = renderProgrammes(platform(), {
      programmes: {
        ...createTestServices(platform()).programmes,
        setEnrolmentOpen: () => Promise.reject(new AppError('network', 'down')),
      },
    })
    const table = await screen.findByRole('table', { name: 'Programmes' })
    const row = within(table).getByRole('row', { name: /SWE-Y1/ })

    await user.click(within(row).getByRole('button', { name: 'Close enrolment' }))

    expect(await screen.findByText(/connection|network|try again/i)).toBeInTheDocument()
    expect(within(row).getByText('Open')).toBeInTheDocument()
  })

  // Proves the way to the import is on the page.
  it('links to the timetable import', async () => {
    renderProgrammes()

    expect(await screen.findByRole('link', { name: 'Import timetable' })).toHaveAttribute(
      'href',
      '/admin/programmes/import',
    )
  })

  // Proves a platform with no programmes says how to get some.
  it('shows how to start when there are no programmes', async () => {
    renderProgrammes(emptyPlatformData({ users: platform().users }))

    expect(await screen.findByText('No programmes yet.')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Import a timetable' })[0]).toHaveAttribute(
      'href',
      '/admin/programmes/import',
    )
  })

  // Proves a failed load is explained, with a way to try again.
  it('shows an error with a retry when the list cannot load', async () => {
    renderProgrammes(platform(), {
      programmes: {
        ...createTestServices(platform()).programmes,
        listProgrammes: () => Promise.reject(new AppError('network', 'down')),
      },
    })

    expect(await screen.findByText('Unable to load programmes.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again|retry/i })).toBeInTheDocument()
  })

  // Proves the waiting requests are listed with who asked and for what (D106).
  it('lists the requests waiting for a decision', async () => {
    renderProgrammes()

    const table = await screen.findByRole('table', { name: 'Requests to join a programme' })
    const cells = within(table).getAllByRole('row')[1]?.querySelectorAll('td')
    expect(cells?.[0]?.textContent).toContain('Student 02')
    expect(cells?.[1]?.textContent).toContain('SWE-Y1')
    expect(screen.getByText('1 waiting')).toBeInTheDocument()
  })

  // Proves approving enrols the student: the request leaves the list and the counts follow.
  it('approves a request', async () => {
    const { user } = renderProgrammes()

    await user.click(await screen.findByRole('button', { name: 'Approve Student 02 for SWE-Y1' }))

    expect(await screen.findByText('Student 02 joined SWE-Y1.')).toBeInTheDocument()
    expect(await screen.findByText('No requests are waiting.')).toBeInTheDocument()
    const rows = within(await screen.findByRole('table', { name: 'Programmes' })).getAllByRole(
      'row',
    )
    const swe = rows.find((row) => within(row).queryByText('SWE-Y1'))
    expect(
      Array.from(swe?.querySelectorAll('td') ?? [])
        .slice(1, 4)
        .map((cell) => cell.textContent),
    ).toEqual(['2', '2', '0'])
  })

  // Proves the toast does not wait for the list to refresh. Approving removes the row, so its
  // buttons unmount while the list reloads; a toast tied to them (or to the reload ending) is lost
  // when the reload is slow, which made the browser test fail on a slow runner.
  it('says a student joined even while the list is still refreshing', async () => {
    const base = createTestServices(platform()).programmes
    let decided = false
    const { user } = renderProgrammes(platform(), {
      programmes: {
        ...base,
        decideProgrammeRequest: async (requestId, decision) => {
          decided = true
          return base.decideProgrammeRequest(requestId, decision)
        },
        // After the decision the reload never finishes.
        listProgrammeRequests: () =>
          decided ? new Promise(() => undefined) : base.listProgrammeRequests(),
      },
    })

    await user.click(await screen.findByRole('button', { name: 'Approve Student 02 for SWE-Y1' }))

    expect(await screen.findByText('Student 02 joined SWE-Y1.')).toBeInTheDocument()
  })

  // Proves declining enrols nobody.
  it('declines a request', async () => {
    const { user } = renderProgrammes()

    await user.click(await screen.findByRole('button', { name: 'Decline Student 02 for SWE-Y1' }))

    expect(await screen.findByText('Request from Student 02 declined.')).toBeInTheDocument()
    expect(await screen.findByText('No requests are waiting.')).toBeInTheDocument()
    const rows = within(await screen.findByRole('table', { name: 'Programmes' })).getAllByRole(
      'row',
    )
    const swe = rows.find((row) => within(row).queryByText('SWE-Y1'))
    expect(swe?.querySelectorAll('td')[2]?.textContent).toBe('1')
  })

  // Proves a refused decision is explained.
  it('explains a refused decision', async () => {
    const { user } = renderProgrammes(platform(), {
      programmes: {
        ...createTestServices(platform()).programmes,
        listProgrammeRequests: () =>
          createTestServices(platform()).programmes.listProgrammeRequests(),
        decideProgrammeRequest: () =>
          Promise.reject(new AppError('conflict', 'This request has already been decided.')),
      },
    })

    await user.click(await screen.findByRole('button', { name: 'Approve Student 02 for SWE-Y1' }))

    expect(await screen.findByText(/already been decided/)).toBeInTheDocument()
  })

  // Proves a failed load of the requests shows a retry while the list still works.
  it('shows an error with a retry when the requests cannot load', async () => {
    renderProgrammes(platform(), {
      programmes: {
        ...createTestServices(platform()).programmes,
        listProgrammeRequests: () => Promise.reject(new AppError('network', 'down')),
      },
    })

    expect(await screen.findByText('Unable to load requests.')).toBeInTheDocument()
    expect(await screen.findByRole('table', { name: 'Programmes' })).toBeInTheDocument()
  })

  // Proves the students of a programme are listed in a dialog.
  it('lists the students in a programme', async () => {
    const { user } = renderProgrammes()

    await user.click(await screen.findByRole('button', { name: 'Students in SWE-Y1' }))

    const dialog = await screen.findByRole('dialog', { name: 'Students in SWE-Y1' })
    expect(await within(dialog).findByText('Student 01')).toBeInTheDocument()
  })

  // Proves a programme with no students says so.
  it('says when a programme has no students', async () => {
    const { user } = renderProgrammes()

    await user.click(await screen.findByRole('button', { name: 'Students in BMS-Y1' }))

    const dialog = await screen.findByRole('dialog', { name: 'Students in BMS-Y1' })
    expect(await within(dialog).findByText('No students have joined yet.')).toBeInTheDocument()
  })

  // Proves removing a student asks first, then takes them out and updates the counts.
  it('removes a student from a programme after confirming', async () => {
    const { user } = renderProgrammes()
    await user.click(await screen.findByRole('button', { name: 'Students in SWE-Y1' }))
    const dialog = await screen.findByRole('dialog', { name: 'Students in SWE-Y1' })

    await user.click(
      await within(dialog).findByRole('button', { name: 'Remove Student 01 from SWE-Y1' }),
    )
    const confirm = await screen.findByRole('alertdialog', { name: 'Remove Student 01?' })
    expect(confirm).toHaveTextContent('Their own notes are kept')
    await user.click(within(confirm).getByRole('button', { name: 'Remove' }))

    expect(await screen.findByText('Student 01 removed from SWE-Y1.')).toBeInTheDocument()
    expect(await within(dialog).findByText('No students have joined yet.')).toBeInTheDocument()
  })

  // Proves backing out of the confirmation removes nobody.
  it('keeps the student when the confirmation is cancelled', async () => {
    const { user } = renderProgrammes()
    await user.click(await screen.findByRole('button', { name: 'Students in SWE-Y1' }))
    const dialog = await screen.findByRole('dialog', { name: 'Students in SWE-Y1' })

    await user.click(
      await within(dialog).findByRole('button', { name: 'Remove Student 01 from SWE-Y1' }),
    )
    const confirm = await screen.findByRole('alertdialog', { name: 'Remove Student 01?' })
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }))

    expect(within(dialog).getByText('Student 01')).toBeInTheDocument()
  })

  // Proves the page passes axe's automated accessibility rules.
  it('has no detectable accessibility violations', async () => {
    const { container } = renderProgrammes()
    await screen.findByRole('table', { name: 'Programmes' })

    await expectNoAxeViolations(container)
  })
})
