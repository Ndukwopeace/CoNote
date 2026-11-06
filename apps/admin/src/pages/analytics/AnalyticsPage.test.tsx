/**
 * Tests for the Analytics page (D124): who wrote notes, class by class, the platform's figures, the
 * period choice, the loading/empty/error states, and that no student's name appears.
 */

// Queries and waiting.
import { screen, within } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// Accessibility check.
import { expectNoAxeViolations } from '@conote/testing/axe'
// Failure type.
import { AppError } from '@conote/core/errors'

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
import type { Services } from '@/services/types'

/** An ISO time `days` days before now. */
function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

/** One course with three students; two classes this week, one with notes from two students. */
function platform(): PlatformData {
  return emptyPlatformData({
    users: [
      userRecord({ id: 'admin-test', role: 'admin', fullName: 'Amara Okafor' }),
      userRecord({
        id: 's1',
        role: 'student',
        fullName: 'Ada Secretname',
        lastActiveAt: daysAgo(1),
      }),
      userRecord({ id: 's2', role: 'student', fullName: 'Bo Hiddenname' }),
      userRecord({ id: 's3', role: 'student', fullName: 'Cy Privatename' }),
    ],
    courses: [courseRecord({ id: 'c1', code: 'CSC 101', title: 'Programming' })],
    enrollments: [
      { courseId: 'c1', studentId: 's1' },
      { courseId: 'c1', studentId: 's2' },
      { courseId: 'c1', studentId: 's3' },
    ],
    classes: [
      classRecord({ id: 'k1', courseId: 'c1', number: 1, title: 'Loops', startsAt: daysAgo(3) }),
      classRecord({ id: 'k2', courseId: 'c1', number: 2, title: 'Arrays', startsAt: daysAgo(1) }),
    ],
    notes: [
      {
        id: 'n1',
        classId: 'k1',
        studentId: 's1',
        title: null,
        contentHtml: '<p>secret text</p>',
        createdAt: daysAgo(2),
      },
      {
        id: 'n2',
        classId: 'k1',
        studentId: 's1',
        title: null,
        contentHtml: '<p>more</p>',
        createdAt: daysAgo(2),
      },
      {
        id: 'n3',
        classId: 'k1',
        studentId: 's2',
        title: null,
        contentHtml: '<p>more</p>',
        createdAt: daysAgo(2),
      },
    ],
  })
}

/** Renders the page at `path`, signed in as the test administrator. */
function renderAnalytics(
  path = '/admin/analytics',
  data = platform(),
  overrides?: Partial<Services>,
) {
  return renderWithRouter({
    routes,
    path,
    session: makeSession('admin'),
    platform: data,
    ...(overrides ? { overrides } : {}),
  })
}

/** A service call that fails with an internal-looking error. */
const fail = () => Promise.reject(new AppError('unknown', 'relation "notes" does not exist'))

describe('AnalyticsPage', () => {
  // Proves the headline: how many students wrote, out of how many were expected, and the share.
  it('says how many students sent notes', async () => {
    renderAnalytics()

    expect(await screen.findByText('Students who sent notes')).toBeVisible()
    expect(screen.getByText('of 3 enrolled in a course with a class')).toBeVisible()
    expect(screen.getByText('Share of students who wrote').parentElement).toHaveTextContent('67%')
  })

  // Proves the table lists each class with its counts, the quietest first.
  it('lists the classes quietest first with their counts', async () => {
    renderAnalytics()

    const table = await screen.findByRole('table', { name: 'Notes by class, quietest first' })
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(2)
    // The class nobody wrote in comes first.
    expect(within(rows[0]!).getByText('Class 2: Arrays')).toBeVisible()
    expect(within(rows[0]!).getByText('0 of 3')).toBeVisible()
    expect(within(rows[1]!).getByText('Class 1: Loops')).toBeVisible()
    expect(within(rows[1]!).getByText('2 of 3')).toBeVisible()
  })

  // Proves each row links to the Notes search for that class, where names show.
  it('links each class to its notes', async () => {
    renderAnalytics()

    const link = await screen.findByRole('link', { name: 'Read the notes of CSC 101 class 1' })

    expect(link).toHaveAttribute('href', '/admin/notes?courseId=c1&classId=k1')
  })

  // SECURITY: proves no student's name and no note text is on the page.
  it('shows no student names and no note text', async () => {
    renderAnalytics()
    await screen.findByRole('table')

    expect(screen.queryByText(/Secretname|Hiddenname|Privatename/)).toBeNull()
    expect(screen.queryByText(/secret text/)).toBeNull()
  })

  // Proves the platform figures: users, academic activity, AI, and the unmeasured ones.
  it('shows the platform figures and says what is not measured', async () => {
    renderAnalytics()

    expect(await screen.findByRole('region', { name: 'Users' })).toBeVisible()
    expect(screen.getByRole('region', { name: 'Academic activity' })).toBeVisible()
    expect(screen.getByRole('region', { name: 'AI summaries' })).toBeVisible()
    const notMeasured = screen.getByRole('region', { name: 'Not measured yet' })
    expect(within(notMeasured).getAllByText('Not tracked yet')).toHaveLength(2)
  })

  // Proves the period is kept in the address, and an unknown value falls back to 30 days.
  it('keeps the period in the address', async () => {
    const { user, router } = renderAnalytics()
    await screen.findByRole('table')
    expect(screen.getByLabelText('Period')).toHaveValue('30')

    await user.selectOptions(screen.getByLabelText('Period'), '7')

    expect(router.state.location.search).toBe('?days=7')
  })

  it('treats an unknown period as 30 days', async () => {
    renderAnalytics('/admin/analytics?days=9999')

    expect(await screen.findByLabelText('Period')).toHaveValue('30')
  })

  // Proves a period with no classes says so.
  it('says when there are no classes in the period', async () => {
    renderAnalytics('/admin/analytics', emptyPlatformData({ users: platform().users }))

    expect(await screen.findByText('No classes in this period.')).toBeVisible()
  })

  // Proves each part has its own error state and never shows the raw error.
  it('shows an error for each part that fails', async () => {
    renderAnalytics('/admin/analytics', platform(), {
      analytics: {
        getOverview: fail,
        getActivitySeries: fail,
        getReport: fail,
        getParticipation: fail,
      },
    })

    expect(await screen.findByText('Unable to load the class table.')).toBeVisible()
    expect(await screen.findByText('Unable to load the analytics.')).toBeVisible()
    expect(screen.queryByText(/relation/)).toBeNull()
  })

  // Proves the page passes the accessibility check.
  it('has no accessibility violations', async () => {
    const { container } = renderAnalytics()
    await screen.findByRole('table')
    await screen.findByRole('region', { name: 'Users' })

    await expectNoAxeViolations(container)
  })
})
