/**
 * The bell in the top bar (D111): a count of the notices not yet read, and a menu with the notices
 * themselves. A notice opens the draft it is about. The menu handles all four states: loading,
 * empty, failed, and the list.
 */

// Icon.
import { Bell } from 'lucide-react'
// Links inside the portal.
import { Link } from 'react-router'

// Standard controls.
import { Button } from '@conote/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@conote/ui/dropdown-menu'
import { Skeleton } from '@conote/ui/skeleton'

// The notices and marking them read.
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/hooks/useNotifications'

/** The most the badge shows before it says "9+". */
const BADGE_MAX = 9

/** The bell with its badge, and the menu of notices. */
export function NotificationBell() {
  // The notices, and what marking them does.
  const { data, isPending, isError, refetch } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()
  // How many are unread: none while the list is loading or has failed.
  const unread = (data ?? []).filter((notice) => !notice.read).length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* The name carries the exact count, since the badge is hidden from screen readers and may
            say "9+". */}
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unread > 0 ? `Notifications, ${String(unread)} unread` : 'Notifications'}
        >
          {/* Decorative: the button's name says what it is. */}
          <Bell aria-hidden="true" className="size-5" />
          {/* The badge, pinned to the icon's top-right corner. */}
          {unread > 0 && (
            <span
              aria-hidden="true"
              className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-none font-semibold text-white"
            >
              {unread > BADGE_MAX ? `${String(BADGE_MAX)}+` : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)]">
        <DropdownMenuLabel>Notices</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* Loading: blocks where the notices will be. */}
        {isPending && (
          <div className="space-y-2 p-2">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        )}
        {/* Failed: said in words, with a way to try again. */}
        {isError && (
          <div className="space-y-2 p-2 text-sm">
            <p>We could not load your notices.</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void refetch()
              }}
            >
              Try again
            </Button>
          </div>
        )}
        {/* Empty. */}
        {data?.length === 0 && <p className="p-2 text-sm text-muted-foreground">No notices yet.</p>}
        {/* The notices. Choosing one opens the draft and marks it read. */}
        {data?.map((notice) => (
          <DropdownMenuItem
            key={notice.id}
            asChild
            onSelect={() => {
              if (!notice.read) markRead.mutate(notice.id)
            }}
          >
            {/* A notice with no safe link is shown but goes nowhere. */}
            <Link
              to={notice.link ?? '#'}
              className="flex flex-col items-start gap-0.5 whitespace-normal"
            >
              <span className={notice.read ? 'font-normal' : 'font-semibold'}>{notice.title}</span>
              <span className="text-xs text-muted-foreground">{notice.body}</span>
            </Link>
          </DropdownMenuItem>
        ))}
        {/* Only while something is unread. */}
        {unread > 0 && (
          <>
            <DropdownMenuSeparator />
            {/* An item, so choosing it closes the menu like any other choice. */}
            <DropdownMenuItem
              onSelect={() => {
                markAllRead.mutate()
              }}
            >
              Mark all as read
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
