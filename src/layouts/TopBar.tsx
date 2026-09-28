/**
 * The bar across the top of every portal page: logo (phones), search, notifications and the
 * account menu.
 */

// Magnifying-glass icon.
import { Search } from 'lucide-react'
// Internal links.
import { Link } from 'react-router'

// The CoNote logo.
import { Logo } from '@/components/common/Logo'

// Text input.
import { Input } from '@/components/ui/input'
// Route constants.
import { ROUTES } from '@/lib/routes'

// The bell with its unread badge.
import { NotificationBell } from './NotificationBell'
// The avatar drop-down.
import { UserMenu } from './UserMenu'

/** What the top bar shows. */
interface TopBarProps {
  // For the account menu.
  fullName: string
  email: string
  // Unread notifications for the bell's badge. The notification service arrives in M5; until
  // then nothing is unread.
  unreadCount?: number
}

/** Top bar for portal pages. */
export function TopBar({ fullName, email, unreadCount = 0 }: Readonly<TopBarProps>) {
  return (
    // Stays at the top while scrolling; slightly see-through with a blur behind it.
    // The top padding keeps it below the iPhone status bar where iOS reports one (zero
    // elsewhere), and the height grows by the same amount so the row stays 64 px. Items sit
    // 8 px apart on phones (12 px from 768 px), so the search text fits at 360 px.
    <header className="sticky top-0 z-20 flex h-[calc(4rem+env(safe-area-inset-top))] items-center gap-2 border-b bg-surface/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur md:gap-3 md:px-8">
      {/* Logo on phones only, where there is no sidebar. The compact logo's hidden wordmark
          names the link "CoNote". */}
      <Link to={ROUTES.dashboard} className="shrink-0 rounded-md md:hidden">
        <Logo compact />
      </Link>

      {/* Search arrives with M5 (REQUIREMENTS.md section 8); disabled until it works. */}
      <div className="relative max-w-md flex-1">
        {/* Magnifying glass inside the field; decorative, and ignores clicks. */}
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        {/* The field. aria-label names it because there is no visible label. */}
        <Input
          type="search"
          aria-label="Search courses, classes and notes"
          // Says what can be found, so students don't have to guess (recognition over recall).
          // Classes are found through their course. At 138 px it fits phones from 360 px up; if a
          // font setting makes it longer, it ends in "…" rather than being cut mid-word.
          placeholder="Find courses & notes"
          // The browser's own clear (×) button reserves width even when empty, which cut the
          // placeholder short; it is hidden, and M5 adds a clear button that works everywhere.
          className="pl-9 text-ellipsis [&::-webkit-search-cancel-button]:appearance-none"
          disabled
        />
      </div>

      {/* Right-hand actions. */}
      <div className="ml-auto flex items-center gap-2">
        {/* Notifications, with the unread badge. On phones this is the only way there (D35). */}
        <NotificationBell unreadCount={unreadCount} />
        {/* Avatar menu. */}
        <UserMenu fullName={fullName} email={email} />
      </div>
    </header>
  )
}
