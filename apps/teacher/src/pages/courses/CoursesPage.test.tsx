/**
 * Tests for My courses (teacher REQUIREMENTS sections 6 and 11).
 */

// Queries and waiting.
import { screen, within } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The real route table.
import { routes } from '@/app/routes'
// The shared error type.
import { AppError } from '@conote/core/errors'
// Accessibility check.
import { expectNoAxeViolations } from '@conote/testing/axe'
// Records to build a platform from.
import {
  classRecord,
  courseRecord,
  emptyPlatformData,
  summaryRecord,
} from '@/services/platformData'
// Session factory.
import { makeSession } from '@/test/factories'
// Render helper.
import { renderWithRouter } from '@/test/renderWithRouter'

/** The signed-in teacher's ID, as makeSession builds it. */
const ME = 'teacher-test'

/** Renders My courses over `platform`, signed in as the test teacher. */
function renderCourses(platform = emptyPlatformData()) {
  return renderWithRouter({
    routes,
    path: '/teacher/courses',
    session: makeSession('teacher'),
    platform,
  })
}

describe('CoursesPage', () => {
  // Proves a card shows the course, its status, its class count and the reviews waiting.
  it('shows each course with its counts', async () => {
    renderCourses(
      emptyPlatformData({
        courses: [
          courseRecord({ id: 'mth-202', code: 'MTH 202', title: 'Linear Algebra', teacherId: ME }),
        ],
        classes: [
          classRecord({ id: 'k1', courseId: 'mth-202', number: 1 }),
          classRecord({ id: 'k2', courseId: 'mth-202', number: 2 }),
        ],
        summaries: [
          summaryRecord({ id: 's1', classId: 'k1', status: 'in_review' }),
          summaryRecord({ id: 's2', classId: 'k2', status: 'published' }),
        ],
      }),
    )

    // Assert: the page, then the card's heading and facts.
    expect(await screen.findByRole('heading', { level: 1, name: 'My courses' })).toBeInTheDocument()
    const card = (await screen.findByRole('heading', { name: 'Linear Algebra' })).closest('li')!
    expect(within(card).getByText('MTH 202')).toBeInTheDocument()
    expect(within(card).getByText('Ongoing')).toBeInTheDocument()
    expect(within(card).getByText('2 classes')).toBeInTheDocument()
    expect(within(card).getByText('1 waiting for review')).toBeInTheDocument()
  })

  // Proves a card's title opens the course page.
  it('links each course to its page', async () => {
    renderCourses(
      emptyPlatformData({
        courses: [courseRecord({ id: 'mth-202', title: 'Linear Algebra', teacherId: ME })],
      }),
    )

    expect(await screen.findByRole('link', { name: 'Linear Algebra' })).toHaveAttribute(
      'href',
      '/teacher/courses/mth-202',
    )
  })

  // Proves a course with nothing waiting says nothing about reviews, and one class is singular.
  it('says nothing about reviews when none wait', async () => {
    renderCourses(
      emptyPlatformData({
        courses: [courseRecord({ id: 'c1', title: 'Calculus', teacherId: ME })],
        classes: [classRecord({ id: 'k1', courseId: 'c1' })],
      }),
    )

    const card = (await screen.findByRole('heading', { name: 'Calculus' })).closest('li')!
    expect(within(card).getByText('1 class')).toBeInTheDocument()
    expect(within(card).queryByText(/waiting for review/)).not.toBeInTheDocument()
  })

  // SECURITY: proves another teacher's course never reaches the screen.
  it('shows only the signed-in teacher’s courses', async () => {
    renderCourses(
      emptyPlatformData({
        courses: [
          courseRecord({ id: 'mine', title: 'Mine', teacherId: ME }),
          courseRecord({ id: 'theirs', title: 'Theirs', teacherId: 'someone-else' }),
        ],
      }),
    )

    expect(await screen.findByRole('heading', { name: 'Mine' })).toBeInTheDocument()
    expect(screen.queryByText('Theirs')).not.toBeInTheDocument()
  })

  // Proves the loading state is announced before the data arrives.
  it('shows a loading state first', async () => {
    renderCourses()
    expect(await screen.findByRole('status', { name: 'Loading your courses' })).toBeInTheDocument()
  })

  // Proves a teacher with no courses is told why and who assigns them.
  it('shows an empty state when no course is assigned', async () => {
    renderCourses()
    expect(await screen.findByText("You aren't teaching any courses yet.")).toBeInTheDocument()
    expect(screen.getByText('An administrator assigns courses.')).toBeInTheDocument()
  })

  // Proves a failed load shows a fixed message and Retry, which loads again.
  it('shows an error with a working Retry', async () => {
    // Arrange: the first call fails, the second succeeds.
    let calls = 0
    const { user } = renderWithRouter({
      routes,
      path: '/teacher/courses',
      session: makeSession('teacher'),
      overrides: {
        teaching: {
          getMyCourse: () => Promise.reject(new AppError('not_found', 'x')),
          listMyCourses: () => {
            calls += 1
            return calls === 1
              ? Promise.reject(new AppError('network', 'down'))
              : Promise.resolve([
                  {
                    id: 'c1',
                    code: 'C 1',
                    title: 'Back again',
                    status: 'ongoing',
                    classCount: 0,
                    waitingForReviewCount: 0,
                  },
                ])
          },
        },
      },
    })

    // Assert: the fixed message, never the raw error.
    expect(await screen.findByText('Unable to load your courses.')).toBeInTheDocument()
    expect(screen.queryByText('down')).not.toBeInTheDocument()
    // Act: retry.
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    // Assert: the data arrives.
    expect(await screen.findByRole('heading', { name: 'Back again' })).toBeInTheDocument()
  })

  // Proves the page has no accessibility violations.
  it('has no accessibility violations', async () => {
    const { container } = renderCourses(
      emptyPlatformData({
        courses: [courseRecord({ id: 'c1', title: 'Calculus', teacherId: ME })],
      }),
    )
    await screen.findByRole('heading', { name: 'Calculus' })
    await expectNoAxeViolations(container)
  })
})
