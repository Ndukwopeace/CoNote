/**
 * The contract every NotificationService must meet (FR-NTF). The mock runs it today; the Supabase
 * implementation runs the same file when its slice lands (ENGINEERING_STANDARDS.md 2.5).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The interfaces under test.
import type { Services } from '../types'

/** What an implementation's test file passes in. */
interface NotificationContractOptions {
  /** Builds a fresh set of services for a student with notifications. */
  create: () => Pick<Services, 'notifications'>
}

/** Behaviour every implementation of the notification service must share. */
export function runNotificationServiceContract(
  name: string,
  { create }: NotificationContractOptions,
) {
  describe(`Notification service contract: ${name}`, () => {
    // Proves reading one notification lowers the unread count (FR-NTF-3, FR-NTF-5).
    it('marks a notification as read', async () => {
      // Arrange.
      const { notifications } = create()
      const before = await notifications.unreadCount()
      const unread = (await notifications.list()).find((n) => !n.read)

      // Act.
      await notifications.markRead(unread?.id ?? '')

      // Assert.
      await expect(notifications.unreadCount()).resolves.toBe(before - 1)
      expect((await notifications.list()).find((n) => n.id === unread?.id)?.read).toBe(true)
      await expect(notifications.markRead('no-such-notification')).rejects.toMatchObject({
        kind: 'not_found',
      })
    })

    // Proves "Mark all as read" clears the count (FR-NTF-3).
    it('marks every notification as read', async () => {
      // Arrange.
      const { notifications } = create()

      // Act.
      await notifications.markAllRead()

      // Assert.
      await expect(notifications.unreadCount()).resolves.toBe(0)
    })

    // Proves the unread count matches the unread notifications in the list.
    it('counts unread notifications', async () => {
      // Arrange.
      const { notifications } = create()
      const list = await notifications.list()

      // Assert.
      await expect(notifications.unreadCount()).resolves.toBe(list.filter((n) => !n.read).length)
    })
  })
}
