/**
 * Tests for the Notifications page (FR-NTF-1 to FR-NTF-5).
 */

// Queries and waiting.
import { screen, waitFor, within } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The real route table.
import { routes } from '@/app/routes'
// Service types.
import type { Services } from '@/services/types'
// Accessibility check.
import { expectNoAxeViolations } from '@conote/testing/axe'
// Empty, failing and hanging data.
import { emptyCatalog, failingCatalog, hangingCatalog } from '@/test/catalogServices'
// Session factory.
import { makeSession } from '@/test/factories'
// Render helper.
import { renderWithRouter } from '@/test/renderWithRouter'

/** Renders the page at `path`, signed in. */
function renderNotifications(path = '/notifications', services: Partial<Services> = {}) {
  return renderWithRouter({ routes, path, session: makeSession(), services })
}

/** The notification rows in the open tab. */
async function rows() {
  const list = await within(await screen.findByRole('tabpanel')).findByRole('list', {
    name: 'Notifications',
  })
  return Array.from(list.children) as HTMLElement[]
}

/** The top bar's bell link. */
function bell() {
  return within(screen.getByRole('banner')).getByRole('link', { name: /^Notifications/ })
}

describe('NotificationsPage', () => {
  // Proves the four tabs and what each holds (FR-NTF-1).
  it.each([
    ['', 8],
    ['?tab=summary', 3],
    ['?tab=system', 2],
    ['?tab=message', 2],
  ])('shows the right notifications for %j', async (search, count) => {
    // Act.
    renderNotifications(`/notifications${search}`)

    // Assert.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Notifications' }),
    ).toBeInTheDocument()
    expect(await rows()).toHaveLength(count)
  })

  // Proves each row shows its title, body, time and an unread marker (FR-NTF-2).
  it('shows the details and unread marker', async () => {
    // Act.
    renderNotifications()

    // Assert: the second item is unread, the first is read.
    const [read, unread] = await rows()
    expect(read).toHaveTextContent('Note saved')
    expect(read).not.toHaveTextContent('Unread')
    expect(unread).toHaveTextContent('New summary: Software Requirements')
    expect(unread).toHaveTextContent('Dr. Smith published the summary')
    expect(unread).toHaveTextContent('2 hours ago')
    expect(unread).toHaveTextContent('Unread')
  })

  // Proves opening an item marks it read, updates the bell, and follows its link (FR-NTF-3, -5).
  it('marks an item read when opened', async () => {
    // Arrange.
    const { user, router } = renderNotifications()
    await rows()
    await waitFor(() => {
      expect(bell()).toHaveAccessibleName('Notifications, 3 unread')
    })

    // Act.
    await user.click(screen.getByRole('link', { name: /New summary: Software Requirements/ }))

    // Assert.
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/courses/swe-311/classes/swe-311-c2/summary')
    })
    await waitFor(() => {
      expect(bell()).toHaveAccessibleName('Notifications, 2 unread')
    })
  })

  // Proves "Mark all as read" clears every marker and the bell (FR-NTF-3).
  it('marks all as read', async () => {
    // Arrange.
    const { user } = renderNotifications()
    await rows()

    // Act.
    await user.click(screen.getByRole('button', { name: 'Mark all as read' }))

    // Assert.
    await waitFor(() => {
      expect(bell()).toHaveAccessibleName('Notifications')
    })
    for (const row of await rows()) expect(row).not.toHaveTextContent('Unread')
    expect(screen.getByRole('button', { name: 'Mark all as read' })).toBeDisabled()
  })

  // Proves an empty tab says so.
  it('shows an empty state', async () => {
    // Act.
    renderNotifications('/notifications', emptyCatalog())

    // Assert.
    expect(await screen.findByText('No notifications')).toBeInTheDocument()
  })

  // Proves loading and failure states (section 11).
  it('shows loading and error states', async () => {
    // Act: never finishes.
    const { unmount } = renderNotifications('/notifications', hangingCatalog())

    // Assert.
    expect(await screen.findByText('Loading…')).toBeInTheDocument()
    unmount()

    // Act: fails.
    renderNotifications('/notifications', failingCatalog())

    // Assert.
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  // Proves the page passes the automated accessibility rules.
  it('has no accessibility violations', async () => {
    // Act.
    const { container } = renderNotifications()
    await rows()

    // Assert.
    await expectNoAxeViolations(container)
  })
})
