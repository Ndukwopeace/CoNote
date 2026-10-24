/**
 * The bell's data (D111): the teacher's notices, and marking them read. The list is asked for
 * again every minute and when the tab is focused, so a draft that becomes ready shows without a
 * reload.
 */

// Server state, mutations and the cache.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

// Turns any failure into an AppError.
import { appQuery } from '@conote/core/appQuery'

// The services.
import { useServices } from '@/services/useServices'

// Query keys.
import { queryKeys } from './queryKeys'

/** How often the list is asked for again, in milliseconds. */
const REFRESH_MS = 60_000

/** The teacher's notices, newest first. */
export function useNotifications() {
  // The notification service.
  const { notifications } = useServices()
  return useQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: () => appQuery(() => notifications.list()),
    refetchInterval: REFRESH_MS,
  })
}

/** Marks one notice read, then asks for the list again. */
export function useMarkNotificationRead() {
  // The notification service, and the cache to refresh.
  const { notifications } = useServices()
  const client = useQueryClient()
  return useMutation({
    mutationFn: (notificationId: string) => appQuery(() => notifications.markRead(notificationId)),
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  })
}

/** Marks every notice read, then asks for the list again. */
export function useMarkAllNotificationsRead() {
  // The notification service, and the cache to refresh.
  const { notifications } = useServices()
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => appQuery(() => notifications.markAllRead()),
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  })
}
