/**
 * Tests for the Notes page (D123): an administrator searches students' notes by course, class and
 * student, and the choices are kept in the address.
 */

// Queries and waiting.
import { screen, waitFor, within } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// Accessibility check.
import { expectNoAxeViolations } from '@conote/testing/axe'

// The routes, so the page renders inside the real layout.
import { routes } from '@/app/routes'
// The records the demo services read.
import {
  classRecord,
  courseRecord,
  emptyPlatformData,
  userRecord,
  type PlatformData,
} from '@/services/platformData'
// Session builder.
import { makeSession } from '@/test/factories'
// Render helper.
import { renderWithRouter } from '@/test/renderWithRouter'

/** Two courses, a class in each, two students, and notes from both in the first course. */
function platform(): PlatformData {
  return emptyPlatformData({
    users: [
      userRecord({ id: 'admin-test', role: 'admin', fullName: 'Amara Okafor' }),
      userRecord({
        id: 's1',
        role: 'student',
        fullName: 'Ada Okafor',
        studentNumber: 'U2026/0001',
      }),
      userRecord({
        id: 's2',
        role: 'student',
        fullName: 'Bo Learner',
        studentNumber: 'U2026/0002',
      }),
      userRecord({ id: 's3', role: 'student', fullName: 'Cy Quiet', studentNumber: 'U2026/0003' }),
    ],
    courses: [
      courseRecord({ id: 'c1', code: 'CSC 101', title: 'Programming' }),
      courseRecord({ id: 'c2', code: 'PHY 101', title: 'Physics' }),
    ],
    enrollments: [
      { courseId: 'c1', studentId: 's1' },
      { courseId: 'c1', studentId: 's2' },
      { courseId: 'c1', studentId: 's3' },
    ],
    classes: [
      classRecord({ id: 'k1', courseId: 'c1', number: 1, title: 'Loops', noteCount: 3 }),
      classRecord({ id: 'k2', courseId: 'c2', number: 1, title: 'Motion', noteCount: 1 }),
    ],
    notes: [
      {
        id: 'n1',
        classId: 'k1',
        studentId: 's1',
        title: 'Loops',
        contentHtml: '<p>for and while</p>',
        createdAt: '2026-10-01T09:20:00.000Z',
      },
      {
        id: 'n2',
        classId: 'k1',
        studentId: 's1',
        title: null,
        contentHtml: '<p>Break out early</p>',
        createdAt: '2026-10-01T09:30:00.000Z',
      },
      {
        id: 'n3',
        classId: 'k1',
        studentId: 's2',
        title: null,
        contentHtml: '<p>Nested loops</p>',
        createdAt: '2026-10-01T09:40:00.000Z',
      },
      {
        id: 'n4',
        classId: 'k2',
        studentId: 's1',
        title: null,
        contentHtml: '<p>Velocity is a vector</p>',
        createdAt: '2026-10-02T09:20:00.000Z',
      },
    ],
  })
}

/** Renders the page at `path`, signed in as the test administrator. */
function renderNotes(path = '/admin/notes') {
  return renderWithRouter({ routes, path, session: makeSession('admin'), platform: platform() })
}

describe('NotesPage', () => {
  // Proves the page lists notes across every course at first, naming where each belongs.
  it('lists the newest notes of every course, with their classes', async () => {
    renderNotes()

    expect(await screen.findByText('Velocity is a vector')).toBeVisible()
    expect(screen.getByText('PHY 101 · Class 1: Motion')).toBeVisible()
    expect(screen.getAllByText('CSC 101 · Class 1: Loops').length).toBeGreaterThan(0)
  })

  // Proves choosing a course narrows the notes, and unlocks the class choice.
  it('narrows by course, then by class, and keeps both in the address', async () => {
    const { user, router } = renderNotes()
    await screen.findByText('Velocity is a vector')
    expect(screen.getByLabelText('Class')).toBeDisabled()

    await user.selectOptions(screen.getByLabelText('Course'), 'c1')

    await waitFor(() => {
      expect(screen.queryByText('Velocity is a vector')).not.toBeInTheDocument()
    })
    expect(router.state.location.search).toBe('?courseId=c1')
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Class' }), 'k1')

    expect(await screen.findByText('3 notes from 2 of 3 students')).toBeVisible()
    expect(router.state.location.search).toBe('?courseId=c1&classId=k1')
    expect(screen.getByText('Not written yet (1)')).toBeVisible()
  })

  // Proves a class chosen in the address (the link from a class's page) is already applied.
  it('opens already narrowed when the address names a class', async () => {
    renderNotes('/admin/notes?courseId=c1&classId=k1')

    expect(await screen.findByText('3 notes from 2 of 3 students')).toBeVisible()
    expect(screen.getByLabelText('Course')).toHaveValue('c1')
  })

  // Proves the search by student finds notes by part of the name or the student number.
  it('searches by student', async () => {
    const { user } = renderNotes('/admin/notes?courseId=c1&classId=k1')
    await screen.findByText('3 notes from 2 of 3 students')

    await user.type(screen.getByRole('searchbox', { name: 'Search by student' }), 'bo')
    await user.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => {
      expect(screen.queryByText('for and while')).not.toBeInTheDocument()
    })
    const list = within(screen.getByRole('main')).getAllByRole('listitem')
    expect(list.some((item) => item.textContent.includes('Nested loops'))).toBe(true)
  })

  // Proves the page tells the administrator that reading notes is recorded.
  it('says that opening notes is recorded', async () => {
    renderNotes()

    expect(await screen.findByText(/recorded in the audit log/)).toBeVisible()
  })

  // Proves the page passes the accessibility check.
  it('has no accessibility violations', async () => {
    const { container } = renderNotes()
    await screen.findByText('Velocity is a vector')

    await expectNoAxeViolations(container)
  })
})
