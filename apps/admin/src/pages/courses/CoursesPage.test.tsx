/**
 * Tests for the Courses list (admin REQUIREMENTS section 12): the table, search, filters and the
 * archived view in the address, pages, empty and error states, creating, and row actions.
 */

// Queries and waiting.
import { screen, waitFor, within } from '@testing-library/react'
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
  userRecord,
  type PlatformData,
} from '@/services/platformData'
// Service types.
import type { Services } from '@/services/types'
// Session builder.
import { makeSession } from '@/test/factories'
// Render helper.
import { createTestServices, renderWithRouter } from '@/test/renderWithRouter'

/** The platform: the signed-in admin, two active teachers and one inactive, four courses. */
function platform(extraCourses = 0): PlatformData {
  return emptyPlatformData({
    users: [
      userRecord({ id: 'admin-test', role: 'admin', fullName: 'Amara Okafor' }),
      userRecord({ id: 't1', role: 'teacher', fullName: 'Dr. Smith', department: 'Computing' }),
      userRecord({ id: 't2', role: 'teacher', fullName: 'Mrs. Okoro', department: 'English' }),
      userRecord({ id: 't3', role: 'teacher', fullName: 'Mr. Away', status: 'inactive' }),
    ],
    courses: [
      courseRecord({
        id: 'c1',
        code: 'CSC 101',
        title: 'Programming',
        department: 'Computing',
        teacherId: 't1',
      }),
      courseRecord({
        id: 'c2',
        code: 'ENG 101',
        title: 'Writing',
        department: 'English',
        teacherId: 't2',
        status: 'completed',
      }),
      courseRecord({
        id: 'c4',
        code: 'SWE 311',
        title: 'Software Engineering',
        department: 'Computing',
        status: 'upcoming',
      }),
      courseRecord({
        id: 'c3',
        code: 'OLD 100',
        title: 'Old course',
        teacherId: 't1',
        archivedAt: '2026-09-01T09:00:00.000Z',
      }),
      ...Array.from({ length: extraCourses }, (_, index) =>
        courseRecord({
          id: `z${String(index)}`,
          code: `ZZZ ${String(100 + index)}`,
          title: 'Extra',
        }),
      ),
    ],
    enrollments: [
      { courseId: 'c1', studentId: 's1' },
      { courseId: 'c1', studentId: 's2' },
    ],
    classes: [
      {
        id: 'cl1',
        courseId: 'c1',
        title: 'Intro',
        startsAt: '2026-09-10T09:00:00.000Z',
        archivedAt: null,
      },
    ],
  })
}

/** Renders the Courses page at `path`, as the signed-in admin. */
function renderCourses(
  path = '/admin/courses',
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
  return within(await screen.findByRole('table', { name: 'Courses' })).getAllByRole('row')
}

/** The codes in the table, in order. */
async function codes() {
  return (await tableRows()).slice(1).map((row) => within(row).getAllByRole('cell')[0]?.textContent)
}

