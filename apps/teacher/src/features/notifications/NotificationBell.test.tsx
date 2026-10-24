/**
 * Tests for the top-bar bell (D111): the unread count, the list of notices, and how a notice
 * takes the teacher to the draft.
 */

// Queries and waiting.
import { screen, within } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it, vi } from 'vitest'

// The real route table, so the bell is tested where it lives: in the portal's top bar.
import { routes } from '@/app/routes'
// The shared error type.
import { AppError } from '@conote/core/errors'
// Accessibility check.
import { expectNoAxeViolations } from '@conote/testing/axe'
// Session factory and the shared test platform.
import { makeSession } from '@/test/factories'
import { reviewPlatform } from '@/test/reviewPlatform'
// Render helper.
import { renderWithRouter } from '@/test/renderWithRouter'
// Service shape for the failing one.
import type { Services } from '@/services/types'

/** Renders the portal on My courses over `platform`, signed in as the test teacher. */
function renderPortal(platform = reviewPlatform(), overrides?: Partial<Services>) {
  return renderWithRouter({
    routes,
    path: '/teacher/courses',
    session: makeSession('teacher'),
    platform,
    ...(overrides ? { overrides } : {}),
  })
}

describe('NotificationBell', () => {
  // Proves a waiting draft shows as one unread notice on the bell, named with the exact count.
  it('shows how many notices are unread', async () => {
    renderPortal()

    expect(await screen.findByRole('button', { name: 'Notifications, 1 unread' })).toBeVisible()
  })

  // Proves there is no count when nothing is waiting.
  it('shows no count when nothing is waiting', async () => {
    renderPortal(reviewPlatform('published'))

    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeVisible()
  })

  // Proves a notice opens the draft, and reading it clears the count.
  it('opens the draft from a notice and marks the notice read', async () => {
    const { user } = renderPortal()
    await user.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }))

    await user.click(await screen.findByRole('menuitem', { name: /A draft is ready to review/ }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Class 4: Basis and dimension' }),
    ).toBeVisible()
    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeVisible()
  })

  // Proves the notice names the course and class, and that an empty list says so.
  it('describes each notice, and says when there are none', async () => {
    const first = renderPortal()
    await first.user.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }))
    const item = await screen.findByRole('menuitem', { name: /A draft is ready to review/ })
    expect(within(item).getByText('MTH 202, class 4: Basis and dimension')).toBeVisible()
    first.unmount()
    window.localStorage.clear()

    const second = renderPortal(reviewPlatform('published'))
    await second.user.click(await screen.findByRole('button', { name: 'Notifications' }))

    expect(await screen.findByText('No notices yet.')).toBeVisible()
  })

  // Proves "Mark all as read" clears the count without opening anything.
  it('marks every notice as read', async () => {
    const { user } = renderPortal()
    await user.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }))

    await user.click(await screen.findByRole('menuitem', { name: 'Mark all as read' }))

    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeVisible()
  })

  // Proves a failed load is said in words, with a way to try again.
  it('says so when the notices cannot be loaded, and tries again on request', async () => {
    const list = vi
      .fn()
      .mockRejectedValueOnce(new AppError('unknown', 'Something went wrong.'))
      .mockResolvedValue([])
    const { user } = renderPortal(reviewPlatform(), {
      notifications: { list, markRead: vi.fn(), markAllRead: vi.fn() },
    })
    await user.click(await screen.findByRole('button', { name: 'Notifications' }))

    expect(await screen.findByText('We could not load your notices.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('No notices yet.')).toBeVisible()
  })

  // Proves the bell leaves the page free of accessibility violations.
  it('has no accessibility violations', async () => {
    const { container } = renderPortal()
    await screen.findByRole('button', { name: 'Notifications, 1 unread' })

    await expectNoAxeViolations(container)
  })
})
