/**
 * Notifications, at /notifications (FR-NTF-1 to FR-NTF-6): four tabs chosen with ?tab=, an
 * unread marker on each unread item, and "Mark all as read". Opening an item marks it read.
 */

// Icons.
import { BellOff, CheckCheck } from 'lucide-react'
// Links and the query string.
import { Link, useSearchParams } from 'react-router'

// Empty state.
import { EmptyState } from '@/components/common/EmptyState'
// Failed-load panel.
import { LoadError } from '@/components/common/LoadError'
// The type icon.
import { NotificationTypeIcon } from '@/components/common/NotificationTypeIcon'
// Tab title.
import { PageTitle } from '@conote/ui/common/PageTitle'
// Loading placeholder.
import { ListSkeleton } from '@/components/common/Skeletons'
// Button and tabs.
import { Button } from '@conote/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@conote/ui/tabs'
// Toast messages.
import { useToast } from '@conote/ui/toast'
// Data hooks.
import { useNow } from '@/hooks/useNow'
import { useMarkAllRead, useMarkNotificationRead, useNotifications } from '@/hooks/useNotifications'
// Relative times.
import { formatRelativeTime } from '@/lib/dates'
// Checks a notification link stays inside CoNote.
import { isSafeRedirect } from '@conote/core/isSafeRedirect'
// Reads ?tab= safely.
import { parseTab } from '@/lib/tabs'
// Class-name helper.
import { cn } from '@conote/ui/utils'
// Shapes.
import type { AppNotification } from '@/types/domain'

/** The tabs (FR-NTF-1); each but "all" is a notification type. */
const NOTIFICATION_TABS: ['all', 'summary', 'system', 'message'] = [
  'all',
  'summary',
  'system',
  'message',
]
/** The tabs' words. */
const TAB_LABELS: Record<(typeof NOTIFICATION_TABS)[number], string> = {
  all: 'All',
  summary: 'Summaries',
  system: 'System',
  message: 'Messages',
}

/** The Notifications page. */
export function NotificationsPage() {
  // The notifications.
  const notifications = useNotifications()
  // "Mark all as read".
  const markAll = useMarkAllRead()
  // Toasts.
  const toast = useToast()
  // The address's query string.
  const [params, setParams] = useSearchParams()
  // SECURITY: only known tab names are used (see parseTab).
  const tab = parseTab(params.get('tab'), NOTIFICATION_TABS)
  // Whether anything is unread.
  const anyUnread = notifications.data?.some((n) => !n.read) ?? false

  return (
    <div className="w-full max-w-3xl space-y-6">
      {/* Tab title. */}
      <PageTitle title="Notifications" />
      {/* Heading and "Mark all as read" (FR-NTF-3). */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Notifications</h1>
        <Button
          type="button"
          variant="outline"
          disabled={!anyUnread}
          onClick={() => {
            markAll.mutate(undefined, {
              onError: () => {
                toast.error("Couldn't mark your notifications as read. Try again.")
              },
            })
          }}
        >
          <CheckCheck aria-hidden="true" />
          Mark all as read
        </Button>
      </div>

      {/* The four tabs, kept in ?tab=. */}
      <Tabs
        value={tab}
        onValueChange={(value) => {
          setParams({ tab: parseTab(value, NOTIFICATION_TABS) }, { replace: true })
        }}
      >
        <TabsList aria-label="Notification types">
          {NOTIFICATION_TABS.map((t) => (
            <TabsTrigger key={t} value={t}>
              {TAB_LABELS[t]}
            </TabsTrigger>
          ))}
        </TabsList>
        {NOTIFICATION_TABS.map((t) => (
          <TabsContent key={t} value={t}>
            <NotificationList notifications={notifications} tab={t} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

/** One tab's list, with its loading, error and empty states. */
function NotificationList({
  notifications,
  tab,
}: Readonly<{
  notifications: ReturnType<typeof useNotifications>
  tab: (typeof NOTIFICATION_TABS)[number]
}>) {
  // The clock, for "2 hours ago".
  const now = useNow()

  // Failed.
  if (notifications.isError) {
    return <LoadError error={notifications.error} onRetry={() => void notifications.refetch()} />
  }
  // Loading.
  if (!notifications.data) return <ListSkeleton rows={4} />
  // This tab's items.
  const items =
    tab === 'all' ? notifications.data : notifications.data.filter((n) => n.type === tab)
  // None.
  if (items.length === 0) {
    return (
      <EmptyState icon={BellOff} title="No notifications">
        New summaries, announcements and messages from your teachers appear here.
      </EmptyState>
    )
  }

  return (
    <ul aria-label="Notifications" className="divide-y rounded-xl border bg-card">
      {items.map((item) => (
        <NotificationRow key={item.id} item={item} now={now} />
      ))}
    </ul>
  )
}

/** One notification. Opening it marks it read, then follows its link if it has one (FR-NTF-3). */
function NotificationRow({ item, now }: Readonly<{ item: AppNotification; now: Date }>) {
  // Marks it read.
  const markRead = useMarkNotificationRead()

  /** Marks it read; a failure only leaves the marker in place. */
  function open() {
    if (!item.read) markRead.mutate(item.id)
  }

  // The row's content.
  const content = (
    <>
      <NotificationTypeIcon type={item.type} />
      <span className="min-w-0 flex-1">
        {/* Title; bold while unread, so the state isn't shown by the dot alone. */}
        <span className={cn('block', !item.read && 'font-semibold')}>{item.title}</span>{' '}
        {/* Detail. */}
        <span className="block text-sm text-muted-foreground">{item.body}</span> {/* When. */}
        <span className="block text-xs text-muted-foreground">
          {formatRelativeTime(item.createdAt, now)}
        </span>
      </span>
      {/* The unread dot, with words for screen readers (FR-NTF-2). */}
      {!item.read && (
        <span className="mt-1.5 flex items-center">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-primary" />
          <span className="sr-only">Unread</span>
        </span>
      )}
    </>
  )
  // Shared look: the whole row is the target.
  const rowClass =
    'flex w-full items-start gap-3 p-4 text-left outline-none hover:bg-background focus-visible:ring-[3px] focus-visible:ring-ring/50'

  return (
    <li>
      {/* SECURITY: the link comes from the server, so it is followed only if it stays inside
          CoNote; anything else (e.g. "javascript:") becomes a plain button. */}
      {isSafeRedirect(item.link, window.location.origin) ? (
        <Link to={item.link} onClick={open} className={rowClass}>
          {content}
        </Link>
      ) : (
        <button type="button" onClick={open} className={rowClass}>
          {content}
        </button>
      )}
    </li>
  )
}
