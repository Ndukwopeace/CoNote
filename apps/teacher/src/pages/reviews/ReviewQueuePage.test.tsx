/**
 * Tests for the review queue (teacher REQUIREMENTS section 8).
 */

// Queries and waiting.
import { screen, within } from '@testing-library/react'
// Vitest building blocks.
import { afterEach, describe, expect, it, vi } from 'vitest'

// The real route table.
import { routes } from '@/app/routes'
// The shared error type.
import { AppError } from '@conote/core/errors'
// Accessibility check.
import { expectNoAxeViolations } from '@conote/testing/axe'
// Records to build a platform from.
import { classRecord, summaryRecord } from '@/services/platformData'
// Session factory and the shared test platform.
import { makeSession } from '@/test/factories'
import { reviewPlatform } from '@/test/reviewPlatform'
// Render helper.
import { renderWithRouter } from '@/test/renderWithRouter'

/** Renders the queue over `platform`, signed in as the test teacher. */
function renderQueue(platform = reviewPlatform()) {
  return renderWithRouter({
    routes,
    path: '/teacher/reviews',
    session: makeSession('teacher'),
    platform,
  })
}

describe('ReviewQueuePage', () => {
  // Restore the real clock after each test.
  afterEach(() => {
    vi.useRealTimers()
  })

  // Proves the longest wait is first, with how long and how many notes, and a link to review.
  it('lists waiting summaries, longest wait first', async () => {
    // Arrange: a fixed clock, and a second summary that has waited less.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-12T10:00:00.000Z'))
    const platform = reviewPlatform('in_review')
    platform.classes.push(
      classRecord({ id: 'k5', courseId: 'mth-202', number: 5, title: 'Linear maps' }),
    )
    platform.summaries.push(
      summaryRecord({
        id: 's2',
        classId: 'k5',
        status: 'in_review',
        inReviewSince: '2026-10-11T12:00:00.000Z',
        notesAnalyzedCount: 9,
      }),
    )
    renderQueue(platform)

    // Assert: oldest first.
    await screen.findByRole('link', { name: 'Review MTH 202 class 4' })
    const rows = within(screen.getByRole('main')).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('MTH 202 · Class 4: Basis and dimension')
    expect(rows[0]).toHaveTextContent('Waiting 4 days')
    expect(rows[0]).toHaveTextContent('18 notes')
    expect(rows[1]).toHaveTextContent('Class 5: Linear maps')
    expect(rows[1]).toHaveTextContent('Waiting less than a day')
    expect(within(rows[0]!).getByRole('link', { name: 'Review MTH 202 class 4' })).toHaveAttribute(
      'href',
      '/teacher/reviews/s1',
    )
  })

  // Proves a published summary is not in the queue, and the empty state says so.
  it('shows an empty state when nothing waits', async () => {
    renderQueue(reviewPlatform('published'))
    expect(await screen.findByText('Nothing is waiting for your review.')).toBeInTheDocument()
  })

  // Proves the loading state is announced before the data arrives.
  it('shows a loading state first', async () => {
    renderQueue()
    expect(
      await screen.findByRole('status', { name: 'Loading the review queue' }),
    ).toBeInTheDocument()
  })

  // Proves a failed load shows a fixed message and Retry, never the raw error.
  it('shows an error with Retry', async () => {
    renderWithRouter({
      routes,
      path: '/teacher/reviews',
      session: makeSession('teacher'),
      overrides: {
        review: {
          listReviewQueue: () => Promise.reject(new AppError('network', 'down')),
          getDraft: () => Promise.reject(new AppError('not_found', 'x')),
          saveDraft: () => Promise.reject(new AppError('not_found', 'x')),
          approveAndPublish: () => Promise.reject(new AppError('not_found', 'x')),
        },
      },
    })

    expect(await screen.findByText('Unable to load the review queue.')).toBeInTheDocument()
    expect(screen.queryByText('down')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  // Proves the sidebar leads here, and marks it as the current page.
  it('is in the sidebar', async () => {
    renderQueue()
    const nav = await screen.findByRole('navigation', { name: 'Teacher navigation' })
    expect(within(nav).getByRole('link', { name: 'Review queue' })).toHaveAttribute(
      'href',
      '/teacher/reviews',
    )
  })

  // Proves the page has no accessibility violations.
  it('has no accessibility violations', async () => {
    const { container } = renderQueue()
    await screen.findByRole('heading', { level: 1, name: 'Review queue' })
    await screen.findByRole('link', { name: 'Review MTH 202 class 4' })
    await expectNoAxeViolations(container)
  })
})
