/**
 * Tests for the timetable import page (D105): choosing a file and the term, reading it, reviewing
 * what it found, matching teachers, previewing, importing, and every way it can fail. The PDF
 * reader is replaced with one that returns a page built in the test, so no real file is needed.
 */

// Queries, events and waiting.
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
// Realistic typing, clicking and choosing files.
import userEvent from '@testing-library/user-event'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The shared error type.
import { AppError } from '@conote/core/errors'
// Accessibility check.
import { expectNoAxeViolations } from '@conote/testing/axe'

// The records the demo services read.
import { emptyPlatformData, userRecord, type PlatformData } from '@/services/platformData'
// Service types.
import type { Services } from '@/services/types'
// Session builder.
import { makeSession } from '@/test/factories'
// Render helper.
import { createTestServices, renderWithRouter } from '@/test/renderWithRouter'
// A timetable page laid out like the school's PDF.
import { buildPage, ordinaryPage } from '@/test/timetablePage'

// The page under test.
import type { PageText } from '@/lib/timetable/types'
import { ImportTimetablePage } from './ImportTimetablePage'

/** The platform: the signed-in admin, two active teachers and an inactive one. */
function platform(): PlatformData {
  return emptyPlatformData({
    users: [
      userRecord({ id: 'admin-test', role: 'admin', fullName: 'Amara Okafor' }),
      userRecord({ id: 't1', role: 'teacher', fullName: 'Peter Ndambomve' }),
      userRecord({ id: 't2', role: 'teacher', fullName: 'Grace Majeu' }),
      userRecord({ id: 't3', role: 'teacher', fullName: 'Mr. Away', status: 'inactive' }),
    ],
  })
}

/** Renders the page with a PDF reader that gives `pages`, or fails with `failure`. */
function renderImport({
  data = platform(),
  pages = [ordinaryPage()],
  failure,
  overrides = {},
}: {
  data?: PlatformData
  pages?: PageText[]
  failure?: Error
  overrides?: Partial<Services>
} = {}) {
  const readPdf = () => (failure ? Promise.reject(failure) : Promise.resolve(pages))
  return {
    data,
    ...renderWithRouter({
      routes: [
        { path: '/admin/programmes/import', element: <ImportTimetablePage readPdf={readPdf} /> },
      ],
      path: '/admin/programmes/import',
      session: makeSession('admin', { fullName: 'Amara Okafor' }),
      platform: data,
      overrides,
    }),
  }
}

/** A PDF file for the file field. */
const pdf = () => new File(['%PDF-1.4'], 'timetable.pdf', { type: 'application/pdf' })

/** Fills the form: the file and the term, leaving the time zone as it is. */
async function fillForm(
  user: ReturnType<typeof renderImport>['user'],
  { start = '2026-10-13', end = '2026-12-22', skip = '', file = pdf() } = {},
) {
  await user.upload(screen.getByLabelText('Timetable PDF'), file)
  fireEvent.change(screen.getByLabelText('First day of term'), { target: { value: start } })
  fireEvent.change(screen.getByLabelText('Last day of term'), { target: { value: end } })
  if (skip)
    fireEvent.change(screen.getByLabelText(/Days without classes/), { target: { value: skip } })
}

/** Fills the form and reads the timetable, ending on the review. */
async function reachReview(
  user: ReturnType<typeof renderImport>['user'],
  options?: Parameters<typeof fillForm>[1],
) {
  await fillForm(user, options)
  await user.click(screen.getByRole('button', { name: 'Read timetable' }))
  await screen.findByRole('heading', { level: 2, name: 'Review before importing' })
}

