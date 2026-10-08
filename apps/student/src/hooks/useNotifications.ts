/**
 * Data hooks for notifications: the list, the bell's unread count, and marking as read. Marking
 * is optimistic: the dot and the count change at once, and go back if the service fails.
 */

// Cached reads, writes, and the cache.
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'

// The injected services.
import { useServices } from '@/services/useServices'
// Shapes.
import type { AppNotification } from '@/types/domain'

// Error conversion for query functions.
import { appQuery } from '@conote/core/appQuery'
// Cache keys.
import { queryKeys } from './queryKeys'

/** Every notification, newest first. */
export function useNotifications() {
  // The notification service.
  const { notifications } = useServices()
  // Cached list.
  return useQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: () => appQuery(() => notifications.list()),
  })
}

/** How many notifications are unread, for the bell's badge. */
export function useUnreadCount() {
  // The notification service.
  const { notifications } = useServices()
  // Cached count.
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: () => appQuery(() => notifications.unreadCount()),
  })
}

/** The cached list and count, as they were before a change. */
interface Snapshot {
  list: AppNotification[] | undefined
  count: number | undefined
}

/**
 * Marks the notifications `isTarget` picks as read in the cached list, and lowers the cached
 * count to match. Returns what was there, for rolling back.
 */
async function markCachedRead(
  client: QueryClient,
  isTarget: (n: AppNotification) => boolean,
): Promise<Snapshot> {
  // A refetch finishing mid-change would overwrite the change.
  await client.cancelQueries({ queryKey: queryKeys.notifications.all })
  // What was there.
  const list = client.getQueryData<AppNotification[]>(queryKeys.notifications.list())
  const count = client.getQueryData<number>(queryKeys.notifications.unreadCount())
  // How many unread ones this change reads.
  const newlyRead = list?.filter((n) => !n.read && isTarget(n)).length ?? 0
  // The list with the targets read.
  if (list) {
    client.setQueryData<AppNotification[]>(
      queryKeys.notifications.list(),
      list.map((n) => (isTarget(n) ? { ...n, read: true } : n)),
    )
  }
  // The count lowered, never below zero. Without a cached list, "all" still means zero.
  if (count !== undefined) {
    client.setQueryData<number>(
      queryKeys.notifications.unreadCount(),
      Math.max(0, count - newlyRead),
    )
  }
  return { list, count }
}

/** Puts the cached list and count back. */
function restore(client: QueryClient, snapshot: Snapshot | undefined) {
  if (!snapshot) return
  client.setQueryData(queryKeys.notifications.list(), snapshot.list)
  client.setQueryData(queryKeys.notifications.unreadCount(), snapshot.count)
}

/** Marks one notification as read (FR-NTF-3). */
export function useMarkNotificationRead() {
  // The notification service and the cache.
  const { notifications } = useServices()
  const client = useQueryClient()
  return useMutation({
    mutationFn: (notificationId: string) => appQuery(() => notifications.markRead(notificationId)),
    // Before the call: the dot and the count change at once.
    onMutate: (notificationId) => markCachedRead(client, (n) => n.id === notificationId),
    // Failed: put them back.
    onError: (_error, _id, snapshot) => {
      restore(client, snapshot)
    },
    // Either way: refetch, so the cache matches the service.
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  })
}

/** Marks every notification as read (FR-NTF-3). */
export function useMarkAllRead() {
  // The notification service and the cache.
  const { notifications } = useServices()
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => appQuery(() => notifications.markAllRead()),
    // Before the call: every dot goes, and the count drops to zero.
    onMutate: async () => {
      const snapshot = await markCachedRead(client, () => true)
      client.setQueryData<number>(queryKeys.notifications.unreadCount(), 0)
      return snapshot
    },
    // Failed: put them back.
    onError: (_error, _vars, snapshot) => {
      restore(client, snapshot)
    },
    // Either way: refetch.
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  })
}
