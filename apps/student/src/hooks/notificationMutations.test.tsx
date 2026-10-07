/**
 * Tests for marking notifications as read: the list and the unread count change at once, and
 * go back if the service fails (FR-NTF-3, FR-NTF-5).
 */

// Hook rendering and waiting helpers.
import { act, renderHook, waitFor } from '@testing-library/react'
// Type for the wrapper's children.
import type { ReactNode } from 'react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The real providers.
import { AppProviders } from '@/app/AppProviders'
// The error type failures arrive as.
import { AppError } from '@conote/core/errors'
// Service types.
import type { NotificationService, Services } from '@/services/types'
// Instant demo services and a no-retry cache.
import { createTestQueryClient, createTestServices } from '@/test/renderWithRouter'

// The hooks under test.
import {
  useMarkAllRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadCount,
} from './useNotifications'

/** Renders the list, the count and both actions, with the notification service optionally changed. */
function renderNotificationHooks(overrides: Partial<NotificationService> = {}) {
  // Demo services, with the test's overrides.
  const base = createTestServices()
  const services: Services = { ...base, notifications: { ...base.notifications, ...overrides } }
  // The wrapper.
  const queryClient = createTestQueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders services={services} queryClient={queryClient}>
      {children}
    </AppProviders>
  )
  return renderHook(
    () => ({
      list: useNotifications(),
      count: useUnreadCount(),
      markRead: useMarkNotificationRead(),
      markAll: useMarkAllRead(),
    }),
    { wrapper },
  )
}

/** A call that never finishes, so only the instant change can show. */
const never = () => new Promise<void>(() => undefined)
/** A call that fails as if offline. */
const offline = () => Promise.reject(new AppError('network', 'offline'))

describe('notification mutations', () => {
  // Proves one read shows at once in the list and the count.
  it('marks one as read straight away', async () => {
    // Arrange.
    const { result } = renderNotificationHooks({ markRead: never })
    await waitFor(() => {
      expect(result.current.count.data).toBe(3)
      expect(result.current.list.data).toBeDefined()
    })

    // Act.
    act(() => {
      result.current.markRead.mutate('n2')
    })

    // Assert.
    await waitFor(() => {
      expect(result.current.count.data).toBe(2)
    })
    expect(result.current.list.data?.find((n) => n.id === 'n2')?.read).toBe(true)
  })

  // Proves "Mark all as read" shows at once.
  it('marks all as read straight away', async () => {
    // Arrange.
    const { result } = renderNotificationHooks({ markAllRead: never })
    await waitFor(() => {
      expect(result.current.count.data).toBe(3)
      expect(result.current.list.data).toBeDefined()
    })

    // Act.
    act(() => {
      result.current.markAll.mutate()
    })

    // Assert.
    await waitFor(() => {
      expect(result.current.count.data).toBe(0)
    })
    expect(result.current.list.data?.every((n) => n.read)).toBe(true)
  })

  // Proves a failure puts the unread state back.
  it('rolls back when marking fails', async () => {
    // Arrange.
    const { result } = renderNotificationHooks({ markAllRead: offline })
    await waitFor(() => {
      expect(result.current.count.data).toBe(3)
    })

    // Act.
    await act(async () => {
      await result.current.markAll.mutateAsync().catch(() => undefined)
    })

    // Assert.
    await waitFor(() => {
      expect(result.current.count.data).toBe(3)
    })
  })
})
