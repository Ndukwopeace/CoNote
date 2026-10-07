/**
 * Tests for the top-bar bell and its unread badge (REQUIREMENTS.md section 8, decision D35).
 */

// Rendering and queries.
import { render, screen } from '@testing-library/react'
// A router, because the bell is a link.
import { MemoryRouter } from 'react-router'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// Accessibility check.
import { expectNoAxeViolations } from '@conote/testing/axe'

// The badge text rules.
import { formatUnreadCount } from '@/lib/unreadBadge'

// The component under test.
import { NotificationBell } from './NotificationBell'

describe('formatUnreadCount', () => {
  // Proves the badge text rules: nothing for zero, the number up to 9, then "9+".
  it.each([
    [0, null],
    [1, '1'],
    [9, '9'],
    [10, '9+'],
    [250, '9+'],
    // Bad input from a service never shows a negative or fractional badge.
    [-3, null],
    [2.5, '2'],
  ])('%d → %s', (count, expected) => {
    expect(formatUnreadCount(count)).toBe(expected)
  })
})

describe('NotificationBell', () => {
  // Proves no badge shows when nothing is unread.
  it('shows no badge with nothing unread', () => {
    // Act.
    render(<NotificationBell unreadCount={0} />, { wrapper: MemoryRouter })

    // Assert: the plain name and no number.
    expect(screen.getByRole('link', { name: 'Notifications' })).toBeInTheDocument()
    expect(screen.queryByText(/\d/)).toBeNull()
  })

  // Proves the badge shows the count and screen readers hear it in the link's name.
  it('shows the unread count and includes it in the name', async () => {
    // Act.
    const { container } = render(<NotificationBell unreadCount={12} />, { wrapper: MemoryRouter })

    // Assert: "9+" on screen, the exact number read out, accessible.
    expect(screen.getByText('9+')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Notifications, 12 unread' })).toBeInTheDocument()
    await expectNoAxeViolations(container)
  })
})
