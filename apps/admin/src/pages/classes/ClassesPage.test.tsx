/**
 * Tests for the Classes list (admin REQUIREMENTS section 13): the table, search, filters and the
 * archived view in the address, pages, empty and error states, creating, editing and archiving.
 */

// Queries and waiting.
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The shared error type.
import { AppError } from '@conote/core/errors'
// Accessibility check.
import { expectNoAxeViolations } from '@conote/testing/axe'

// The routes, so the page renders inside the real layout.
import { routes } from '@/app/routes'
// Local dates and times.
import { toIso } from '@/lib/classTimes'
// Dates, worded as the screens word them.
import { formatDate } from '@/lib/format'
// The records the demo services read.
import {
  classRecord,
  courseRecord,
  emptyPlatformData,
  userRecord,
  type PlatformData,
} from '@/services/platformData'
// Service types.
import type { Services } from '@/services/types'
// Session builder.
import { makeSession } from '@/test/factories'
// Render helper.
import { createTestServices, renderWithRouter } from '@/test/renderWithRouter'

/** A class on 2026-09-`day` from 09:00 to 10:30. */
function session(id: string, courseId: string, day: number, overrides = {}) {
  const date = `2026-09-${String(day).padStart(2, '0')}`
  return classRecord({
    id,
    courseId,
    startsAt: toIso(date, '09:00'),
    endsAt: toIso(date, '10:30'),
    ...overrides,
  })
}

/** The platform: the signed-in admin, Dr. Smith, three courses and four classes. */
function platform(extraClasses = 0): PlatformData {
  return emptyPlatformData({
    users: [
      userRecord({ id: 'admin-test', role: 'admin', fullName: 'Amara Okafor' }),
      userRecord({ id: 't1', role: 'teacher', fullName: 'Dr. Smith' }),
    ],
    courses: [
      courseRecord({ id: 'c1', code: 'CSC 101', title: 'Programming', teacherId: 't1' }),
      courseRecord({ id: 'c2', code: 'ENG 101', title: 'Writing' }),
      courseRecord({
        id: 'c3',
        code: 'OLD 100',
        title: 'Old course',
        archivedAt: '2026-09-01T09:00:00.000Z',
      }),
    ],
    classes: [
      session('k1', 'c1', 10, { number: 1, title: 'Variables', noteCount: 14 }),
      session('k2', 'c1', 17, { number: 2, title: 'Loops' }),
      session('k3', 'c2', 11, { number: 1, title: 'Essays' }),
      session('k4', 'c1', 24, {
        number: 3,
        title: 'Cancelled',
        archivedAt: '2026-09-20T09:00:00.000Z',
      }),
      ...Array.from({ length: extraClasses }, (_, index) =>
        session(`x${String(index)}`, 'c2', 1, {
          number: 10 + index,
          title: `Extra ${String(index)}`,
        }),
      ),
    ],
    summaries: [
      {
        id: 'sm1',
        classId: 'k1',
        status: 'published',
        inReviewSince: null,
        publishedAt: '2026-09-12T09:00:00.000Z',
      },
      {
        id: 'sm2',
        classId: 'k2',
        status: 'in_review',
        inReviewSince: '2026-09-18T09:00:00.000Z',
        publishedAt: null,
      },
    ],
    enrollments: [{ courseId: 'c1', studentId: 's1' }],
  })
}

/** Renders the Classes page at `path`, as the signed-in admin. */
function renderClasses(
  path = '/admin/classes',
  data = platform(),
  overrides: Partial<Services> = {},
) {
  return renderWithRouter({
    routes,
    path,
    session: makeSession('admin', { fullName: 'Amara Okafor' }),
    platform: data,
    overrides,
  })
}

/** The rows of the table, header first. */
async function tableRows() {
  return within(await screen.findByRole('table', { name: 'Classes' })).getAllByRole('row')
}

/** The titles in the table, in order. */
async function titles() {
  return (await tableRows()).slice(1).map((row) => within(row).getAllByRole('cell')[2]?.textContent)
}