describe('CoursesPage', () => {
  // Proves the list shows courses in use with the spec's columns and figures.
  it('lists courses in use with their columns', async () => {
    renderCourses()

    expect(await screen.findByRole('heading', { level: 1, name: 'Courses' })).toBeInTheDocument()
    const rows = await tableRows()
    expect(
      within(rows[0]!)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Code', 'Title', 'Teacher', 'Students', 'Classes', 'Status', 'Actions'])
    expect(await codes()).toEqual(['CSC 101', 'ENG 101', 'SWE 311'])
    // CSC 101: Dr. Smith, 2 students, 1 class.
    const csc = within(rows[1]!)
    expect(csc.getByRole('link', { name: 'CSC 101' })).toHaveAttribute('href', '/admin/courses/c1')
    expect(csc.getByText('Dr. Smith')).toBeInTheDocument()
    expect(csc.getByText('Ongoing')).toBeInTheDocument()
    // A course without a teacher says so.
    expect(within(rows[3]!).getByText('No teacher')).toBeInTheDocument()
    expect(screen.getByText('Showing 1–3 of 3')).toBeInTheDocument()
  })

  // Proves pages of 20.
  it('pages the list 20 at a time', async () => {
    const { user } = renderCourses('/admin/courses', platform(20))
    expect(await screen.findByText('Showing 1–20 of 23')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(await screen.findByText('Showing 21–23 of 23')).toBeInTheDocument()
  })

  // Proves the archived toggle changes the list and the address.
  it('shows archived courses through the toggle', async () => {
    const { user, router } = renderCourses()
    await tableRows()

    await user.click(screen.getByRole('checkbox', { name: 'Show archived courses' }))

    await waitFor(async () => {
      expect(await codes()).toEqual(['OLD 100'])
    })
    expect(router.state.location.search).toBe('?archived=true')
    expect(screen.getByText('Archived')).toBeInTheDocument()
  })

  // Proves the archived view says so when it is empty, instead of "no courses created".
  it('says when no course is archived', async () => {
    renderCourses(
      '/admin/courses?archived=true',
      emptyPlatformData({
        users: [userRecord({ id: 'admin-test', role: 'admin' })],
        courses: [courseRecord({ id: 'c1', code: 'CSC 101' })],
      }),
    )
    expect(await screen.findByText('No archived courses.')).toBeInTheDocument()
  })

  // Proves the search runs from the box and lands in the address.
  it('searches by code or title', async () => {
    const { user, router } = renderCourses()
    await tableRows()

    await user.type(screen.getByRole('searchbox', { name: 'Search courses' }), 'writing')

    await waitFor(async () => {
      expect(await codes()).toEqual(['ENG 101'])
    })
    expect(router.state.location.search).toBe('?q=writing')
  })

  // Proves the status, department and teacher filters.
  it('filters by status, department and teacher', async () => {
    const { user } = renderCourses()
    await tableRows()

    await user.selectOptions(screen.getByLabelText('Status'), 'Completed')
    await waitFor(async () => {
      expect(await codes()).toEqual(['ENG 101'])
    })

    await user.selectOptions(screen.getByLabelText('Status'), 'All statuses')
    await user.selectOptions(screen.getByLabelText('Department'), 'Computing')
    await waitFor(async () => {
      expect(await codes()).toEqual(['CSC 101', 'SWE 311'])
    })

    // Only active teachers are offered, plus "No teacher".
    const teacher = screen.getByLabelText('Teacher')
    expect(within(teacher).queryByRole('option', { name: 'Mr. Away' })).not.toBeInTheDocument()
    await user.selectOptions(teacher, 'No teacher')
    await waitFor(async () => {
      expect(await codes()).toEqual(['SWE 311'])
    })
  })

  // Proves the dashboard's link works: courses without a teacher.
  it('opens already filtered to courses without a teacher', async () => {
    renderCourses('/admin/courses?teacher=none')
    await waitFor(async () => {
      expect(await codes()).toEqual(['SWE 311'])
    })
    expect(screen.getByLabelText('Teacher')).toHaveValue('none')
  })

  // Proves a filter with no results offers to clear it.
  it('offers to clear filters that match nothing', async () => {
    const { user, router } = renderCourses('/admin/courses?q=zzzz')
    expect(await screen.findByText('Nothing matches these filters.')).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]!)

    expect(await tableRows()).toHaveLength(4)
    expect(router.state.location.search).toBe('')
  })

  // Proves the empty state when no course exists, with a way to create one.
  it('shows the empty state', async () => {
    renderCourses(
      '/admin/courses',
      emptyPlatformData({
        users: [userRecord({ id: 'admin-test', role: 'admin' })],
      }),
    )
    expect(await screen.findByText('No courses have been created yet.')).toBeInTheDocument()
  })

  // Proves a failed load shows the error with a retry.
  it('shows an error with a retry when loading fails', async () => {
    const services = createTestServices(platform())
    let fail = true
    const listCourses = services.courses.listCourses.bind(services.courses)
    const { user } = renderCourses('/admin/courses', platform(), {
      courses: {
        ...services.courses,
        listCourses: (filter) => {
          if (fail) return Promise.reject(new AppError('unknown', 'boom'))
          return listCourses(filter)
        },
      },
    })

    expect(await screen.findByText('Unable to load courses.')).toBeInTheDocument()
    fail = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await codes()).toHaveLength(3)
  })

  // Proves the loading state shows while the first page loads.
  it('shows a loading state first', async () => {
    const services = createTestServices(platform())
    renderCourses('/admin/courses', platform(), {
      courses: { ...services.courses, listCourses: () => new Promise(() => undefined) },
    })
    expect(await screen.findByLabelText('Loading courses')).toBeInTheDocument()
  })

  // Proves a course can be created from the dialog, and appears in the list.
  it('creates a course', async () => {
    const { user } = renderCourses()
    await tableRows()

    await user.click(screen.getByRole('button', { name: 'Create course' }))
    const dialog = await screen.findByRole('dialog', { name: 'Create a course' })
    await user.type(within(dialog).getByLabelText('Course code'), 'mth201')
    await user.type(within(dialog).getByLabelText('Title'), 'Calculus')
    await user.selectOptions(within(dialog).getByLabelText('Teacher'), 'Mrs. Okoro')
    await user.click(within(dialog).getByRole('button', { name: 'Create course' }))

    expect(await screen.findByText('Course MTH 201 created.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await codes()).toContain('MTH 201')
  })

  // Proves the form's rules show next to the fields, and a taken code is explained.
  it('explains invalid and duplicate codes', async () => {
    const { user } = renderCourses()
    await tableRows()
    await user.click(screen.getByRole('button', { name: 'Create course' }))
    const dialog = await screen.findByRole('dialog', { name: 'Create a course' })

    // Nothing filled in.
    await user.click(within(dialog).getByRole('button', { name: 'Create course' }))
    expect(await within(dialog).findByText('Enter a code like SWE 311.')).toBeInTheDocument()
    expect(within(dialog).getByText('Enter a title.')).toBeInTheDocument()

    // A code that is taken, in another letter case.
    await user.type(within(dialog).getByLabelText('Course code'), 'csc101')
    await user.type(within(dialog).getByLabelText('Title'), 'Again')
    await user.click(within(dialog).getByRole('button', { name: 'Create course' }))
    expect(
      await within(dialog).findByText('A course with this code already exists.'),
    ).toBeInTheDocument()
  })

  // Proves editing from the row menu starts from the current values.
  it('edits a course from its row menu', async () => {
    const { user } = renderCourses()
    await tableRows()

    await user.click(screen.getByRole('button', { name: 'Actions for CSC 101' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }))
    const dialog = await screen.findByRole('dialog', { name: /Edit CSC 101/ })
    expect(within(dialog).getByLabelText('Title')).toHaveValue('Programming')
    await user.clear(within(dialog).getByLabelText('Title'))
    await user.type(within(dialog).getByLabelText('Title'), 'Programming II')
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Changes saved.')).toBeInTheDocument()
    expect(await screen.findByText('Programming II')).toBeInTheDocument()
  })

  // Proves archiving asks first, then removes the course from the list; restoring brings it back.
  it('archives after confirmation and restores from the archived view', async () => {
    const { user } = renderCourses()
    await tableRows()

    await user.click(screen.getByRole('button', { name: 'Actions for ENG 101' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Archive' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Archive ENG 101?' })
    await user.click(within(confirm).getByRole('button', { name: 'Archive' }))

    expect(await screen.findByText('ENG 101 archived.')).toBeInTheDocument()
    await waitFor(async () => {
      expect(await codes()).toEqual(['CSC 101', 'SWE 311'])
    })

    // The archived view offers Restore, with no Edit.
    await user.click(screen.getByRole('checkbox', { name: 'Show archived courses' }))
    await waitFor(async () => {
      expect(await codes()).toEqual(['ENG 101', 'OLD 100'])
    })
    await user.click(screen.getByRole('button', { name: 'Actions for ENG 101' }))
    expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('menuitem', { name: 'Restore' }))
    expect(await screen.findByText('ENG 101 restored.')).toBeInTheDocument()
  })

  // Proves the page has no accessibility violations.
  it('has no accessibility violations', async () => {
    const { container } = renderCourses()
    await tableRows()
    await expectNoAxeViolations(container)
  })
})
