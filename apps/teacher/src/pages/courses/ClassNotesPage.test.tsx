/**
 * Tests for the class notes page (D123): the counts, who has not written, and the notes with their
 * authors, for a class of the signed-in teacher; and "not found" for any other.
 */

// Queries and waiting.
import { screen, within } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The real route table.
import { routes } from '@/app/routes'
// Accessibility check.
import { expectNoAxeViolations } from '@conote/testing/axe'
// Records to build a platform from.
import { userRecord, type PlatformData } from '@/services/platformData'
// Session factory and the shared test platform.
import { makeSession } from '@/test/factories'
import { reviewPlatform } from '@/test/reviewPlatform'
// Render helper.
import { renderWithRouter } from '@/test/renderWithRouter'

/** The review platform plus two enrolled students, one of whom wrote two notes. */
function platformWithNotes(): PlatformData {
  const platform = reviewPlatform()
  platform.users.push(
    userRecord({ id: 'stu-ada', role: 'student', fullName: 'Ada Okafor' }),
    userRecord({ id: 'stu-bo', role: 'student', fullName: 'Bo Quiet' }),
  )
  platform.enrollments.push(
    { courseId: 'mth-202', studentId: 'stu-ada' },
    { courseId: 'mth-202', studentId: 'stu-bo' },
  )
  platform.notes.push(
    {
      id: 'n1',
      classId: 'k4',
      studentId: 'stu-ada',
      title: 'Basis',
      contentHtml: '<p>A basis spans <b>and</b> is independent.</p>',
      createdAt: '2026-10-07T09:20:00.000Z',
    },
    {
      id: 'n2',
      classId: 'k4',
      studentId: 'stu-ada',
      title: null,
      contentHtml: '<p>Dimension is the size of a basis.</p>',
      createdAt: '2026-10-07T09:40:00.000Z',
    },
  )
  return platform
}

/** Renders the page for `classId` of MTH 202, signed in as the test teacher. */
function renderNotes(classId: string, courseId = 'mth-202', platform = platformWithNotes()) {
  return renderWithRouter({
    routes,
    path: `/teacher/courses/${courseId}/classes/${classId}/notes`,
    session: makeSession('teacher'),
    platform,
  })
}

describe('ClassNotesPage', () => {
  // Proves the header, the counts, who has not written, and the notes with their authors.
  it('shows the class, the counts, who has not written, and the notes with names', async () => {
    renderNotes('k4')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Class 4: Basis and dimension' }),
    ).toBeVisible()
    expect(await screen.findByText('2 notes from 1 of 2 students')).toBeVisible()
    expect(screen.getByText('Not written yet (1)')).toBeVisible()
    const list = within(screen.getByRole('main')).getAllByRole('listitem')
    expect(
      list.some((item) => item.textContent.includes('A basis spans and is independent.')),
    ).toBe(true)
    expect(screen.getAllByText('Ada Okafor').length).toBeGreaterThan(0)
  })

  // Proves the page says plainly who can read the notes, and that reading them is recorded.
  it('says who can read the notes and that it is recorded', async () => {
    renderNotes('k4')

    expect(await screen.findByText(/each time you open them is recorded/)).toBeVisible()
  })

  // SECURITY: proves a class that is not in the teacher's course, and a course that is not theirs,
  // answer the same "not found".
  it('answers not found for an unknown class and for another course', async () => {
    renderNotes('no-such-class')
    expect(await screen.findByRole('heading', { name: 'Class not found' })).toBeVisible()
  })

  it('answers not found for a course that is not the teacher’s', async () => {
    renderNotes('k4', 'someone-elses-course')
    expect(await screen.findByRole('heading', { name: 'Class not found' })).toBeVisible()
  })

  // Proves the page passes the accessibility check.
  it('has no accessibility violations', async () => {
    const { container } = renderNotes('k4')
    await screen.findByText('2 notes from 1 of 2 students')

    await expectNoAxeViolations(container)
  })
})
