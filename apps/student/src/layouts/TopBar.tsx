/**
 * The bar across the top of every portal page (D104): the menu button (phones), search,
 * notifications and the account menu.
 */

// The menu icon.
import { Menu } from 'lucide-react'

// Global search.
import { GlobalSearch } from '@/features/search/GlobalSearch'

// The bell with its unread badge.
import { NotificationBell } from './NotificationBell'
// The avatar drop-down.
import { UserMenu } from './UserMenu'

/** What the top bar shows. */
interface TopBarProps {
  // For the account menu.
  fullName: string
  email: string
  // Unread notifications for the bell's badge; none while the count loads.
  unreadCount?: number
  // Opens the phone drawer.
  onMenu: () => void
}

/** Top bar for portal pages. */
export function TopBar({ fullName, email, unreadCount = 0, onMenu }: Readonly<TopBarProps>) {
  return (
    // Stays at the top while scrolling; slightly see-through with a blur behind it.
    // The top padding keeps it below the iPhone status bar where iOS reports one (zero
    // elsewhere), and the height grows by the same amount so the row stays 64 px. Items sit
    // 8 px apart on phones (12 px from 768 px), so the search text fits at 360 px.
    <header className="sticky top-0 z-20 flex h-[calc(4rem+env(safe-area-inset-top))] items-center gap-2 border-b bg-surface/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur md:gap-3 md:px-8">
      {/* The menu opens the drawer on phones; wider screens have the sidebar instead. */}
      <button
        type="button"
        aria-label="Open menu"
        onClick={onMenu}
        className="flex size-11 shrink-0 items-center justify-center rounded-full border bg-card outline-none hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 md:hidden"
      >
        <Menu aria-hidden="true" className="size-5" />
      </button>

      {/* Search across courses, classes and note titles (section 8). */}
      <GlobalSearch />

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
