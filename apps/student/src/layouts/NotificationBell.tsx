/**
 * The top-bar bell with its unread badge (REQUIREMENTS.md section 8). On phones it is the way
 * to Notifications, which has no bottom-bar tab (decision D35).
 */

// Bell icon.
import { Bell } from 'lucide-react'
// Internal link.
import { Link } from 'react-router'

// Standard button styles.
import { Button } from '@conote/ui/button'
// Route constants.
import { ROUTES } from '@/lib/routes'
// "12" → "9+", 0 → no badge.
import { formatUnreadCount } from '@/lib/unreadBadge'

/** The bell link, with a badge when something is unread. */
export function NotificationBell({ unreadCount }: Readonly<{ unreadCount: number }>) {
  // What the badge shows, or null for no badge.
  const badge = formatUnreadCount(unreadCount)

  return (
    <Button variant="ghost" size="icon" asChild className="relative">
      {/* The link's name includes the exact count, since the badge itself is hidden from
          screen readers and may say "9+". */}
      <Link
        to={ROUTES.notifications}
        aria-label={badge ? `Notifications, ${Math.floor(unreadCount)} unread` : 'Notifications'}
      >
        {/* Decorative icon; the link's name says what it is. */}
        <Bell aria-hidden="true" className="size-5" />
        {/* The badge, pinned to the icon's top-right corner. */}
        {badge && (
          <span
            aria-hidden="true"
            className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-none font-semibold text-white"
          >
            {badge}
          </span>
        )}
      </Link>
    </Button>
  )
}
