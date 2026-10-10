/**
 * The contract every NotificationService must meet (FR-NTF). The mock runs it today; the Supabase
 * implementation runs the same file when its slice lands (ENGINEERING_STANDARDS.md 2.5).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The interfaces under test.
import type { Services } from '../types'

// A well-formed ID that no record has, so databases that use UUIDs are tested with one too.
const UNKNOWN_UUID = '00000000-0000-4000-8000-000000000000'

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
    })

    // Proves reading a notification that is already read is harmless.
    it('lets a notification be marked read twice', async () => {
      const { notifications } = create()
      const unread = (await notifications.list()).find((n) => !n.read)

      await notifications.markRead(unread?.id ?? '')
      await expect(notifications.markRead(unread?.id ?? '')).resolves.toBeUndefined()
    })

    // Proves unknown notifications are not_found, whatever the ID looks like.
    it.each(['no-such-notification', UNKNOWN_UUID])(
      'reports an unknown notification %s as not_found',
      async (id) => {
        await expect(create().notifications.markRead(id)).rejects.toMatchObject({
          kind: 'not_found',
        })
      },
    )

    // Proves the newest notification comes first.
    it('lists the newest first', async () => {
      const list = await create().notifications.list()

      const times = list.map((n) => Date.parse(n.createdAt))
      expect(times).toEqual([...times].sort((a, b) => b - a))
    })

    // SECURITY: proves a link is only ever a path inside the app, never an outside address.
    it('gives only in-app links', async () => {
      const list = await create().notifications.list()

      for (const notification of list) {
        if (notification.link !== undefined) expect(notification.link).toMatch(/^\/(?!\/)/)
      }
    })

    // Proves "Mark all as read" clears the count (FR-NTF-3).
    it('marks every notification as read', async () => {
      // Arrange.
      const { notifications } = create()

      // Act.
      await notifications.markAllRead()

      // Assert.
      await expect(notifications.unreadCount()).resolves.toBe(0)
      expect((await notifications.list()).every((n) => n.read)).toBe(true)
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