describe('ClassesPage', () => {
  // Proves the list shows classes in use, newest first, with the spec's columns and figures.
  it('lists classes in use with their columns', async () => {
    renderClasses()

    expect(await screen.findByRole('heading', { level: 1, name: 'Classes' })).toBeInTheDocument()
    const rows = await tableRows()
    expect(
      within(rows[0]!)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Course', 'No.', 'Title', 'Date and time', 'Teacher', 'Summary', 'Notes', 'Actions'])
    expect(await titles()).toEqual(['Loops', 'Essays', 'Variables'])
    // Variables: CSC 101, number 1, Dr. Smith, published, 14 notes.
    const variables = within(rows[3]!)
    expect(variables.getByText('CSC 101')).toBeInTheDocument()
    expect(variables.getByRole('link', { name: 'Variables' })).toHaveAttribute(
      'href',
      '/admin/classes/k1',
    )
    expect(
      variables.getByText(`${formatDate(toIso('2026-09-10', '09:00'))} 09:00–10:30`),
    ).toBeInTheDocument()
    expect(variables.getByText('Dr. Smith')).toBeInTheDocument()
    expect(variables.getByText('Published')).toBeInTheDocument()
    expect(variables.getByText('14')).toBeInTheDocument()
    // A course without a teacher, and a class without a summary.
    expect(within(rows[2]!).getByText('No teacher')).toBeInTheDocument()
    expect(within(rows[2]!).getByText('No summary yet')).toBeInTheDocument()
    expect(screen.getByText('Showing 1–3 of 3')).toBeInTheDocument()
  })

  // Proves pages of 20.
  it('pages the list 20 at a time', async () => {
    const { user } = renderClasses('/admin/classes', platform(20))
    expect(await screen.findByText('Showing 1–20 of 23')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(await screen.findByText('Showing 21–23 of 23')).toBeInTheDocument()
  })

  // Proves the archived toggle changes the list and the address.
  it('shows archived classes through the toggle', async () => {
    const { user, router } = renderClasses()
    await tableRows()

    await user.click(screen.getByRole('checkbox', { name: 'Show archived classes' }))

    await waitFor(async () => {
      expect(await titles()).toEqual(['Cancelled'])
    })
    expect(router.state.location.search).toBe('?archived=true')
  })

  // Proves the archived view says so when it is empty.
  it('says when no class is archived', async () => {
    renderClasses(
      '/admin/classes?archived=true',
      emptyPlatformData({
        users: [userRecord({ id: 'admin-test', role: 'admin' })],
        courses: [courseRecord({ id: 'c1', code: 'CSC 101' })],
        classes: [session('k1', 'c1', 10)],
      }),
    )
    expect(await screen.findByText('No archived classes.')).toBeInTheDocument()
  })

  // Proves the search runs from the box and lands in the address.
  it('searches by title or course code', async () => {
    const { user, router } = renderClasses()
    await tableRows()

    await user.type(screen.getByRole('searchbox', { name: 'Search classes' }), 'essays')

    await waitFor(async () => {
      expect(await titles()).toEqual(['Essays'])
    })
    expect(router.state.location.search).toBe('?q=essays')
  })

  // Proves the course and summary filters.
  it('filters by course and summary status', async () => {
    const { user } = renderClasses()
    await tableRows()

    await user.selectOptions(screen.getByLabelText('Course'), 'ENG 101 Writing')
    await waitFor(async () => {
      expect(await titles()).toEqual(['Essays'])
    })

    await user.selectOptions(screen.getByLabelText('Course'), 'All courses')
    await user.selectOptions(screen.getByLabelText('Summary'), 'In review')
    await waitFor(async () => {
      expect(await titles()).toEqual(['Loops'])
    })

    await user.selectOptions(screen.getByLabelText('Summary'), 'No summary yet')
    await waitFor(async () => {
      expect(await titles()).toEqual(['Essays'])
    })
  })

  // Proves the date range filter, both ends included.
  it('filters by date range', async () => {
    const { user } = renderClasses()
    await tableRows()

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-09-11' } })
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-09-17' } })

    await waitFor(async () => {
      expect(await titles()).toEqual(['Loops', 'Essays'])
    })
    await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]!)
    await waitFor(async () => {
      expect(await titles()).toHaveLength(3)
    })
  })

  // Proves a filter with no results offers to clear it.
  it('offers to clear filters that match nothing', async () => {
    const { user, router } = renderClasses('/admin/classes?q=zzzz')
    expect(await screen.findByText('Nothing matches these filters.')).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]!)

    expect(await tableRows()).toHaveLength(4)
    expect(router.state.location.search).toBe('')
  })

  // Proves the empty state when no class exists.
  it('shows the empty state', async () => {
    renderClasses(
      '/admin/classes',
      emptyPlatformData({
        users: [userRecord({ id: 'admin-test', role: 'admin' })],
      }),
    )
    expect(await screen.findByText('No classes available.')).toBeInTheDocument()
  })

  // Proves a failed load shows the error with a retry.
  it('shows an error with a retry when loading fails', async () => {
    const services = createTestServices(platform())
    let fail = true
    const listClasses = services.classes.listClasses.bind(services.classes)
    const { user } = renderClasses('/admin/classes', platform(), {
      classes: {
        ...services.classes,
        listClasses: (filter) =>
          fail ? Promise.reject(new AppError('unknown', 'boom')) : listClasses(filter),
      },
    })

    expect(await screen.findByText('Unable to load classes.')).toBeInTheDocument()
    fail = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await titles()).toHaveLength(3)
  })

  // Proves the loading state shows while the first page loads.
  it('shows a loading state first', async () => {
    const services = createTestServices(platform())
    renderClasses('/admin/classes', platform(), {
      classes: { ...services.classes, listClasses: () => new Promise(() => undefined) },
    })
    expect(await screen.findByLabelText('Loading classes')).toBeInTheDocument()
  })

  // Proves a class can be created from the dialog, offering only courses in use.
  it('creates a class', async () => {
    const { user } = renderClasses()
    await tableRows()

    await user.click(screen.getByRole('button', { name: 'Create class' }))
    const dialog = await screen.findByRole('dialog', { name: 'Create a class' })
    const course = within(dialog).getByLabelText('Course')
    expect(within(course).queryByRole('option', { name: /OLD 100/ })).not.toBeInTheDocument()
    await user.selectOptions(course, 'CSC 101 Programming')
    await user.type(within(dialog).getByLabelText('Class title'), 'Recursion')
    fireEvent.change(within(dialog).getByLabelText('Date'), { target: { value: '2026-10-20' } })
    fireEvent.change(within(dialog).getByLabelText('Start time'), { target: { value: '09:00' } })
    fireEvent.change(within(dialog).getByLabelText('End time'), { target: { value: '10:30' } })
    await user.click(within(dialog).getByRole('button', { name: 'Create class' }))

    expect(await screen.findByText('Class “Recursion” created.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await titles()).toContain('Recursion')
  })

  // Proves the form's rules show next to the fields.
  it('explains invalid details', async () => {
    const { user } = renderClasses()
    await tableRows()
    await user.click(screen.getByRole('button', { name: 'Create class' }))
    const dialog = await screen.findByRole('dialog', { name: 'Create a class' })

    // Nothing filled in.
    await user.click(within(dialog).getByRole('button', { name: 'Create class' }))
    expect(await within(dialog).findByText('Choose a course.')).toBeInTheDocument()
    expect(within(dialog).getByText('Enter a title.')).toBeInTheDocument()
    expect(within(dialog).getByText('Enter a date.')).toBeInTheDocument()

    // An end before the start.
    await user.selectOptions(within(dialog).getByLabelText('Course'), 'CSC 101 Programming')
    await user.type(within(dialog).getByLabelText('Class title'), 'Backwards')
    fireEvent.change(within(dialog).getByLabelText('Date'), { target: { value: '2026-10-20' } })
    fireEvent.change(within(dialog).getByLabelText('Start time'), { target: { value: '10:00' } })
    fireEvent.change(within(dialog).getByLabelText('End time'), { target: { value: '09:00' } })
    await user.click(within(dialog).getByRole('button', { name: 'Create class' }))
    expect(
      await within(dialog).findByText('The end time must be after the start time.'),
    ).toBeInTheDocument()
  })

  // Proves editing from the row menu starts from the current values, with the course fixed.
  it('edits a class from its row menu', async () => {
    const { user } = renderClasses()
    await tableRows()

    await user.click(screen.getByRole('button', { name: 'Actions for Variables' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }))
    const dialog = await screen.findByRole('dialog', { name: /Edit Variables/ })
    expect(within(dialog).getByLabelText('Course')).toBeDisabled()
    expect(within(dialog).getByLabelText('Date')).toHaveValue('2026-09-10')
    expect(within(dialog).getByLabelText('Start time')).toHaveValue('09:00')
    await user.clear(within(dialog).getByLabelText('Class title'))
    await user.type(within(dialog).getByLabelText('Class title'), 'Variables II')
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Changes saved.')).toBeInTheDocument()
    expect(await screen.findByText('Variables II')).toBeInTheDocument()
  })

  // Proves archiving asks first, then removes the class from the list.
  it('archives after confirmation', async () => {
    const { user } = renderClasses()
    await tableRows()

    await user.click(screen.getByRole('button', { name: 'Actions for Essays' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Archive' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Archive “Essays”?' })
    expect(confirm).toHaveTextContent('notes and summary are kept')
    await user.click(within(confirm).getByRole('button', { name: 'Archive' }))

    expect(await screen.findByText('“Essays” archived.')).toBeInTheDocument()
    await waitFor(async () => {
      expect(await titles()).toEqual(['Loops', 'Variables'])
    })
  })

  // Proves archived classes offer only viewing.
  it('offers no changes on an archived class', async () => {
    const { user } = renderClasses('/admin/classes?archived=true')
    await tableRows()
    await user.click(screen.getByRole('button', { name: 'Actions for Cancelled' }))
    expect(await screen.findByRole('menuitem', { name: 'View' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Archive' })).not.toBeInTheDocument()
  })

  // Proves the page has no accessibility violations.
  it('has no accessibility violations', async () => {
    const { container } = renderClasses()
    await tableRows()
    await expectNoAxeViolations(container)
  })
})