describe('ImportTimetablePage: the form', () => {
  // Proves the form asks for the file, the term and the time zone, with Douala as the zone.
  it('asks for the file, the term, days off and the time zone', async () => {
    renderImport()

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Import a timetable' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Timetable PDF')).toBeInTheDocument()
    expect(screen.getByLabelText('First day of term')).toBeInTheDocument()
    expect(screen.getByLabelText('Last day of term')).toBeInTheDocument()
    expect(screen.getByLabelText(/Days without classes/)).toBeInTheDocument()
    expect(screen.getByLabelText('Time zone')).toHaveValue('Africa/Douala')
  })

  // Proves leaving everything empty says what is missing, field by field.
  it('says what is missing', async () => {
    const { user } = renderImport()

    await user.click(await screen.findByRole('button', { name: 'Read timetable' }))

    expect(await screen.findByText('Choose the timetable PDF.')).toBeInTheDocument()
    expect(screen.getByText("Enter the term's start date as YYYY-MM-DD.")).toBeInTheDocument()
  })

  // Proves a file that is not a PDF is refused before it is read.
  it('refuses a file that is not a PDF', async () => {
    const { user } = renderImport()
    await screen.findByLabelText('Timetable PDF')

    // A real file chooser hides files the field does not accept; this user ignores that, as a
    // person can by typing a file name or dragging a file in.
    await fillForm(userEvent.setup({ applyAccept: false }), {
      file: new File(['x'], 'timetable.docx', { type: 'application/msword' }),
    })
    await user.click(screen.getByRole('button', { name: 'Read timetable' }))

    expect(await screen.findByText('Choose a PDF file.')).toBeInTheDocument()
  })

  // Proves a term that ends before it starts is explained.
  it('refuses an end before the start', async () => {
    const { user } = renderImport()
    await screen.findByLabelText('Timetable PDF')

    await fillForm(user, { start: '2026-12-22', end: '2026-10-13' })
    await user.click(screen.getByRole('button', { name: 'Read timetable' }))

    expect(
      await screen.findByText('The end date must be after the start date.'),
    ).toBeInTheDocument()
  })

  // Proves dates to skip that are not dates are reported back.
  it('names the days off that are not dates', async () => {
    const { user } = renderImport()
    await screen.findByLabelText('Timetable PDF')

    await fillForm(user, { skip: '2026-11-02, soon' })
    await user.click(screen.getByRole('button', { name: 'Read timetable' }))

    expect(
      await screen.findByText('These are not dates (use YYYY-MM-DD): soon'),
    ).toBeInTheDocument()
  })

  // Proves an unknown time zone is refused.
  it('refuses an unknown time zone', async () => {
    const { user } = renderImport()
    await screen.findByLabelText('Timetable PDF')

    await fillForm(user)
    fireEvent.change(screen.getByLabelText('Time zone'), { target: { value: 'Mars/Base' } })
    await user.click(screen.getByRole('button', { name: 'Read timetable' }))

    expect(
      await screen.findByText("That time zone isn't one we know, for example Africa/Douala."),
    ).toBeInTheDocument()
  })

  // Proves the form passes axe's automated accessibility rules.
  it('has no detectable accessibility violations', async () => {
    const { container } = renderImport()
    await screen.findByLabelText('Timetable PDF')

    await expectNoAxeViolations(container)
  })
})

