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
    users: [userRecord({ id: 'admin-test', role: 'admin', fullName: 'Amara Okafor' })],
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
      'Closed',
      expect.stringContaining('Open enrolment'),
    ])
    expect(
      within(rows[1]!)
        .getAllByRole('cell')
        .map((cell) => cell.textContent)
        .slice(0, 4),
    ).toEqual(['Software Engineering · Year 1SWE-Y1', '2', '1', 'Open'])
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

  // Proves the page passes axe's automated accessibility rules.
  it('has no detectable accessibility violations', async () => {
    const { container } = renderProgrammes()
    await screen.findByRole('table', { name: 'Programmes' })

    await expectNoAxeViolations(container)
  })
})
