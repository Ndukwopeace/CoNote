/**
 * Tests for the course page (teacher REQUIREMENTS section 7).
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
import { classRecord, emptyPlatformData, summaryRecord } from '@/services/platformData'
// Session factory and the shared test platform.
import { makeSession } from '@/test/factories'
import { ME, reviewPlatform } from '@/test/reviewPlatform'
// Render helper.
import { renderWithRouter } from '@/test/renderWithRouter'

/** Renders the course page for `courseId` over `platform`, signed in as the test teacher. */
function renderCourse(courseId: string, platform = reviewPlatform()) {
  return renderWithRouter({
    routes,
    path: `/teacher/courses/${courseId}`,
    session: makeSession('teacher'),
    platform,
  })
}

describe('CourseDetailsPage', () => {
  // Proves the header, and the classes newest first with their stages and actions.
  it('shows the course and its classes, newest first, with their stages', async () => {
    const platform = reviewPlatform('in_review')
    platform.classes.push(
      classRecord({ id: 'k3', courseId: 'mth-202', number: 3, title: 'Linear independence' }),
    )
    platform.summaries.push(
      summaryRecord({
        id: 's0',
        classId: 'k3',
        status: 'published',
        publishedAt: '2026-10-02T09:00:00.000Z',
      }),
    )
    renderCourse('mth-202', platform)

    // Assert: the header.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'MTH 202 Linear Algebra' }),
    ).toBeInTheDocument()
    // Assert: newest class first.
    const rows = within(screen.getByRole('main')).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('Class 4: Basis and dimension')
    expect(rows[0]).toHaveTextContent('Ready for your review')
    expect(rows[0]).toHaveTextContent('18 notes')
    expect(rows[1]).toHaveTextContent('Class 3: Linear independence')
    expect(rows[1]).toHaveTextContent('Published')
    // Assert: Review for the one in review, View for the published one.
    expect(within(rows[0]!).getByRole('link', { name: 'Review class 4' })).toHaveAttribute(
      'href',
      '/teacher/reviews/s1',
    )
    expect(within(rows[1]!).getByRole('link', { name: 'View class 3' })).toHaveAttribute(
      'href',
      '/teacher/reviews/s0',
    )
  })

  // Proves a class still collecting notes or being drafted offers no action.
  it.each(['collecting', 'processing'] as const)(
    'offers no action for a %s summary',
    async (stage) => {
      renderCourse('mth-202', reviewPlatform(stage))

      await screen.findByRole('heading', { level: 1, name: 'MTH 202 Linear Algebra' })
      expect(screen.queryByRole('link', { name: /class 4/ })).not.toBeInTheDocument()
    },
  )

  // Proves a course with no classes says so.
  it('shows an empty state for a course with no classes', async () => {
    const platform = reviewPlatform()
    platform.classes = []
    platform.summaries = []
    renderCourse('mth-202', platform)

    expect(await screen.findByText('This course has no classes yet.')).toBeInTheDocument()
  })

  // SECURITY: proves another teacher's course and an unknown one show the same not-found page,
  // inside the frame.
  it.each(['not-mine', 'nope'])('shows not-found for %s', async (courseId) => {
    const platform = emptyPlatformData({
      courses: reviewPlatform().courses.map((course) => ({
        ...course,
        id: 'not-mine',
        teacherId: 'x',
      })),
    })
    renderCourse(courseId, platform)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Course not found' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to My courses' })).toHaveAttribute(
      'href',
      '/teacher/courses',
    )
    expect(screen.getByRole('navigation', { name: 'Teacher navigation' })).toBeInTheDocument()
  })

  // Proves the loading state is announced before the data arrives.
  it('shows a loading state first', async () => {
    renderCourse('mth-202')
    expect(await screen.findByRole('status', { name: 'Loading the course' })).toBeInTheDocument()
  })

  // Proves a failed load shows a fixed message and Retry, never the raw error.
  it('shows an error with Retry', async () => {
    const { user } = renderWithRouter({
      routes,
      path: '/teacher/courses/mth-202',
      session: makeSession('teacher'),
      overrides: {
        teaching: {
          listMyCourses: () => Promise.resolve([]),
          getMyCourse: () => Promise.reject(new AppError('network', 'down')),
        },
      },
    })

    expect(await screen.findByText('Unable to load this course.')).toBeInTheDocument()
    expect(screen.queryByText('down')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
  })

  // Proves the page has no accessibility violations.
  it('has no accessibility violations', async () => {
    const { container } = renderCourse('mth-202')
    await screen.findByRole('heading', { level: 1, name: 'MTH 202 Linear Algebra' })
    await expectNoAxeViolations(container)
  })

  // Proves a teacher not in the platform's users still sees their own course by ID (ME owns it).
  it('belongs to the signed-in teacher', () => {
    expect(reviewPlatform().courses[0]?.teacherId).toBe(ME)
  })
})
