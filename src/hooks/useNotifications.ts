/**
 * Data hooks for notifications: the list (Recent Activity) and the bell's unread count.
 */

// Cached, deduplicated reads.
import { useQuery } from '@tanstack/react-query'

// The injected services.
import { useServices } from '@/services/useServices'

// Error conversion for query functions.
import { appQuery } from './appQuery'
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
