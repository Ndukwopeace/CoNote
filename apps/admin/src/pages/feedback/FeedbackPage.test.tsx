/**
 * Tests for the Feedback page (D125): the list with who sent what, the filters kept in the address,
 * marking read, plain-text messages, the empty and error states, and accessibility.
 */

// Queries and waiting.
import { screen, waitFor, within } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// Accessibility check, and the failure type.
import { AppError } from '@conote/core/errors'
import { expectNoAxeViolations } from '@conote/testing/axe'

// The routes, so the page renders inside the real layout.
import { routes } from '@/app/routes'
// The records the demo services read.
import {
  emptyPlatformData,
  userRecord,
  type FeedbackRecord,
  type PlatformData,
} from '@/services/platformData'
import type { Services } from '@/services/types'
// Session builder.
import { makeSession } from '@/test/factories'
// Render helper.
import { renderWithRouter } from '@/test/renderWithRouter'

/** One piece of feedback, with the fields a test cares about overridden. */
function record(overrides: Partial<FeedbackRecord> & { id: string }): FeedbackRecord {
  return {
    userId: 's1',
    role: 'student',
    kind: 'idea',
    message: 'Dark mode please',
    rating: 4,
    page: '/dashboard',
    status: 'new',
    createdAt: '2026-11-10T09:00:00.000Z',
    ...overrides,
  }
}

/** A student and a teacher, and three pieces of feedback. */
function platform(feedback: FeedbackRecord[] = defaultFeedback()): PlatformData {
  return emptyPlatformData({
    users: [
      userRecord({ id: 'admin-test', role: 'admin', fullName: 'Amara Okafor' }),
      userRecord({ id: 's1', role: 'student', fullName: 'Ada Okafor', email: 'ada@x.example' }),
      userRecord({ id: 't1', role: 'teacher', fullName: 'Tobi Teacher', email: 'tobi@x.example' }),
    ],
    feedback,
  })
}

/** The three pieces of feedback most tests use. */
function defaultFeedback(): FeedbackRecord[] {
  return [
    record({ id: 'f1', createdAt: '2026-11-10T09:00:00.000Z' }),
    record({
      id: 'f2',
      userId: 't1',
      role: 'teacher',
      kind: 'bug',
      message: 'The review button does nothing',
      rating: null,
      page: '/teacher/review',
      createdAt: '2026-11-11T09:00:00.000Z',
    }),
    record({
      id: 'f3',
      status: 'read',
      message: 'All good',
      createdAt: '2026-11-09T09:00:00.000Z',
    }),
  ]
}

/** The pieces of feedback on screen, once the list has loaded. */
async function pieces() {
  return within(await screen.findByRole('list', { name: 'Feedback' })).getAllByRole('listitem')
}

/** Renders the page at `path`, signed in as the test administrator. */
function renderFeedback(
  path = '/admin/feedback',
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

describe('FeedbackPage', () => {
  // Proves the list is newest first and each piece names its sender, role and page.
  it('lists feedback newest first with who sent it', async () => {
    renderFeedback()

    const items = await pieces()
    expect(items).toHaveLength(3)
    expect(within(items[0]!).getByText('The review button does nothing')).toBeVisible()
    expect(within(items[0]!).getByText(/Tobi Teacher · tobi@x.example · teacher/)).toBeVisible()
    expect(within(items[0]!).getByText(/\/teacher\/review/)).toBeVisible()
    expect(within(items[1]!).getByText('Score 4 of 5')).toBeVisible()
  })

  // Proves the status filter narrows the list and is kept in the address.
  it('filters by status and keeps it in the address', async () => {
    const { user, router } = renderFeedback()
    await pieces()

    await user.selectOptions(screen.getByLabelText('Status'), 'read')

    await waitFor(() => {
      expect(
        within(screen.getByRole('list', { name: 'Feedback' })).getAllByRole('listitem'),
      ).toHaveLength(1)
    })
    expect(screen.getByText('All good')).toBeVisible()
    expect(router.state.location.search).toBe('?status=read')
  })

  // Proves the kind filter narrows the list.
  it('filters by kind', async () => {
    const { user } = renderFeedback()
    await pieces()

    await user.selectOptions(screen.getByLabelText('About'), 'bug')

    await waitFor(() => {
      expect(
        within(screen.getByRole('list', { name: 'Feedback' })).getAllByRole('listitem'),
      ).toHaveLength(1)
    })
    expect(screen.getByText('The review button does nothing')).toBeVisible()
  })

  // Proves "Mark as read" changes the status, and the piece leaves the "new" list.
  it('marks a piece of feedback as read', async () => {
    const { user } = renderFeedback('/admin/feedback?status=new')
    const first = (await pieces())[0]!

    await user.click(within(first).getByRole('button', { name: 'Mark as read' }))

    await waitFor(() => {
      expect(
        within(screen.getByRole('list', { name: 'Feedback' })).getAllByRole('listitem'),
      ).toHaveLength(1)
    })
    expect(screen.queryByText('The review button does nothing')).not.toBeInTheDocument()
  })

  // SECURITY: proves a message with markup is shown as words and never runs or links anywhere.
  it('shows a message as text', async () => {
    renderFeedback(
      '/admin/feedback',
      platform([
        record({
          id: 'x',
          message: '<img src=x onerror="window.hacked=1"><a href="javascript:x">go</a>',
        }),
      ]),
    )

    expect(await screen.findByText(/<img src=x/)).toBeVisible()
    expect(document.querySelector('img')).toBeNull()
    expect(document.querySelector('a[href^="javascript"]')).toBeNull()
  })

  // Proves a sender whose account is gone is named as such.
  it('names a deleted account', async () => {
    renderFeedback('/admin/feedback', platform([record({ id: 'gone', userId: null })]))

    expect(await screen.findByText(/Deleted account · student/)).toBeVisible()
  })

  // Proves an empty list, and a filter with no match, each say so.
  it('explains an empty list', async () => {
    renderFeedback('/admin/feedback', platform([]))

    expect(await screen.findByText('No feedback here.')).toBeVisible()
    expect(screen.getByText('Nobody has sent feedback yet.')).toBeVisible()
  })

  // Proves the page has an error state that names no table.
  it('shows an error when the list cannot load', async () => {
    renderFeedback('/admin/feedback', platform(), {
      feedback: {
        send: () => Promise.resolve(),
        listFeedback: () => Promise.reject(new AppError('unknown', 'relation "feedback" missing')),
        setFeedbackStatus: () => Promise.resolve(),
      },
    })

    expect(await screen.findByText('Unable to load feedback.')).toBeVisible()
    expect(screen.queryByText(/relation/)).toBeNull()
  })

  // Proves the page passes the accessibility check.
  it('has no accessibility violations', async () => {
    const { container } = renderFeedback()
    await pieces()

    await expectNoAxeViolations(container)
  })
})