describe('ImportTimetablePage: reading the file', () => {
  // Proves a file pdf.js cannot open is explained on the form, and the form stays.
  it("explains a file that can't be read", async () => {
    const { user } = renderImport({
      failure: new AppError('validation', "This file can't be read as a PDF."),
    })
    await screen.findByLabelText('Timetable PDF')

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Read timetable' }))

    expect(await screen.findByText("This file can't be read as a PDF.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Read timetable' })).toBeEnabled()
  })

  // Proves a file with no readable timetable page says why, page by page.
  it('lists the pages it could not read when none can be', async () => {
    const blank = buildPage({ rows: [] })
    const { user } = renderImport({ pages: [blank] })
    await screen.findByLabelText('Timetable PDF')

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Read timetable' }))

    expect(
      await screen.findByText('No timetable page could be read from this file.'),
    ).toBeInTheDocument()
    expect(screen.getByText(/Page 1:/)).toBeInTheDocument()
  })
})

describe('ImportTimetablePage: the review', () => {
  // Proves the review lists the programme, the courses and what it will create.
  it('shows what it found', async () => {
    const { user } = renderImport()
    await screen.findByLabelText('Timetable PDF')

    await reachReview(user)

    const summary = screen.getByRole('list', { name: 'What was found' })
    expect(within(summary).getByText('1 programme')).toBeInTheDocument()
    expect(within(summary).getByText('4 courses')).toBeInTheDocument()
    const courses = screen.getByRole('table', { name: 'Courses' })
    expect(within(courses).getByRole('row', { name: /MATH 101/ })).toBeInTheDocument()
    expect(within(courses).getByRole('row', { name: /ENG 101/ })).toBeInTheDocument()
    const programmes = screen.getByRole('table', { name: 'Programmes' })
    expect(within(programmes).getByText('SWE-Y1')).toBeInTheDocument()
  })

  // Proves a teacher the timetable names is matched to the account with that surname.
  it('picks the teacher whose name fits', async () => {
    const { user } = renderImport()
    await screen.findByLabelText('Timetable PDF')

    await reachReview(user)

    expect(screen.getByLabelText('Teacher for MATH 101')).toHaveValue('t1')
    expect(screen.getByLabelText('Teacher for ENG 101')).toHaveValue('t2')
  })

  // Proves a name with no account is left unassigned, and the administrator is told why.
  it('leaves a teacher with no account unassigned and says so', async () => {
    const { user } = renderImport()
    await screen.findByLabelText('Timetable PDF')

    await reachReview(user)

    expect(screen.getByLabelText('Teacher for CYB 101')).toHaveValue('')
    expect(screen.getAllByText(/No account fits "Mr TAGWAN"/)[0]).toBeInTheDocument()
  })

  // Proves the preview says how many programmes, courses and classes an import would add.
  it('previews what would be created', async () => {
    const { user } = renderImport()
    await screen.findByLabelText('Timetable PDF')

    await reachReview(user)

    // 13 Oct to 22 Dec: 4 courses; MATH 101 Mondays (10), CYB 101 Tuesdays (11), SWE 102 Fridays
    // (10) and ENG 101 Mondays afternoon (10), plus nothing else.
    expect(
      await screen.findByText(/This will create 1 programme, 4 courses and 41 classes\./),
    ).toBeInTheDocument()
  })

  // Proves the days off take classes out of the count.
  it('leaves out the days off', async () => {
    const { user } = renderImport()
    await screen.findByLabelText('Timetable PDF')

    // Monday 2026-10-19 has two classes (MATH 101 and ENG 101).
    await reachReview(user, { skip: '2026-10-19' })

    expect(await screen.findByText(/4 courses and 39 classes\./)).toBeInTheDocument()
  })

  // Proves the administrator can go back and change the dates.
  it('goes back to the form', async () => {
    const { user } = renderImport()
    await screen.findByLabelText('Timetable PDF')
    await reachReview(user)

    await user.click(screen.getByRole('button', { name: 'Back' }))

    expect(await screen.findByRole('button', { name: 'Read timetable' })).toBeInTheDocument()
    expect(screen.getByLabelText('First day of term')).toHaveValue('2026-10-13')
  })

  // Proves lunch and the fitness slot are shown as skipped, not hidden.
  it('shows what was skipped', async () => {
    const { user } = renderImport()
    await screen.findByLabelText('Timetable PDF')

    await reachReview(user)

    await user.click(screen.getByText('Skipped cells'))
    expect(screen.getByText('LUNCH BREAK')).toBeInTheDocument()
  })

  // Proves a page that could not be read is reported while the others carry on.
  it('reports a page it could not read and carries on', async () => {
    const { user } = renderImport({ pages: [ordinaryPage(), buildPage({ rows: [] })] })
    await screen.findByLabelText('Timetable PDF')

    await reachReview(user)

    expect(screen.getByText(/Page 2:/)).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Courses' })).toBeInTheDocument()
  })

  // Proves the review passes axe's automated accessibility rules.
  it('has no detectable accessibility violations', async () => {
    const { user, container } = renderImport()
    await screen.findByLabelText('Timetable PDF')
    await reachReview(user)
    await screen.findByText(/This will create/)

    await expectNoAxeViolations(container)
  })
})

describe('ImportTimetablePage: importing', () => {
  // Proves importing creates the courses, with the teachers chosen, and says what was done.
  it('imports and reports the counts', async () => {
    const { user, data } = renderImport()
    await screen.findByLabelText('Timetable PDF')
    await reachReview(user)
    await screen.findByText(/This will create/)

    await user.click(screen.getByRole('button', { name: 'Import timetable' }))

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Timetable imported' }),
    ).toBeInTheDocument()
    expect(screen.getByText('4 courses and 41 classes were created.')).toBeInTheDocument()
    expect(data.courses.map((course) => course.code).sort()).toEqual([
      'CYB 101',
      'ENG 101',
      'MATH 101',
      'SWE 102',
    ])
    expect(data.courses.find((course) => course.code === 'MATH 101')?.teacherId).toBe('t1')
    expect(data.courses.find((course) => course.code === 'CYB 101')?.teacherId).toBeNull()
    expect(data.programmes.map((programme) => programme.code)).toEqual(['SWE-Y1'])
    expect(screen.getByRole('link', { name: 'View programmes' })).toHaveAttribute(
      'href',
      '/admin/programmes',
    )
  })

  // Proves a teacher the administrator picks by hand is the one assigned.
  it('assigns the teacher the administrator picks', async () => {
    const { user, data } = renderImport()
    await screen.findByLabelText('Timetable PDF')
    await reachReview(user)
    await screen.findByText(/This will create/)

    await user.selectOptions(screen.getByLabelText('Teacher for CYB 101'), 't2')
    await user.click(screen.getByRole('button', { name: 'Import timetable' }))

    await screen.findByRole('heading', { level: 2, name: 'Timetable imported' })
    expect(data.courses.find((course) => course.code === 'CYB 101')?.teacherId).toBe('t2')
  })

  // Proves a refused import is explained and the administrator can try again.
  it('explains a failed import and lets the administrator try again', async () => {
    const real = createTestServices(platform()).programmes
    let calls = 0
    const { user } = renderImport({
      overrides: {
        programmes: {
          ...real,
          importTimetable: (payload, options) => {
            calls += options.dryRun ? 0 : 1
            return options.dryRun
              ? real.importTimetable(payload, options)
              : Promise.reject(new AppError('network', 'down'))
          },
        },
      },
    })
    await screen.findByLabelText('Timetable PDF')
    await reachReview(user)
    await screen.findByText(/This will create/)

    await user.click(screen.getByRole('button', { name: 'Import timetable' }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Import timetable' })).toBeEnabled()
    })
    expect(calls).toBe(1)
  })

  // Proves a preview that fails is explained and can be run again.
  it('explains a failed preview and checks again on request', async () => {
    const real = createTestServices(platform()).programmes
    let attempts = 0
    const { user } = renderImport({
      overrides: {
        programmes: {
          ...real,
          importTimetable: (payload, options) => {
            attempts += 1
            return attempts === 1
              ? Promise.reject(new AppError('network', 'down'))
              : real.importTimetable(payload, options)
          },
        },
      },
    })
    await screen.findByLabelText('Timetable PDF')
    await reachReview(user)

    await user.click(await screen.findByRole('button', { name: 'Check again' }))

    expect(await screen.findByText(/This will create 1 programme/)).toBeInTheDocument()
  })

  // Proves the done screen offers to import another timetable.
  it('starts again after an import', async () => {
    const { user } = renderImport()
    await screen.findByLabelText('Timetable PDF')
    await reachReview(user)
    await screen.findByText(/This will create/)
    await user.click(screen.getByRole('button', { name: 'Import timetable' }))
    await screen.findByRole('heading', { level: 2, name: 'Timetable imported' })

    await user.click(screen.getByRole('button', { name: 'Import another' }))

    expect(await screen.findByRole('button', { name: 'Read timetable' })).toBeInTheDocument()
  })
})
